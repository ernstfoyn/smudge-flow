import type { Graph, GraphNode, NodeId } from './types'

export interface BranchSummary {
  /** Noder i grenen, fra dypeste kilde til utgangen. */
  nodes: GraphNode[]
  count: number
  /** Kort kjede, f.eks. «Gradient → Raster → Mosaikk». */
  label: string
}

/**
 * Alle verdinoder som ligger foran en node, i rekkefølge fra kilden til
 * utgangen. Parameter- og styringskoblinger teller ikke som bildestrøm.
 *
 * Funksjonen brukes til å vise at et lag i en lagstabel er en hel gren, ikke
 * bare den siste effektnoden.
 */
export function upstreamBranch(graph: Graph, nodeId: NodeId): GraphNode[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const incoming = new Map<NodeId, NodeId[]>()
  for (const edge of graph.edges) {
    if (edge.kind === 'param' || edge.kind === 'drive') continue
    const list = incoming.get(edge.target)
    if (list) list.push(edge.source)
    else incoming.set(edge.target, [edge.source])
  }

  const result: GraphNode[] = []
  const visited = new Set<NodeId>()

  const visit = (id: NodeId) => {
    if (visited.has(id)) return
    visited.add(id)
    for (const source of incoming.get(id) ?? []) visit(source)
    const node = byId.get(id)
    if (node) result.push(node)
  }

  visit(nodeId)
  return result
}

export function branchSummary(graph: Graph, nodeId: NodeId, max = 5): BranchSummary {
  const nodes = upstreamBranch(graph, nodeId)
  const names = nodes.map((node) => node.title)
  let label = ''
  if (names.length <= max) {
    label = names.join(' → ')
  } else {
    const head = names.slice(0, max - 2)
    label = [...head, '…', names[names.length - 1]].join(' → ')
  }
  return { nodes, count: nodes.length, label }
}
