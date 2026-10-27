import type { Graph, GraphEdge, GraphNode } from '../../engine/types'

export type LottieStatus = 'native' | 'partial' | 'unsupported'

export interface LottieNodeInfo {
  status: LottieStatus
  reason: string
}

export interface LottieAnalysis {
  targetId: string | null
  nodes: Record<string, LottieNodeInfo>
  counts: Record<LottieStatus, number>
}

const NATIVE = 'native' as const
const PARTIAL = 'partial' as const
const UNSUPPORTED = 'unsupported' as const

function info(status: LottieStatus, reason: string): LottieNodeInfo {
  return { status, reason }
}

function valuesInto(graph: Graph, id: string, port?: string): GraphEdge[] {
  return graph.edges.filter(
    (edge) =>
      edge.target === id &&
      (edge.kind ?? 'value') === 'value' &&
      (port === undefined || edge.targetPort === port),
  )
}

function hasControl(graph: Graph, id: string): boolean {
  return graph.edges.some(
    (edge) => edge.target === id && (edge.kind === 'drive' || edge.kind === 'param'),
  )
}

function hasLfo(node: GraphNode): boolean {
  return Object.values(node.lfo ?? {}).some((lfo) => lfo.on)
}

function hasTrack(node: GraphNode, key: string): boolean {
  return (node.tracks?.[key]?.length ?? 0) > 0
}

function worst(a: LottieStatus, b: LottieStatus): LottieStatus {
  if (a === UNSUPPORTED || b === UNSUPPORTED) return UNSUPPORTED
  if (a === PARTIAL || b === PARTIAL) return PARTIAL
  return NATIVE
}

function withControlCaveat(node: GraphNode, graph: Graph, base: LottieNodeInfo): LottieNodeInfo {
  if (base.status === UNSUPPORTED) return base
  if (hasControl(graph, node.id) || hasLfo(node)) {
    return info(PARTIAL, 'Styres av signal eller LFO og eksporteres som statisk verdi.')
  }
  return base
}

function ownInfo(node: GraphNode): LottieNodeInfo {
  switch (node.type) {
    case 'source.shape2D': {
      const shape = String(node.params.shape ?? 'ellipse')
      const movingSize = hasTrack(node, 'width') || hasTrack(node, 'height')
      if (movingSize && (shape === 'star' || shape === 'polygon')) {
        return info(PARTIAL, 'Stjerne/polygon med animert bredde eller høyde eksporteres med fast størrelse.')
      }
      if (movingSize && node.params.gradient) {
        return info(PARTIAL, 'Gradientfyllet følger ikke animert bredde eller høyde.')
      }
      if (hasTrack(node, 'gradientAngle')) {
        return info(PARTIAL, 'Animert gradientvinkel eksporteres med fast vinkel.')
      }
      return info(NATIVE, 'Form, fyll, gradient, kant, transform og opacity.')
    }
    case 'source.text2D': {
      if (node.params.gradient) {
        return info(UNSUPPORTED, 'Gradienttekst støttes ikke i Lottie v1. Slå av gradientfyll eller bruk en form.')
      }
      const animatedText = ['text', 'size', 'font', 'weight', 'align', 'lineHeight', 'scale'].some(
        (key) => (node.tracks?.[key]?.length ?? 0) > 0,
      )
      return info(
        PARTIAL,
        animatedText
          ? 'Teksten eksporteres med fast innhold og skriftstørrelse; bare posisjon og opacity animeres.'
          : 'Lottie-tekst krever at fonten finnes der animasjonen spilles av.',
      )
    }
    case 'source.gradient': {
      if (Number(node.params.travel ?? 0) > 0 || hasTrack(node, 'travel')) {
        return info(PARTIAL, 'Fargevandring eksporteres som en statisk gradient.')
      }
      if (hasTrack(node, 'angle') || hasTrack(node, 'density')) {
        return info(PARTIAL, 'Animert vinkel eller tetthet eksporteres med fast verdi.')
      }
      return info(NATIVE, 'Ensfarget, lineær eller radial gradient som bakgrunnslag.')
    }
    case 'modifier.transform2D':
    case 'output.viewport':
    case 'output.export':
      return info(NATIVE, 'Videresender input.')
    case 'composite.stack':
    case 'composite.blend':
      return info(NATIVE, 'Lagsammensetning.')
    default:
      return info(
        UNSUPPORTED,
        'Noden har ingen Lottie-ekvivalent i v1. Koble den bort, eller bruk en form, tekst eller gradient.',
      )
  }
}

