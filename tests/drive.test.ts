import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { createEdge } from '../src/engine/graph'
import { DEFAULT_DRIVE, DRIVE_PORT_ID, driveSettings, modulate } from '../src/engine/drive'
import { signalNode } from '../src/nodes/curve/signal'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphEdge, GraphNode, NodeDefinition } from '../src/engine/types'
import { fakeRender } from './fakeRender'

/** To noder med ulike områder: samme signal skal virke på begge. */
function target(type: string, min: number, max: number, base: number): NodeDefinition {
  return {
    type,
    label: type,
    category: 'modifier',
    inputs: [],
    outputs: [
      { id: 'a', label: 'A', type: 'number' },
      { id: 'b', label: 'B', type: 'number' },
    ],
    params: [
      { key: 'a', label: 'A', type: 'number', default: base, min, max, animatable: true },
      { key: 'b', label: 'B', type: 'int', default: 5, min: 0, max: 10, animatable: true },
      { key: 'mode', label: 'Modus', type: 'enum', default: 'x', options: [{ value: 'x', label: 'X' }] },
    ],
    evaluate: (_ctx, _inputs, p) => ({ a: p.a, b: p.b }),
  }
}

const small = target('test.small', 0, 1, 0.5)
const large = target('test.large', 3, 80, 40)
const registry = new NodeRegistry().registerAll([signalNode, small, large])

function node(id: string, type: string, params: Record<string, unknown> = {}): GraphNode {
  return { id, type, title: id, params, tracks: {}, lfo: {}, position: { x: 0, y: 0 } }
}

function drive(
  source: string,
  targetId: string,
  settings?: GraphEdge['drive'],
  port = DRIVE_PORT_ID,
): GraphEdge {
  const edge = createEdge(source, 'signal', targetId, port, 'drive')
  return { ...edge, drive: settings }
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes,
    edges,
  }
}

const sine = () => node('sig', 'curve.signal', { shape: 'sine', speed: 1 })

