import type { GraphEdge, GraphNode, GroupInput, GroupOutput, NodeId } from '../engine/types'
import { createGroupFromSelection, nodePorts } from '../engine/graph'
import { registry } from '../nodes'
import { BLOCK_VERSION, type BlockTemplate } from './types'

/**
 * Bygger en blokk i kode.
 *
 * Brukes til de innebygde oppsettene, og som en bekvemmelighet når man
 * skriver egne blokker. API-et er bevisst likt det man gjør i UI-en:
 * legg til noder, koble dem, eksponer porter.
 */
export class TemplateBuilder {
  private nodes: GraphNode[] = []
  private edges: GraphEdge[] = []
  private inputs: GroupInput[] = []
  private outputs: GroupOutput[] = []
  private counter = 0

  /** Legger til en node med parameterdefaults fra registret. */
  node(
    type: string,
    params: Record<string, unknown> = {},
    position: { x: number; y: number } = { x: 0, y: 0 },
  ): string {
    const def = registry.get(type)
    const id = `${type}-${this.counter++}`
    const merged: Record<string, unknown> = {}
    for (const p of def.params) merged[p.key] = p.default
    Object.assign(merged, params)

    this.nodes.push({
      id,
      type,
      title: def.label,
      params: merged,
      tracks: {},
      lfo: {},
      position,
      enabled: true,
    })
    return id
  }

  connect(source: string, sourcePort: string, target: string, targetPort: string): void {
    this.edges.push({
      id: `${source}.${sourcePort}->${target}.${targetPort}`,
      source,
      sourcePort,
      target,
      targetPort,
      kind: 'value',
    })
  }

  /** Koble en tallkilde til en parameter i en annen node. */
  drive(source: string, sourcePort: string, target: string, paramKey: string): void {
    this.edges.push({
      id: `${source}.${sourcePort}->${target}.param:${paramKey}`,
      source,
      sourcePort,
      target,
      targetPort: `param:${paramKey}`,
      kind: 'param',
      targetParam: paramKey,
    })
  }

  /** Eksponerer en intern port som inngang. Kan overstyres utenfra. */
  exposeInput(nodeId: string, portId: string, name?: string): void {
    if (this.inputs.some((i) => i.targetNode === nodeId && i.targetPort === portId)) return
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const port = nodePorts(node).inputs.find((p) => p.id === portId)
    if (!port) return

    this.inputs.push({
      id: `in-${this.inputs.length}`,
      name: name ?? port.label,
      type: port.type,
      targetNode: nodeId,
      targetPort: portId,
      multiple: port.multiple,
    })
  }

  /** Eksponerer en intern port som utgang. */
  exposeOutput(nodeId: string, portId: string, name?: string): void {
    if (this.outputs.some((o) => o.sourceNode === nodeId && o.sourcePort === portId)) return
    const node = this.nodes.find((n) => n.id === nodeId)
    if (!node) return
    const port = nodePorts(node).outputs.find((p) => p.id === portId)
    if (!port) return

    this.outputs.push({
      id: `out-${this.outputs.length}`,
      name: name ?? port.label,
      type: port.type,
      sourceNode: nodeId,
      sourcePort: portId,
    })
  }

