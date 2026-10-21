import type { Graph, GraphEdge, GraphNode, NodeId } from './types'

export interface TopoResult {
  /** Noder i evalueringsrekkefølge (kildene først). */
  order: NodeId[]
  errors: string[]
}

/**
 * Kahn på delgrafen som mater `targets`.
 *
 * - Deterministisk: noder med lik indegree sorteres etter rekkefølgen i nodes.
 * - Kilder som ikke har noen inngående kant, evalueres først.
 * - Syklus gir en lesbar feilmelding i stedet for en evig løkke.
 *
 * Både verdi-kanter og parameter-kanter er avhengigheter: en node som
 * driver en parameter må evalueres etter kilden sin.
 */
export function topoSortScope(
  nodes: GraphNode[],
  edges: GraphEdge[],
  targets: NodeId[],
): TopoResult {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const upstream = new Map<NodeId, NodeId[]>()
  const downstream = new Map<NodeId, NodeId[]>()

  for (const n of nodes) {
    upstream.set(n.id, [])
    downstream.set(n.id, [])
  }

  for (const e of edges) {
    const src = byId.get(e.source)
    const dst = byId.get(e.target)
    if (!src || !dst) continue
    // Deaktiverte noder bryter kjeden; verdiene faller tilbake til standard.
    if (src.enabled === false || dst.enabled === false) continue
    upstream.get(e.target)!.push(e.source)
    downstream.get(e.source)!.push(e.target)
  }

  // 1) Finn bare nodene som faktisk trengs for målene.
  const needed = new Set<NodeId>()
  const stack = [...targets]
  while (stack.length) {
    const id = stack.pop()!
    if (needed.has(id) || !byId.has(id)) continue
    needed.add(id)
    for (const p of upstream.get(id)!) stack.push(p)
  }

  // 2) Kahn med stabil sortering.
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const indegree = new Map<NodeId, number>()
  for (const id of needed) {
    indegree.set(id, upstream.get(id)!.filter((p) => needed.has(p)).length)
  }

  const ready = [...needed].filter((id) => indegree.get(id) === 0)
  ready.sort((a, b) => index.get(a)! - index.get(b)!)

  const order: NodeId[] = []
  while (ready.length) {
    const id = ready.shift()!
    order.push(id)
    for (const next of downstream.get(id)!) {
      if (!needed.has(next)) continue
      const left = indegree.get(next)! - 1
      indegree.set(next, left)
      if (left === 0) {
        ready.push(next)
        ready.sort((a, b) => index.get(a)! - index.get(b)!)
      }
    }
  }

  const errors =
    order.length === needed.size
      ? []
      : [
          'Grafen inneholder en syklus: ' +
            [...needed].filter((id) => !order.includes(id)).join(' → '),
        ]

  return { order, errors }
}

/** Innpakning for en hel graf. */
export function topoSort(graph: Graph, targets: NodeId[]): TopoResult {
  return topoSortScope(graph.nodes, graph.edges, targets)
}

/**
 * Sjekker om en kant source → target ville skapt en syklus.
 * Brukes i UI-en før en ulovlig kant i det hele tatt opprettes.
 */
export function wouldCreateCycle(graph: Graph, source: NodeId, target: NodeId): boolean {
  if (source === target) return true

  const upstream = new Map<NodeId, NodeId[]>()
  for (const e of graph.edges) {
    const list = upstream.get(e.target) ?? []
    list.push(e.source)
    upstream.set(e.target, list)
  }

  const seen = new Set<NodeId>()
  const stack: NodeId[] = [source]
  while (stack.length) {
    const id = stack.pop()!
    if (id === target) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...(upstream.get(id) ?? []))
  }
  return false
}
