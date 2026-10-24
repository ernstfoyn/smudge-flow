import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { createEdge } from '../src/engine/graph'
import { DRIVE_PORT_ID } from '../src/engine/drive'
import { curveNodes } from '../src/nodes/curve/curves'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphNode, NodeDefinition } from '../src/engine/types'
import { fakeRender } from './fakeRender'

const target: NodeDefinition = {
  type: 'test.target',
  label: 'Mål',
  category: 'modifier',
  inputs: [],
  outputs: [
    { id: 'a', label: 'A', type: 'number' },
    { id: 'b', label: 'B', type: 'number' },
    { id: 'c', label: 'C', type: 'number' },
  ],
  params: [
    { key: 'a', label: 'A', type: 'number', default: 1, min: 0, max: 100, animatable: true },
    { key: 'b', label: 'B', type: 'int', default: 2, min: 0, max: 10, animatable: true },
    { key: 'c', label: 'C', type: 'number', default: 3, min: 0, max: 100, animatable: true },
    { key: 'mode', label: 'Modus', type: 'enum', default: 'x', options: [{ value: 'x', label: 'X' }] },
  ],
  evaluate: (_ctx, _inputs, p) => ({ a: p.a, b: p.b, c: p.c }),
}

const registry = new NodeRegistry().registerAll([...curveNodes, target])

function node(id: string, type: string, params: Record<string, unknown> = {}): GraphNode {
  return { id, type, title: id, params, tracks: {}, lfo: {}, position: { x: 0, y: 0 } }
}

function graph(drives: string[] | undefined): Graph {
  const t = node('t', 'test.target')
  if (drives) t.drives = drives
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes: [node('sin', 'curve.sine', { min: 0, max: 50 }), t],
    edges: [createEdge('sin', 'value', 't', DRIVE_PORT_ID, 'drive')],
  }
}

describe('styring: én kobling til hele noden', () => {
  it('styrer akkurat parameterne som er valgt', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    // frame 15 av 60 → fase 0,25 → sinus på topp = 50
    const out = await evaluator.evaluateFrame(graph(['a', 'b']), 15, ['t'])
    expect(out.get('t')?.a).toBeCloseTo(50, 6)
    expect(out.get('t')?.b).toBe(10) // int, begrenset til max
    expect(out.get('t')?.c).toBe(3) // ikke valgt: beholder egen verdi
  })

  it('gjør ingenting før parametere er valgt', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph([]), 15, ['t'])
    expect(out.get('t')).toMatchObject({ a: 1, b: 2, c: 3 })

    const unset = await evaluator.evaluateFrame(graph(undefined), 15, ['t'])
    expect(unset.get('t')).toMatchObject({ a: 1, b: 2, c: 3 })
  })

  it('ignorerer ukjente og ikke-styrbare nøkler', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph(['mode', 'finnesIkke', 'a']), 15, ['t'])
    expect(out.get('t')?.a).toBeCloseTo(50, 6)
  })

  it('følger kurven over tid', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const top = await evaluator.evaluateFrame(graph(['a']), 15, ['t'])
    const bottom = await evaluator.evaluateFrame(graph(['a']), 45, ['t'])
    expect(top.get('t')?.a).toBeCloseTo(50, 6)
    expect(bottom.get('t')?.a).toBeCloseTo(0, 6)
  })

  it('en enkeltkobling overstyrer styringen for den ene parameteren', async () => {
    const g = graph(['a', 'c'])
    g.nodes.push(node('tri', 'curve.triangle', { min: 0, max: 20 }))
    g.edges.push(createEdge('tri', 'value', 't', 'param:a', 'param'))
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(g, 15, ['t'])
    expect(out.get('t')?.a).toBeCloseTo(20, 6) // trekanten vinner
    expect(out.get('t')?.c).toBeCloseTo(50, 6) // sinusen styrer resten
  })
})

describe('styring i butikken', () => {
  function setup() {
    useGraphStore.getState().reset()
    const store = useGraphStore.getState()
    const curve = store.addNode('curve.sine', { x: 0, y: 0 })!
    const raster = store.addNode('modifier.raster', { x: 300, y: 0 })!
    return { curve, raster }
  }

  it('kobler til Styring uten å velge parametere på forhånd', () => {
    const { curve, raster } = setup()
    expect(useGraphStore.getState().connect(curve, 'value', raster, DRIVE_PORT_ID)).toBe(true)

    const state = useGraphStore.getState()
    const edge = state.graph.edges.find((e) => e.kind === 'drive')
    expect(edge).toMatchObject({ source: curve, target: raster, targetPort: DRIVE_PORT_ID })
    expect(state.graph.nodes.find((n) => n.id === raster)?.drives).toEqual([])
    expect(state.selected).toBe(raster)
  })

  it('lar brukeren velge parametere, og husker valget', () => {
    const { curve, raster } = setup()
    useGraphStore.getState().connect(curve, 'value', raster, DRIVE_PORT_ID)
    useGraphStore.getState().setDrives(raster, ['cellSize'])
    expect(useGraphStore.getState().graph.nodes.find((n) => n.id === raster)?.drives).toEqual([
      'cellSize',
    ])
  })

  it('erstatter eksisterende styring på samme node', () => {
    const { curve, raster } = setup()
    const other = useGraphStore.getState().addNode('curve.triangle', { x: 0, y: 200 })!
    useGraphStore.getState().connect(curve, 'value', raster, DRIVE_PORT_ID)
    useGraphStore.getState().connect(other, 'value', raster, DRIVE_PORT_ID)

    const drives = useGraphStore.getState().graph.edges.filter((e) => e.kind === 'drive')
    expect(drives).toHaveLength(1)
    expect(drives[0].source).toBe(other)
  })

  it('avviser kilder som ikke er tall, og noder uten styrbare parametere', () => {
    setup()
    const store = useGraphStore.getState()
    const gradient = store.addNode('source.gradient', { x: 0, y: 0 })!
    const raster = store.addNode('modifier.raster', { x: 300, y: 0 })!
    const viewport = store.addNode('output.viewport', { x: 600, y: 0 })!
    const curve = store.addNode('curve.sine', { x: 0, y: 200 })!

    expect(useGraphStore.getState().connect(gradient, 'out', raster, DRIVE_PORT_ID)).toBe(false)
    expect(useGraphStore.getState().connect(curve, 'value', viewport, DRIVE_PORT_ID)).toBe(false)
  })

  it('styringen kan kobles fra', () => {
    const { curve, raster } = setup()
    useGraphStore.getState().connect(curve, 'value', raster, DRIVE_PORT_ID)
    useGraphStore.getState().disconnect(
      useGraphStore.getState().graph.edges.find((e) => e.kind === 'drive')!.id,
    )
    expect(useGraphStore.getState().graph.edges.some((e) => e.kind === 'drive')).toBe(false)
  })
})