  build(name: string, description?: string, category?: string): BlockTemplate {
    return {
      id: `builtin-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      description,
      category,
      version: BLOCK_VERSION,
      nodes: structuredClone(this.nodes),
      edges: structuredClone(this.edges),
      inputs: structuredClone(this.inputs),
      outputs: structuredClone(this.outputs),
      builtin: true,
    }
  }
}

/**
 * Lager en blokk av et utvalg noder i en eksisterende graf.
 *
 * To ting skjer automatisk, fordi det er det brukeren egentlig vil:
 *
 * 1. **Innganger.** Hvis markeringen ikke har noen kryssende kant inn i
 *    seg, blir innholdskildene (nodene uten egne innganger) holdt utenfor
 *    blokken. Da blir de eksponert som innganger — akkurat det som gjør at
 *    blokken kan brukes på nytt innhold.
 *
 * 2. **Utganger.** En node som ikke fører videre inni blokken, er et
 *    resultat, og utgangen eksponeres automatisk.
 */
export function blockFromSelection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selection: NodeId[],
  name: string,
  description?: string,
): { template: BlockTemplate; remaining: GraphEdge[]; inner: GraphNode[]; groupNode: GraphNode } {
  const selected = new Set(selection)
  const innerIds = new Set(nodes.filter((n) => selected.has(n.id)).map((n) => n.id))

  // Finnes det allerede en kryssende kant inn i markeringen?
  const hasCrossingInput = edges.some(
    (e) => innerIds.has(e.target) && !innerIds.has(e.source),
  )

  // Hvis ikke: finn innholdskildene (noder uten egne innganger) som
  // føder markeringen, og hold dem utenfor.
  const effective = new Set(selected)
  if (!hasCrossingInput) {
    const contentRoots = nodes.filter(
      (n) =>
        innerIds.has(n.id) &&
        !edges.some((e) => e.target === n.id) &&
        nodePorts(n).inputs.length === 0,
    )
    for (const root of contentRoots) effective.delete(root.id)
  }

  const picked = [...effective]
  const { node, edges: rewritten } = createGroupFromSelection(nodes, edges, picked, 'block')

  return {
    template: {
      id: `block-${Date.now().toString(36)}`,
      name,
      description,
      version: BLOCK_VERSION,
      nodes: structuredClone(node.group?.nodes ?? []),
      edges: structuredClone(node.group?.edges ?? []),
      inputs: structuredClone(node.group?.inputs ?? []),
      outputs: structuredClone(node.group?.outputs ?? []),
      createdAt: new Date().toISOString(),
    },
    inner: node.group?.nodes ?? [],
    remaining: rewritten,
    groupNode: node,
  }
}

/**
 * Standardkilde per verditype.
 *
 * Uten typebevissthet ville en 3D-inngang fått en gradient inn — feil
 * domene. Nå får hver port et standardinnhold som faktisk passer.
 */
const DEFAULT_SOURCES: Record<
  string,
  { type: string; params: Record<string, unknown>; title: string }
> = {
  canvas: {
    type: 'source.gradient',
    title: 'Standard',
    params: { fill: 'radial', colorA: '#4a5160', colorB: '#1b1f27' },
  },
  object3d: {
    type: 'source.mesh3D',
    title: 'Standard 3D',
    params: { shape: 'icosahedron', size: 0.35, color: '#7ad7ff' },
  },
  camera: { type: 'scene.camera', title: 'Standard kamera', params: {} },
  lights: { type: 'scene.lights', title: 'Standard lys', params: {} },
}

/**
 * Sørger for at hver eksponert inngang har en standardverdi inne i blokken.
 *
 * Uten dette ville en blokk uten tilkoblet innhold feile med «mangler
 * input». Med en standard kan blokken lastes inn og virke med én gang,
 * og en ekstern kilde kan overstyre den.
 */
export function withDefaultSources(template: BlockTemplate): BlockTemplate {
  const result = structuredClone(template)
  let counter = 0

  for (const input of result.inputs) {
    const hasDefault = result.edges.some(
      (e) => e.target === input.targetNode && e.targetPort === input.targetPort,
    )
    if (hasDefault) continue

    const spec = DEFAULT_SOURCES[input.type]
    // Ukjent type: heller ingen standard enn en som ikke passer porten.
    if (!spec) continue

    const def = registry.get(spec.type)
    const params: Record<string, unknown> = {}
    for (const p of def.params) params[p.key] = p.default
    // Et synlig standardinnhold, slik at blokken virker med én gang
    // og effekten kan ses, før brukeren kobler sitt eget innhold.
    Object.assign(params, spec.params)

    const id = `default-${counter++}`
    result.nodes.push({
      id,
      type: spec.type,
      title: spec.title,
      params,
      tracks: {},
      lfo: {},
      position: { x: -320, y: 0 },
      enabled: true,
    })
    result.edges.push({
      id: `${id}.out->${input.targetNode}.${input.targetPort}`,
      source: id,
      sourcePort: 'out',
      target: input.targetNode,
      targetPort: input.targetPort,
      kind: 'value',
    })
  }

  return result
}
