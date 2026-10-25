import { beforeEach, describe, expect, it } from 'vitest'
import { previewPortFor, resolvePreviewTarget } from '../src/engine/preview'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphNode } from '../src/engine/types'

function node(id: string, type: string): GraphNode {
  return { id, type, title: id, params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } }
}

function graph(): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes: [
      node('gradient', 'source.gradient'),
      node('stack', 'composite.stack'),
      node('transform', 'modifier.transform3D'),
      node('view', 'output.viewport'),
    ],
    edges: [],
  }
}

describe('hvilke noder kan forhåndsvises', () => {
  it('finner bildeutgangen på bilde- og komposittnoder', () => {
    expect(previewPortFor(node('g', 'source.gradient'))).toBe('out')
    expect(previewPortFor(node('s', 'composite.stack'))).toBe('out')
    expect(previewPortFor(node('b', 'source.blob3D'))).toBe('out')
  })

  it('avviser 3D-objekter og tall', () => {
    expect(previewPortFor(node('t', 'modifier.transform3D'))).toBeNull()
    expect(previewPortFor(node('s', 'curve.signal'))).toBeNull()
    expect(previewPortFor(node('v', 'output.viewport'))).toBeNull()
  })

  it('bruker valgt node, og faller tilbake til Viewport', () => {
    const g = graph()
    expect(resolvePreviewTarget(g, { nodeId: 'gradient', portId: 'out' })).toEqual({
      nodeId: 'gradient',
      portId: 'out',
    })
    expect(resolvePreviewTarget(g, { nodeId: 'transform', portId: 'out' })).toEqual({
      nodeId: 'view',
      portId: 'frame',
    })
    expect(resolvePreviewTarget(g, null)).toEqual({ nodeId: 'view', portId: 'frame' })
  })

  it('gir null når grafen verken har forhåndsvisning eller Viewport', () => {
    const g = graph()
    g.nodes = [node('gradient', 'source.gradient')]
    expect(resolvePreviewTarget(g, null)).toBeNull()
  })
})

describe('forhåndsvisning i butikken', () => {
  beforeEach(() => {
    useGraphStore.getState().setGraph(graph())
    useGraphStore.getState().setSelection([])
  })

  it('slår på og av forhåndsvisning av samme node', () => {
    useGraphStore.getState().togglePreviewNode('gradient')
    expect(useGraphStore.getState().preview).toEqual({ nodeId: 'gradient', portId: 'out' })
    useGraphStore.getState().togglePreviewNode('gradient')
    expect(useGraphStore.getState().preview).toBeNull()
  })

  it('bytter til en annen node', () => {
    useGraphStore.getState().togglePreviewNode('gradient')
    useGraphStore.getState().togglePreviewNode('stack')
    expect(useGraphStore.getState().preview).toEqual({ nodeId: 'stack', portId: 'out' })
  })

  it('forklarer hvorfor en 3D-node ikke kan vises', () => {
    useGraphStore.getState().togglePreviewNode('transform')
    expect(useGraphStore.getState().preview).toBeNull()
    expect(useGraphStore.getState().notice).toMatch(/ingen bildeutgang/i)
  })

  it('rydder forhåndsvisningen når noden slettes eller grafen nullstilles', () => {
    useGraphStore.getState().togglePreviewNode('gradient')
    useGraphStore.getState().removeNode('gradient')
    expect(useGraphStore.getState().preview).toBeNull()

    useGraphStore.getState().setGraph(graph())
    useGraphStore.getState().togglePreviewNode('stack')
    useGraphStore.getState().reset()
    expect(useGraphStore.getState().preview).toBeNull()
  })

  it('clearPreview går tilbake uten å endre grafen', () => {
    useGraphStore.getState().togglePreviewNode('gradient')
    useGraphStore.getState().clearPreview()
    expect(useGraphStore.getState().preview).toBeNull()
    expect(useGraphStore.getState().graph.nodes).toHaveLength(4)
  })
})
