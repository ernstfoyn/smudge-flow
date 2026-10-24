import type {
  Graph,
  GraphEdge,
  GraphNode,
  GraphSettings,
  GroupInput,
  GroupOutput,
  NodeId,
  ParamDef,
  PortDef,
  Subgraph,
  ValueType,
} from './types'
import { registry as defaultRegistry } from '../nodes'
import type { NodeResolver } from './types'

export const DEFAULT_SETTINGS: GraphSettings = {
  width: 960,
  height: 960,
  fps: 60,
  frames: 360,
  loop: true,
  background: '#0b0b12',
  previewScale: 1,
  exportFormat: 'mp4',
}

/** Prefiks for porter som driver en parameter i stedet for å lege en verdi. */
export const PARAM_PORT_PREFIX = 'param:'

export function createGraph(settings: Partial<GraphSettings> = {}): Graph {
  return {
    version: 1,
    nodes: [],
    edges: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
}

export function createNode(
  type: string,
  id: NodeId,
  position: { x: number; y: number },
  params: Record<string, unknown> = {},
): GraphNode {
  return {
    id,
    type,
    title: type,
    params,
    tracks: {},
    lfo: {},
    position,
    enabled: true,
  }
}

export function createEdge(
  source: NodeId,
  sourcePort: string,
  target: NodeId,
  targetPort: string,
  kind: 'value' | 'param' = 'value',
): GraphEdge {
  return {
    id: `${source}.${sourcePort}->${target}.${targetPort}`,
    source,
    sourcePort,
    target,
    targetPort,
    kind,
    ...(kind === 'param' ? { targetParam: targetPort.slice(PARAM_PORT_PREFIX.length) } : {}),
  }
}

/**
 * Port-kompatibilitet. Bevisst konservativ, med ett unntak:
 * «drawable» godtar alt som kan tegnes — lerret, bilde og video.
 */
export function canConnectTypes(source: ValueType, target: ValueType): boolean {
  if (source === target) return true
  if (target === 'drawable') return source === 'canvas' || source === 'drawable'
  if (source === 'drawable' && target === 'canvas') return true
  return false
}

/** Finner port-definisjonen for en kant. */
export function findPort(ports: readonly PortDef[], portId: string): PortDef | undefined {
  return ports.find((p) => p.id === portId)
}

/**
 * Effektive porter for en node.
 * Gruppe-noder har dynamiske porter utledet fra det eksponerte innholdet.
 */
export function nodePorts(
  node: GraphNode,
  resolver: NodeResolver = defaultRegistry,
): { inputs: PortDef[]; outputs: PortDef[] } {
  if (node.type === 'group' && node.group) {
    return {
      inputs: node.group.inputs.map((g) => ({
        id: g.id,
        label: g.name,
        type: g.type,
        multiple: g.multiple,
      })),
      outputs: node.group.outputs.map((g) => ({
        id: g.id,
        label: g.name,
        type: g.type,
      })),
    }
  }
  const def = resolver.get(node.type)
  return { inputs: [...def.inputs], outputs: [...def.outputs] }
}

/** Parametere for en node. Gruppe-noder har ingen egne parametere. */
export function nodeParamDefs(
  node: GraphNode,
  resolver: NodeResolver = defaultRegistry,
): ParamDef[] {
  if (node.type === 'group') return []
  return [...resolver.get(node.type).params]
}

/** Alle noder som er uten inngående kant (dvs. kilder). */
export function sourceNodes(graph: Graph): GraphNode[] {
  const targets = new Set(graph.edges.map((e) => e.target))
  return graph.nodes.filter((n) => !targets.has(n.id))
}

/** Alle noder som ikke går videre til noe annet (dvs. utganger). */
export function sinkNodes(graph: Graph): GraphNode[] {
  const sources = new Set(graph.edges.map((e) => e.source))
  return graph.nodes.filter((n) => !sources.has(n.id))
}

export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graph, null, 2)
}

export function deserializeGraph(raw: string): Graph {
  const parsed = JSON.parse(raw) as Partial<Graph>
  return {
    version: 1,
    nodes: parsed.nodes ?? [],
    edges: parsed.edges ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  }
}

