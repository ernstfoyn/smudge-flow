import type { Graph, GraphNode, NodeId } from './types'

export interface NodeSize {
  width: number
  height: number
}

const DEFAULT_SIZE: NodeSize = { width: 232, height: 180 }
const COLUMN_GAP = 90
const ROW_GAP = 36

/**
 * Legger grafen ut i kolonner etter avhengigheter.
 *
 * Noder på samme nivå stables vertikalt, og hver kolonne sentreres. Alle
 * kanttyper teller som avhengigheter, så signaler og parameterkilder havner
 * til venstre for nodene de styrer.
 *
 * `sizes` kommer fra React Flow sine målte nodekort. Uten mål brukes et
 * fornuftig standardkort.
 */
export function layoutPositions(
  graph: Graph,
  sizes: ReadonlyMap<NodeId, NodeSize> = new Map(),
): Record<NodeId, { x: number; y: number }> {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const incoming = new Map<NodeId, NodeId[]>()
  const outgoing = new Map<NodeId, NodeId[]>()

  for (const node of graph.nodes) {
    incoming.set(node.id, [])
    outgoing.set(node.id, [])
  }
  for (const edge of graph.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue
    incoming.get(edge.target)!.push(edge.source)
    outgoing.get(edge.source)!.push(edge.target)
  }

  const indegree = new Map<NodeId, number>()
  for (const node of graph.nodes) {
    indegree.set(node.id, new Set(incoming.get(node.id)).size)
  }

  const level = new Map<NodeId, number>()
  const ready = graph.nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((n) => n.id)
  for (const id of ready) level.set(id, 0)

  while (ready.length) {
    const id = ready.shift()!
    const base = level.get(id) ?? 0
    for (const next of new Set(outgoing.get(id))) {
      level.set(next, Math.max(level.get(next) ?? 0, base + 1))
      const left = (indegree.get(next) ?? 1) - 1
      indegree.set(next, left)
      if (left === 0) ready.push(next)
    }
  }

  // En syklus skal ikke kunne oppstå, men gi en forutsigbar plassering hvis
  // grafen likevel er skadet.
  for (const node of graph.nodes) {
    if (!level.has(node.id)) level.set(node.id, 0)
  }

  const columns = new Map<number, GraphNode[]>()
  for (const node of graph.nodes) {
    const index = level.get(node.id) ?? 0
    const list = columns.get(index)
    if (list) list.push(node)
    else columns.set(index, [node])
  }

  const positions: Record<NodeId, { x: number; y: number }> = {}
  let x = 0

  for (const index of [...columns.keys()].sort((a, b) => a - b)) {
    const column = columns.get(index)!
    column.sort(
      (a, b) =>
        a.position.y - b.position.y ||
        a.position.x - b.position.x ||
        a.title.localeCompare(b.title, 'nb'),
    )

    const columnWidth = Math.max(
      ...column.map((node) => (sizes.get(node.id) ?? DEFAULT_SIZE).width),
    )
    const columnHeight =
      column.reduce((sum, node) => sum + (sizes.get(node.id) ?? DEFAULT_SIZE).height, 0) +
      ROW_GAP * Math.max(0, column.length - 1)

    let y = -columnHeight / 2
    for (const node of column) {
      const size = sizes.get(node.id) ?? DEFAULT_SIZE
      positions[node.id] = {
        x: x + (columnWidth - size.width) / 2,
        y,
      }
      y += size.height + ROW_GAP
    }

    x += columnWidth + COLUMN_GAP
  }

  return positions
}