function targetNode(graph: Graph, requested?: string | null): GraphNode | undefined {
  if (requested) {
    const match = graph.nodes.find((node) => node.id === requested)
    if (match) return match
  }
  return (
    graph.nodes.find((node) => node.type === 'output.export') ??
    graph.nodes.find((node) => node.type === 'output.viewport')
  )
}

/**
 * Analyserer hvilke noder som kan bli ekte Lottie-lag.
 *
 * Grønn = native, gul = eksporteres med forbehold, rød = hoppes over.
 * Analysen følger bare verdikoblinger; signal- og parameterkoblinger gjør
 * en node gul, fordi Lottie ikke kan kjøre appens modulatorer.
 */
export function analyzeLottie(graph: Graph, targetId?: string | null): LottieAnalysis {
  const target = targetNode(graph, targetId)
  const nodes: Record<string, LottieNodeInfo> = {}
  const cache = new Map<string, LottieNodeInfo>()
  const visiting = new Set<string>()

  const visit = (id: string): LottieNodeInfo => {
    const cached = cache.get(id)
    if (cached) return cached
    if (visiting.has(id)) return info(UNSUPPORTED, 'Syklus i grafen.')
    const node = graph.nodes.find((item) => item.id === id)
    if (!node) return info(UNSUPPORTED, 'Noden finnes ikke.')

    visiting.add(id)
    let result: LottieNodeInfo

    if (node.enabled === false) {
      const input = valuesInto(graph, id)[0]
      result = input
        ? visit(input.source)
        : info(UNSUPPORTED, 'Deaktivert node uten input.')
    } else {
      switch (node.type) {
        case 'modifier.transform2D':
        case 'output.viewport':
        case 'output.export': {
          const input = valuesInto(graph, id)[0]
          result = input ? visit(input.source) : info(UNSUPPORTED, 'Mangler input.')
          if (node.type === 'modifier.transform2D') {
            result = withControlCaveat(node, graph, result)
          }
          break
        }
        case 'composite.stack': {
          const inputs = valuesInto(graph, id, 'in')
          if (inputs.length === 0) {
            result = info(UNSUPPORTED, 'Lagstabelen har ingen lag.')
            break
          }
          const statuses = inputs.map((input) => visit(input.source).status)
          const exportable = statuses.filter((status) => status !== UNSUPPORTED)
          result =
            exportable.length === 0
              ? info(UNSUPPORTED, 'Ingen av lagene kan eksporteres til Lottie.')
              : statuses.some((status) => status === UNSUPPORTED)
                ? info(PARTIAL, 'Noen lag kan ikke eksporteres og hoppes over.')
                : statuses.some((status) => status === PARTIAL)
                  ? info(PARTIAL, 'Noen lag har begrensninger; se de gule nodene.')
                  : info(NATIVE, 'Alle lag kan eksporteres.')
          if (hasTrack(node, 'opacity')) {
            result = info(PARTIAL, 'Animert stabel-opacity eksporteres med fast verdi.')
          }
          result = withControlCaveat(node, graph, result)
          break
        }
        case 'composite.blend': {
          const base = valuesInto(graph, id, 'base')[0]
          const top = valuesInto(graph, id, 'top')[0]
          if (!base && !top) {
            result = info(UNSUPPORTED, 'Blandingen mangler begge lag.')
            break
          }
          let status: LottieStatus = NATIVE
          if (base) status = worst(status, visit(base.source).status)
          if (top) status = worst(status, visit(top.source).status)
          result =
            status === UNSUPPORTED
              ? info(UNSUPPORTED, 'Blandingen trenger to lag som begge kan eksporteres.')
              : status === PARTIAL
                ? info(PARTIAL, 'Blandingen har lag med begrensninger.')
                : info(NATIVE, 'To Lottie-lag med blandemodus.')
          if (hasTrack(node, 'opacity')) {
            result = info(PARTIAL, 'Animert blandings-opacity eksporteres med fast verdi.')
          }
          result = withControlCaveat(node, graph, result)
          break
        }
        default:
          result = withControlCaveat(node, graph, ownInfo(node))
      }
    }

    visiting.delete(id)
    cache.set(id, result)
    nodes[id] = result
    return result
  }

  if (target) visit(target.id)

  const counts: Record<LottieStatus, number> = { native: 0, partial: 0, unsupported: 0 }
  for (const [id, entry] of Object.entries(nodes)) {
    const node = graph.nodes.find((item) => item.id === id)
    if (node?.type === 'output.viewport' || node?.type === 'output.export') continue
    counts[entry.status]++
  }

  return { targetId: target?.id ?? null, nodes, counts }
}

/** Status for én node, med grafen som kontekst. */
export function lottieInfoForNode(graph: Graph, nodeId: string): LottieNodeInfo | undefined {
  return analyzeLottie(graph).nodes[nodeId]
}
