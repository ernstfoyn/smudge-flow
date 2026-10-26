import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphEdge, GraphNode } from '../src/engine/types'

function node(id: string, type: string): GraphNode {
  return { id, type, title: id, params: {}, position: { x: 0, y: 0 } }
}

function edge(id: string, source: string, target: string, targetPort = 'in', kind?: GraphEdge['kind']): GraphEdge {
  return { id, source, sourcePort: 'out', target, targetPort, kind }
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes,
    edges,
  }
}

describe('sett inn node på kobling', () => {
  beforeEach(() => {
    useGraphStore.getState().setGraph(
      graph(
        [node('gradient', 'source.gradient'), node('motion', 'source.motionGraphics'), node('stack', 'composite.stack')],
        [
          edge('e1', 'gradient', 'stack'),
          edge('e2', 'motion', 'stack'),
        ],
      ),
    )
    useGraphStore.getState().setSelection([])
  })

  it('deler koblingen og kobler ny node på begge sider', () => {
    const id = useGraphStore.getState().insertNodeOnEdge('e1', 'modifier.raster')
    expect(id).toBeTruthy()

    const g = useGraphStore.getState().graph
    expect(g.nodes).toHaveLength(4)
    expect(g.edges).toHaveLength(3)
    expect(g.edges.some((e) => e.source === 'gradient' && e.target === id && e.targetPort === 'in')).toBe(true)
    expect(g.edges.some((e) => e.source === id && e.target === 'stack' && e.sourcePort === 'out')).toBe(true)
    expect(g.edges.some((e) => e.id === 'e1')).toBe(false)
    expect(useGraphStore.getState().selected).toBe(id)
  })

  it('beholder lagrekkefølgen i en flerinngang', () => {
    const id = useGraphStore.getState().insertNodeOnEdge('e1', 'modifier.raster')!
    const intoStack = useGraphStore
      .getState()
      .graph.edges.filter((e) => e.target === 'stack')
      .map((e) => e.source)
    expect(intoStack).toEqual([id, 'motion'])
  })

  it('velger kompatible porter på en node med flere porter', () => {
    useGraphStore.getState().setGraph(
      graph(
        [node('gradient', 'source.gradient'), node('view', 'output.viewport')],
        [edge('e', 'gradient', 'view', 'frame')],
      ),
    )
    const id = useGraphStore.getState().insertNodeOnEdge('e', 'modifier.pattern')
    expect(id).toBeTruthy()
    const g = useGraphStore.getState().graph
    expect(g.edges.some((e) => e.source === id && e.target === 'view' && e.targetPort === 'frame')).toBe(true)
  })

  it('avviser noder uten kompatible porter', () => {
    const id = useGraphStore.getState().insertNodeOnEdge('e1', 'source.text2D')
    expect(id).toBeNull()
    expect(useGraphStore.getState().notice).toMatch(/kompatible/i)
    expect(useGraphStore.getState().graph.edges).toHaveLength(2)
  })

  it('avviser parameter- og styringskoblinger', () => {
    useGraphStore.getState().setGraph(
      graph(
        [node('signal', 'curve.signal'), node('raster', 'modifier.raster')],
        [edge('p', 'signal', 'raster', 'param:cellSize', 'param')],
      ),
    )
    expect(useGraphStore.getState().insertNodeOnEdge('p', 'value.math')).toBeNull()
    expect(useGraphStore.getState().notice).toMatch(/verdikobling/i)
  })

  it('setter posisjonene i én oppdatering', () => {
    useGraphStore.getState().setNodePositions({
      gradient: { x: 10, y: 20 },
      motion: { x: 30, y: 40 },
    })
    const g = useGraphStore.getState().graph
    expect(g.nodes.find((n) => n.id === 'gradient')?.position).toEqual({ x: 10, y: 20 })
    expect(g.nodes.find((n) => n.id === 'motion')?.position).toEqual({ x: 30, y: 40 })
    expect(useGraphStore.getState().notice).toMatch(/Ryddet opp/i)
  })
})