/**
 * Gir en subgraf unike node-ID-er.
 *
 * Nødvendig når en gruppe kopieres: uten dette deler kopiene de samme
 * lerretene og den samme tilstanden, og den ene kopien ville overskreve
 * den andre. Med unike ID-er blir hver kopi en selvstendig instans —
 * akkurat som du vil ha det når du bruker samme behandling på nytt innhold.
 */
export function rekeySubgraph(group: Subgraph, prefix: string): Subgraph {
  const idMap = new Map<NodeId, NodeId>()
  for (const node of group.nodes) idMap.set(node.id, `${prefix}/${node.id}`)

  // Per-lag-innstillinger er nøklet på kant-id. Når kantene får nye ID-er,
  // må nøklene følge etter — ellers ville en kopi miste laginnstillingene.
  const edgeIdMap = new Map<string, string>()

  const edges = group.edges.map((edge) => {
    const id = `${idMap.get(edge.source)}-${edge.sourcePort}->${idMap.get(edge.target)}-${edge.targetPort}`
    edgeIdMap.set(edge.id, id)
    return {
      ...edge,
      id,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }
  })

  return {
    nodes: group.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      params: remapLayerKeys(node.params, edgeIdMap),
    })),
    edges,
    inputs: group.inputs.map((input) => ({
      ...input,
      targetNode: idMap.get(input.targetNode) ?? input.targetNode,
    })),
    outputs: group.outputs.map((output) => ({
      ...output,
      sourceNode: idMap.get(output.sourceNode) ?? output.sourceNode,
    })),
  }
}

/** Flytter `params.layers`-nøkler over til nye kant-ID-er. */
function remapLayerKeys(
  params: Record<string, unknown>,
  edgeIdMap: Map<string, string>,
): Record<string, unknown> {
  const layers = params?.layers
  if (!layers || typeof layers !== 'object' || Array.isArray(layers)) return params

  const remapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(layers as Record<string, unknown>)) {
    remapped[edgeIdMap.get(key) ?? key] = value
  }
  return { ...params, layers: remapped }
}

export interface GroupResult {
  node: GraphNode
  edges: GraphEdge[]
}

/**
 * Lager en gruppe-node av et utvalg noder.
 *
 * Kantene som krysser grensen blir eksponert som innganger/utganger, slik at
 * gruppen kan kobles inn i en større graf og gjenbrukes med nytt innhold.
 *
 * Regel for innganger: én gruppe-inngang per *intern* målport.
 *  - Er den interne porten multi-input (f.eks. lagstabelen), blir gruppe-
 *    inngangen også multi, og alle eksterne kilder videreføres som et array.
 *  - Ellers vinner den siste eksterne kilden, akkurat som i den indre grafen.
 */
