import { describe, expect, it } from 'vitest'
import { topoSort, wouldCreateCycle } from '../src/engine/topoSort'
import type { Graph } from '../src/engine/types'

function graph(): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes: [
      { id: 'a', type: 'source.gradient', title: 'A', params: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'source.gradient', title: 'B', params: {}, position: { x: 0, y: 0 } },
      { id: 'c', type: 'composite.blend', title: 'C', params: {}, position: { x: 0, y: 0 } },
      { id: 'd', type: 'output.viewport', title: 'D', params: {}, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: '1', source: 'a', sourcePort: 'out', target: 'c', targetPort: 'base' },
      { id: '2', source: 'b', sourcePort: 'out', target: 'c', targetPort: 'top' },
      { id: '3', source: 'c', sourcePort: 'out', target: 'd', targetPort: 'frame' },
    ],
  }
}

describe('topoSort', () => {
  it('sorterer kilder før forbrukere', () => {
    const { order, errors } = topoSort(graph(), ['d'])
    expect(errors).toEqual([])
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'))
  })

  it('evaluerer bare delgrafen som mater målet', () => {
    const g = graph()
    g.nodes.push({
      id: 'unrelated',
      type: 'source.gradient',
      title: 'U',
      params: {},
      position: { x: 0, y: 0 },
    })
    const { order } = topoSort(g, ['d'])
    expect(order).not.toContain('unrelated')
  })

  it('rapporterer sykluser', () => {
    const g = graph()
    g.edges.push({ id: '4', source: 'd', sourcePort: 'out', target: 'a', targetPort: 'base' })
    const { order, errors } = topoSort(g, ['d'])
    expect(order.length).toBeLessThan(g.nodes.length)
    expect(errors[0]).toContain('syklus')
  })

  it('er deterministisk', () => {
    const g = graph()
    const first = topoSort(g, ['d']).order
    const second = topoSort(g, ['d']).order
    expect(first).toEqual(second)
  })

  it('beholder deaktiverte noder i kjeden, så de kan sluses forbi', () => {
    const g = graph()
    g.nodes[1].enabled = false
    const { order, errors } = topoSort(g, ['d'])
    expect(errors).toEqual([])
    expect(order).toContain('b')
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
  })
})

describe('wouldCreateCycle', () => {
  it('oppdager tilbakekobling', () => {
    const g = graph()
    expect(wouldCreateCycle(g, 'd', 'a')).toBe(true)
    expect(wouldCreateCycle(g, 'a', 'd')).toBe(false)
  })

  it('avviser selvreferanse', () => {
    expect(wouldCreateCycle(graph(), 'a', 'a')).toBe(true)
  })
})
