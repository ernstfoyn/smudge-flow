import { describe, expect, it } from 'vitest'
import { layoutPositions } from '../src/engine/layout'
import type { Graph, GraphNode } from '../src/engine/types'

function node(id: string, x = 0, y = 0): GraphNode {
  return { id, type: 'modifier.raster', title: id, params: {}, position: { x, y } }
}

function graph(nodes: GraphNode[], edges: Graph['edges']): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes,
    edges,
  }
}

describe('automatisk layout', () => {
  it('legger kilder til venstre og forbrukere til høyre', () => {
    const g = graph(
      [node('a', 500, 500), node('b', 0, 0), node('out', 10, 10)],
      [
        { id: 'e1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' },
        { id: 'e2', source: 'b', sourcePort: 'out', target: 'out', targetPort: 'in' },
      ],
    )
    const p = layoutPositions(g)
    expect(p.a.x).toBeLessThan(p.b.x)
    expect(p.b.x).toBeLessThan(p.out.x)
  })

  it('stabler noder på samme nivå uten overlapp', () => {
    const g = graph(
      [node('a', 0, 300), node('b', 0, 0), node('out', 0, 0)],
      [
        { id: 'e1', source: 'a', sourcePort: 'out', target: 'out', targetPort: 'in' },
        { id: 'e2', source: 'b', sourcePort: 'out', target: 'out', targetPort: 'in' },
      ],
    )
    const sizes = new Map([
      ['a', { width: 232, height: 200 }],
      ['b', { width: 232, height: 120 }],
      ['out', { width: 232, height: 100 }],
    ])
    const p = layoutPositions(g, sizes)
    // B hadde lavest y og skal komme øverst.
    expect(p.b.y).toBeLessThan(p.a.y)
    expect(p.a.y - (p.b.y + 120)).toBeGreaterThanOrEqual(36)
  })

  it('tar med parameterkoblinger som avhengigheter', () => {
    const g = graph(
      [node('signal'), node('raster')],
      [{ id: 'p', source: 'signal', sourcePort: 'signal', target: 'raster', targetPort: 'param:cellSize', kind: 'param' }],
    )
    const p = layoutPositions(g)
    expect(p.signal.x).toBeLessThan(p.raster.x)
  })

  it('gir en posisjon til alle noder, også uten kanter', () => {
    const g = graph([node('a'), node('b'), node('c')], [])
    const p = layoutPositions(g)
    expect(Object.keys(p).sort()).toEqual(['a', 'b', 'c'])
    for (const value of Object.values(p)) {
      expect(Number.isFinite(value.x)).toBe(true)
      expect(Number.isFinite(value.y)).toBe(true)
    }
  })
})