export function createGroupFromSelection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selection: NodeId[],
  groupId: NodeId,
  resolver: NodeResolver = defaultRegistry,
): GroupResult {
  const selected = new Set(selection)
  const innerNodes = nodes.filter((n) => selected.has(n.id))
  const innerIds = new Set(innerNodes.map((n) => n.id))

  const innerEdges = edges.filter((e) => innerIds.has(e.source) && innerIds.has(e.target))
  const crossing = edges.filter((e) => innerIds.has(e.source) !== innerIds.has(e.target))

  const inputs: GroupInput[] = []
  const outputs: GroupOutput[] = []

  // Samle kryssende innkoblinger per intern målport.
  const incomingByPort = new Map<string, GraphEdge[]>()
  const outgoingEdges: GraphEdge[] = []

  for (const edge of crossing) {
    if (innerIds.has(edge.target)) {
      const key = `${edge.target}\u0000${edge.targetPort}`
      const list = incomingByPort.get(key)
      if (list) list.push(edge)
      else incomingByPort.set(key, [edge])
    } else {
      outgoingEdges.push(edge)
    }
  }

  const inputByPort = new Map<string, GroupInput>()
  for (const [key, list] of incomingByPort) {
    const [targetNode, targetPort] = key.split('\u0000')
    const target = nodes.find((n) => n.id === targetNode)
    const port = target ? nodePorts(target, resolver).inputs.find((p) => p.id === targetPort) : undefined
    const source = nodes.find((n) => n.id === list[list.length - 1].source)
    const outPort = source
      ? nodePorts(source, resolver).outputs.find((p) => p.id === list[list.length - 1].sourcePort)
      : undefined

    const groupInput: GroupInput = {
      id: `in-${inputs.length}`,
      name: source?.title ?? list[list.length - 1].source,
      type: outPort?.type ?? 'canvas',
      targetNode,
      targetPort,
      multiple: port?.multiple ?? false,
    }
    inputByPort.set(key, groupInput)
    inputs.push(groupInput)
  }

  // Innen → uten: blir en eksponert utgang.
  const outputByEdge = new Map<GraphEdge, GroupOutput>()
  for (const edge of outgoingEdges) {
    const source = nodes.find((n) => n.id === edge.source)
    const outPort = source
      ? nodePorts(source, resolver).outputs.find((p) => p.id === edge.sourcePort)
      : undefined
    const groupOutput: GroupOutput = {
      id: `out-${outputs.length}`,
      name: source?.title ?? edge.source,
      type: outPort?.type ?? 'canvas',
      sourceNode: edge.source,
      sourcePort: edge.sourcePort,
    }
    outputByEdge.set(edge, groupOutput)
    outputs.push(groupOutput)
  }

  // En node som ikke fører videre inni gruppen, er et resultat.
  // Eksponerer vi utgangen automatisk, ellers blir gruppen umulig å bruke.
  for (const node of innerNodes) {
    const feedsSomething = innerEdges.some((e) => e.source === node.id)
    if (feedsSomething) continue

    for (const port of nodePorts(node, resolver).outputs) {
      if (outputs.some((o) => o.sourceNode === node.id && o.sourcePort === port.id)) continue
      const groupOutput: GroupOutput = {
        id: `out-${outputs.length}`,
        name: port.label,
        type: port.type,
        sourceNode: node.id,
        sourcePort: port.id,
      }
      outputs.push(groupOutput)
    }
  }

  const position = {
    x: innerNodes.reduce((sum, n) => sum + n.position.x, 0) / Math.max(1, innerNodes.length),
    y: innerNodes.reduce((sum, n) => sum + n.position.y, 0) / Math.max(1, innerNodes.length),
  }

  const groupNode: GraphNode = {
    id: groupId,
    type: 'group',
    title: 'Gruppe',
    params: {},
    tracks: {},
    lfo: {},
    position,
    enabled: true,
    group: { nodes: innerNodes, edges: innerEdges, inputs, outputs },
  }

  // Kantene utenfor gruppen skrives om til å peke på de eksponerte portene.
  const rewritten: GraphEdge[] = []

  for (const [key, list] of incomingByPort) {
    const groupInput = inputByPort.get(key)!
    if (groupInput.multiple) {
      // Alle kildene videreføres.
      for (const edge of list) {
        rewritten.push({
          id: `${edge.source}.${edge.sourcePort}->${groupId}.${groupInput.id}`,
          source: edge.source,
          sourcePort: edge.sourcePort,
          target: groupId,
          targetPort: groupInput.id,
          kind: 'value',
        })
      }
    } else {
      // Én verdi: den siste kilden vinner, som i den indre grafen.
      const edge = list[list.length - 1]
      rewritten.push({
        id: `${edge.source}.${edge.sourcePort}->${groupId}.${groupInput.id}`,
        source: edge.source,
        sourcePort: edge.sourcePort,
        target: groupId,
        targetPort: groupInput.id,
        kind: 'value',
      })
    }
  }

  for (const edge of outgoingEdges) {
    const groupOutput = outputByEdge.get(edge)!
    rewritten.push({
      id: `${groupId}.${groupOutput.id}->${edge.target}.${edge.targetPort}`,
      source: groupId,
      sourcePort: groupOutput.id,
      target: edge.target,
      targetPort: edge.targetPort,
      kind: 'value',
    })
  }

  // Kantene som ikke berører gruppen beholdes uendret.
  for (const edge of edges) {
    const touchesGroup =
      innerIds.has(edge.source) || innerIds.has(edge.target) || edge.source === groupId || edge.target === groupId
    if (!touchesGroup) rewritten.push(edge)
  }

  return { node: groupNode, edges: rewritten }
}