describe('signalstyring', () => {
  it('beveger parametere rundt grunnverdien, relativt til hvert område', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph(
      [sine(), node('s', 'test.small'), node('l', 'test.large')],
      [drive('sig', 's', { param: 'a', amount: 0.5 }), drive('sig', 'l', { param: 'a', amount: 0.5 })],
    )

    // frame 15 av 60 → fase 0,25 → sinus = +1
    const top = await evaluator.evaluateFrame(g, 15, ['s', 'l'])
    expect(top.get('s')?.a).toBeCloseTo(0.5 + 0.5 * 1 * 0.5, 6)
    expect(top.get('l')?.a).toBeCloseTo(40 + 0.5 * 77 * 0.5, 6)

    // frame 45 → sinus = −1
    const bottom = await evaluator.evaluateFrame(g, 45, ['s', 'l'])
    expect(bottom.get('s')?.a).toBeCloseTo(0.25, 6)
    expect(bottom.get('l')?.a).toBeCloseTo(40 - 19.25, 6)
  })

  it('samme signal styrer flere noder samtidig', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph(
      [sine(), node('s', 'test.small'), node('l', 'test.large')],
      [drive('sig', 's', { param: null, amount: 1 }), drive('sig', 'l', { param: null, amount: 1 })],
    )
    const out = await evaluator.evaluateFrame(g, 15, ['s', 'l'])
    expect(out.get('s')?.a).toBe(1)
    expect(out.get('l')?.a).toBe(78.5)
    expect(out.get('s')?.b).toBe(10)
    expect(out.get('l')?.b).toBe(10)
  })

  it('«Alle» rører bare styrbare tallparametere', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph([sine(), node('s', 'test.small')], [drive('sig', 's', { param: null, amount: 0.5 })])
    const out = await evaluator.evaluateFrame(g, 15, ['s'])
    expect(out.get('s')?.a).not.toBe(0.5)
    expect(out.get('s')?.b).not.toBe(5)
  })

  it('én parameter lar de andre stå i ro', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph([sine(), node('s', 'test.small')], [drive('sig', 's', { param: 'a', amount: 0.5 })])
    const out = await evaluator.evaluateFrame(g, 15, ['s'])
    expect(out.get('s')?.a).not.toBe(0.5)
    expect(out.get('s')?.b).toBe(5)
  })

  it('negativ styrke snur bevegelsen, og null gjør ingenting', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const inverted = graph([sine(), node('l', 'test.large')], [drive('sig', 'l', { param: 'a', amount: -0.5 })])
    expect((await evaluator.evaluateFrame(inverted, 15, ['l'])).get('l')?.a).toBeCloseTo(40 - 19.25, 6)

    const none = graph([sine(), node('l', 'test.large')], [drive('sig', 'l', { param: 'a', amount: 0 })])
    expect((await evaluator.evaluateFrame(none, 15, ['l'])).get('l')?.a).toBe(40)
  })

  it('flere signaler legges sammen', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph(
      [sine(), node('sig2', 'curve.signal', { shape: 'sine', speed: 1 }), node('l', 'test.large')],
      [drive('sig', 'l', { param: 'a', amount: 0.2 }), drive('sig2', 'l', { param: 'a', amount: 0.3 })],
    )
    const out = await evaluator.evaluateFrame(g, 15, ['l'])
    expect(out.get('l')?.a).toBeCloseTo(40 + 0.5 * 77 * 0.5, 6)
  })

  it('kobling rett til en diamant styrer bare den parameteren', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const edge = drive('sig', 'l', { param: null, amount: 0.5 }, 'param:a')
    expect(driveSettings(edge).param).toBe('a')

    const out = await evaluator.evaluateFrame(graph([sine(), node('l', 'test.large')], [edge]), 15, ['l'])
    expect(out.get('l')?.a).toBeCloseTo(40 + 19.25, 6)
    expect(out.get('l')?.b).toBe(5)
  })

  it('er deterministisk og lukker loopen', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph([sine(), node('l', 'test.large')], [drive('sig', 'l', { param: 'a', amount: 0.5 })])
    const first = await evaluator.evaluateFrame(g, 0, ['l'])
    const again = await evaluator.evaluateFrame(g, 0, ['l'])
    const wrapped = await evaluator.evaluateFrame(g, 60, ['l'])
    expect(again.get('l')?.a).toBe(first.get('l')?.a)
    expect(wrapped.get('l')?.a).toBeCloseTo(first.get('l')?.a as number, 6)
  })
})

describe('hjelpefunksjoner', () => {
  it('gir trygge standardverdier for eldre eller ufullstendige kanter', () => {
    const edge = drive('a', 'b', undefined)
    expect(driveSettings(edge)).toEqual(DEFAULT_DRIVE)
    expect(driveSettings({ ...edge, drive: { param: null, amount: 9 } }).amount).toBe(1)
    expect(driveSettings({ ...edge, drive: { param: null, amount: Number.NaN } }).amount).toBe(0.5)
  })

  it('modulerer også parametere uten grenser', () => {
    const open = { key: 'x', label: 'X', type: 'number' as const, default: 10 }
    expect(modulate(10, 1, open)).toBeCloseTo(20, 6)
    expect(modulate(0, 1, open)).toBeCloseTo(1, 6)
  })
})

