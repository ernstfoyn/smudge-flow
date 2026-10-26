import { describe, expect, it } from 'vitest'
import { branchSummary, upstreamBranch } from '../src/engine/branch'
import type { Graph, GraphNode } from '../src/engine/types'

function node(id: string, title = id): GraphNode {
  return { id, type: 'modifier.raster', title, params: {}, position: { x: 0, y: 0 } }
}

function graph(nodes: GraphNode[], edges: Graph['edges']): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes,
    edges,
  }
}

describe('grenen før et lag', () => {
  const g = graph(
    [node('gradient', 'Gradient'), node('raster', 'Raster'), node('pattern', 'Fragmentprisme'), node('stack', 'Lagstabel')],
    [
      { id: 'e1', source: 'gradient', sourcePort: 'out', target: 'raster', targetPort: 'in' },
      { id: 'e2', source: 'raster', sourcePort: 'out', target: 'pattern', targetPort: 'in' },
      { id: 'e3', source: 'pattern', sourcePort: 'out', target: 'stack', targetPort: 'in' },
    ],
  )

  it('finner hele kjeden fra kilden til utgangen', () => {
    expect(upstreamBranch(g, 'pattern').map((n) => n.id)).toEqual([
      'gradient',
      'raster',
      'pattern',
    ])
    expect(branchSummary(g, 'pattern')).toMatchObject({
      count: 3,
      label: 'Gradient → Raster → Fragmentprisme',
    })
  })

  it('tar med forgreninger som møtes før utgangen', () => {
    const merged = graph(
      [node('a', 'A'), node('b', 'B'), node('blend', 'Blanding'), node('out', 'Ut')],
      [
        { id: 'e1', source: 'a', sourcePort: 'out', target: 'blend', targetPort: 'base' },
        { id: 'e2', source: 'b', sourcePort: 'out', target: 'blend', targetPort: 'top' },
        { id: 'e3', source: 'blend', sourcePort: 'out', target: 'out', targetPort: 'in' },
      ],
    )
    expect(upstreamBranch(merged, 'out').map((n) => n.id)).toEqual(['a', 'b', 'blend', 'out'])
    expect(branchSummary(merged, 'out').label).toBe('A → B → Blanding → Ut')
  })

  it('ignorerer parameter- og styringskoblinger', () => {
    const withParam = graph(
      [node('image', 'Bilde'), node('raster', 'Raster'), node('signal', 'Signal')],
      [
        { id: 'e1', source: 'image', sourcePort: 'out', target: 'raster', targetPort: 'in' },
        { id: 'e2', source: 'signal', sourcePort: 'signal', target: 'raster', targetPort: 'param:cellSize', kind: 'param' },
        { id: 'e3', source: 'signal', sourcePort: 'signal', target: 'raster', targetPort: 'drive:all', kind: 'drive' },
      ],
    )
    expect(upstreamBranch(withParam, 'raster').map((n) => n.id)).toEqual(['image', 'raster'])
  })

  it('forkorter lange kjeder og tåler manglende node', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => node(`n${i}`, `N${i}`))
    const edges = nodes.slice(1).map((n, i) => ({
      id: `e${i}`,
      source: nodes[i].id,
      sourcePort: 'out',
      target: n.id,
      targetPort: 'in',
    }))
    const long = graph(nodes, edges)
    expect(branchSummary(long, 'n7', 5).label).toBe('N0 → N1 → N2 → … → N7')
    expect(upstreamBranch(long, 'mangler')).toEqual([])
  })
})