/**
 * Eksploderer en gruppe-node tilbake til enkelte noder i foreldregrafen.
 *
 * Eksponerte innganger kobles direkte til sine interne noder, og eksponerte
 * utganger kobles direkte fra sine interne noder.
 */
export function explodeGroup(
  nodes: GraphNode[],
  edges: GraphEdge[],
  groupNode: GraphNode,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const group = groupNode.group
  if (!group) return { nodes, edges }

  // Kantene som går inn i gruppen (eksterne kilder) og ut av den.
  const externalEdges = edges.filter((e) => e.target === groupNode.id)
  const fromGroupEdges = edges.filter((e) => e.source === groupNode.id)
  const untouched = edges.filter(
    (e) => e.source !== groupNode.id && e.target !== groupNode.id,
  )

  const externalByInput = new Map<string, GraphEdge[]>()
  for (const edge of externalEdges) {
    const list = externalByInput.get(edge.targetPort)
    if (list) list.push(edge)
    else externalByInput.set(edge.targetPort, [edge])
  }

  const rewritten: GraphEdge[] = [...untouched]

  // Interne kanter. De som skjuler en eksponert inngang, byttes ut med
  // den eksterne kilden.
  const handledPorts = new Set<string>()

  for (const edge of group.edges) {
    const key = `${edge.target}\u0000${edge.targetPort}`
    const input = group.inputs.find((i) => `${i.targetNode}\u0000${i.targetPort}` === key)

    if (!input) {
      rewritten.push(edge)
      continue
    }

    const external = externalByInput.get(input.id) ?? []
    if (!external.length) {
      rewritten.push(edge)
      continue
    }

    handledPorts.add(key)
    const chosen = input.multiple ? external : [external[external.length - 1]]
    for (const ext of chosen) {
      rewritten.push({
        id: `${ext.source}.${ext.sourcePort}->${edge.target}.${edge.targetPort}`,
        source: ext.source,
        sourcePort: ext.sourcePort,
        target: edge.target,
        targetPort: edge.targetPort,
        kind: 'value',
      })
    }
  }

  // Eksponerte innganger uten en intern kant: koble den eksterne kilden inn.
  for (const input of group.inputs) {
    const key = `${input.targetNode}\u0000${input.targetPort}`
    if (handledPorts.has(key)) continue
    if (group.edges.some((e) => e.target === input.targetNode && e.targetPort === input.targetPort)) {
      continue
    }
    const external = externalByInput.get(input.id) ?? []
    const chosen = input.multiple ? external : [external[external.length - 1]]
    for (const ext of chosen) {
      rewritten.push({
        id: `${ext.source}.${ext.sourcePort}->${input.targetNode}.${input.targetPort}`,
        source: ext.source,
        sourcePort: ext.sourcePort,
        target: input.targetNode,
        targetPort: input.targetPort,
        kind: 'value',
      })
    }
  }

  // Kantene fra gruppen til omverdenen, kobles fra de interne nodene.
  for (const edge of fromGroupEdges) {
    const output = group.outputs.find((o) => o.id === edge.sourcePort)
    if (!output) continue
    rewritten.push({
      id: `${output.sourceNode}.${output.sourcePort}->${edge.target}.${edge.targetPort}`,
      source: output.sourceNode,
      sourcePort: output.sourcePort,
      target: edge.target,
      targetPort: edge.targetPort,
      kind: 'value',
    })
  }

  // Fjern duplikater (samme kant kan skapes to ganger).
  const seen = new Set<string>()
  const unique = rewritten.filter((e) => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  return {
    nodes: [...nodes.filter((n) => n.id !== groupNode.id), ...group.nodes],
    edges: unique,
  }
}