describe('styring i butikken', () => {
  function setup() {
    useGraphStore.getState().reset()
    const store = useGraphStore.getState()
    const signal = store.addNode('curve.signal', { x: 0, y: 0 })!
    const raster = store.addNode('modifier.raster', { x: 300, y: 0 })!
    return { signal, raster }
  }

  it('kobler til Styring med standardinnstillinger', () => {
    const { signal, raster } = setup()
    expect(useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)).toBe(true)

    const edge = useGraphStore.getState().graph.edges.find((e) => e.kind === 'drive')
    expect(edge).toMatchObject({ source: signal, target: raster, targetPort: DRIVE_PORT_ID })
    expect(edge?.drive).toEqual(DEFAULT_DRIVE)
  })

  it('kan koble samme signal til flere noder', () => {
    const { signal, raster } = setup()
    const other = useGraphStore.getState().addNode('modifier.blur', { x: 300, y: 200 })!
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    useGraphStore.getState().connect(signal, 'signal', other, DRIVE_PORT_ID)
    const drives = useGraphStore.getState().graph.edges.filter((e) => e.kind === 'drive')
    expect(drives.map((e) => e.target).sort()).toEqual([raster, other].sort())
  })

  it('kan koble flere signaler til samme node', () => {
    const { signal, raster } = setup()
    const second = useGraphStore.getState().addNode('curve.signal', { x: 0, y: 200 })!
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    useGraphStore.getState().connect(second, 'signal', raster, DRIVE_PORT_ID)
    expect(useGraphStore.getState().graph.edges.filter((e) => e.kind === 'drive')).toHaveLength(2)
  })

  it('avviser en identisk kobling to ganger', () => {
    const { signal, raster } = setup()
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    expect(useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)).toBe(false)
  })

  it('et signal til en diamant blir en modulering av akkurat den parameteren', () => {
    const { signal, raster } = setup()
    useGraphStore.getState().connect(signal, 'signal', raster, 'param:cellSize')
    const edge = useGraphStore.getState().graph.edges.find((e) => e.target === raster)
    expect(edge?.kind).toBe('drive')
    expect(edge?.drive?.param).toBe('cellSize')
  })

  it('en vanlig tallkilde til en diamant er fortsatt en rå parameterkobling', () => {
    useGraphStore.getState().reset()
    const store = useGraphStore.getState()
    const loop = store.addNode('source.loop', { x: 0, y: 0 })!
    const raster = store.addNode('modifier.raster', { x: 300, y: 0 })!
    useGraphStore.getState().connect(loop, 'value', raster, 'param:cellSize')
    expect(useGraphStore.getState().graph.edges.find((e) => e.target === raster)?.kind).toBe('param')
  })

  it('endrer styrke og parameter på koblingen', () => {
    const { signal, raster } = setup()
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    const id = useGraphStore.getState().graph.edges.find((e) => e.kind === 'drive')!.id
    useGraphStore.getState().setDrive(id, { amount: -0.3 })
    useGraphStore.getState().setDrive(id, { param: 'cellSize' })
    expect(useGraphStore.getState().graph.edges.find((e) => e.id === id)?.drive).toEqual({
      param: 'cellSize',
      amount: -0.3,
    })
  })

  it('avviser kilder som ikke er tall, og noder uten styrbare parametere', () => {
    setup()
    const store = useGraphStore.getState()
    const gradient = store.addNode('source.gradient', { x: 0, y: 0 })!
    const raster = store.addNode('modifier.raster', { x: 300, y: 0 })!
    const viewport = store.addNode('output.viewport', { x: 600, y: 0 })!
    const signal = store.addNode('curve.signal', { x: 0, y: 200 })!

    expect(useGraphStore.getState().connect(gradient, 'out', raster, DRIVE_PORT_ID)).toBe(false)
    expect(useGraphStore.getState().connect(signal, 'signal', viewport, DRIVE_PORT_ID)).toBe(false)
  })

  it('flytter ikke markeringen når du kobler', () => {
    const { signal, raster } = setup()
    useGraphStore.getState().select(signal)
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    expect(useGraphStore.getState().selected).toBe(signal)
  })

  it('styringen kan kobles fra', () => {
    const { signal, raster } = setup()
    useGraphStore.getState().connect(signal, 'signal', raster, DRIVE_PORT_ID)
    useGraphStore.getState().disconnect(
      useGraphStore.getState().graph.edges.find((e) => e.kind === 'drive')!.id,
    )
    expect(useGraphStore.getState().graph.edges.some((e) => e.kind === 'drive')).toBe(false)
  })
})
