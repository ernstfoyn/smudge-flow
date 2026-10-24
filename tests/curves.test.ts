import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { createEdge } from '../src/engine/graph'
import { curveValue, type CurveShape } from '../src/engine/animation/curves'
import { curveNodes } from '../src/nodes/curve/curves'
import { registry } from '../src/nodes'
import type { EvalContext, Graph, NodeDefinition } from '../src/engine/types'
import { fakeRender } from './fakeRender'

const SHAPES: CurveShape[] = [
  'sine', 'triangle', 'saw', 'square', 'noise', 'ease', 'bounce', 'spring', 'steps', 'hold',
]

function context(phase: number): EvalContext {
  return {
    nodeId: 'curve',
    scopeKey: 'root/curve',
    frame: Math.round(phase * 60),
    fps: 60,
    totalFrames: 60,
    time: phase,
    phase,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: new Map(),
  }
}

function defaultsFor(def: NodeDefinition): Record<string, unknown> {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]))
}

function run(def: NodeDefinition, phase: number, params: Record<string, unknown> = {}) {
  return def.evaluate(context(phase), {}, { ...defaultsFor(def), ...params }) as {
    value: number
    inverse: number
  }
}

describe('kurvenoder', () => {
  it('har én node per kurveform, i kategorien «curve»', () => {
    expect(curveNodes.map((d) => d.type).sort()).toEqual(
      SHAPES.map((s) => `curve.${s}`).sort(),
    )
    for (const def of curveNodes) {
      expect(def.category).toBe('curve')
      expect(def.inputs).toHaveLength(0)
      expect(def.outputs.map((o) => o.type)).toEqual(['number', 'number'])
      expect(registry.has(def.type)).toBe(true)
    }
  })

  it('lukker seg eksakt: frame 0 og frame N gir samme verdi', () => {
    for (const def of curveNodes) {
      for (const cycles of [1, 3]) {
        const params = { cycles, phase: 0.3, min: -5, max: 20 }
        const first = run(def, 0, params).value
        const last = run(def, 1, params).value
        expect(last).toBeCloseTo(first, 6)
      }
    }
  })

  it('holder seg innenfor min og max', () => {
    for (const def of curveNodes) {
      for (let i = 0; i <= 200; i++) {
        const { value } = run(def, i / 200, { min: 10, max: 50, cycles: 2 })
        expect(value).toBeGreaterThanOrEqual(10 - 1e-9)
        expect(value).toBeLessThanOrEqual(50 + 1e-9)
      }
    }
  })

  it('er deterministiske', () => {
    for (const def of curveNodes) {
      expect(run(def, 0.37).value).toBe(run(def, 0.37).value)
    }
  })

  it('gir invertert verdi som speiler min/max', () => {
    for (const def of curveNodes) {
      const out = run(def, 0.21, { min: 2, max: 8 })
      expect(out.value + out.inverse).toBeCloseTo(10, 9)
    }
  })

  it('har riktig form', () => {
    expect(curveValue('sine', 0.25)).toBeCloseTo(1, 9)
    expect(curveValue('sine', 0.75)).toBeCloseTo(-1, 9)
    expect(curveValue('triangle', 0.25)).toBeCloseTo(1, 9)
    expect(curveValue('saw', 0)).toBe(-1)
    expect(curveValue('saw', 0.5)).toBeCloseTo(0, 9)
    expect(curveValue('square', 0.2, { width: 0.3 })).toBe(1)
    expect(curveValue('square', 0.4, { width: 0.3 })).toBe(-1)
    expect(curveValue('ease', 0)).toBeCloseTo(-1, 9)
    expect(curveValue('ease', 0.5)).toBeCloseTo(1, 9)
    expect(curveValue('bounce', 0)).toBeCloseTo(-1, 9)
    expect(curveValue('bounce', 0.5)).toBeCloseTo(1, 9)
    expect(curveValue('spring', 0)).toBeCloseTo(1, 9)
    expect(Math.abs(curveValue('spring', 0.99))).toBeLessThan(0.05)
    expect(curveValue('steps', 0.99, { detail: 4 })).toBeCloseTo(1, 9)
    expect(curveValue('steps', 0, { detail: 4 })).toBeCloseTo(-1, 9)
  })

  it('hold gir samme verdi innen et trinn og ny verdi mellom trinn', () => {
    const a = curveValue('hold', 0.01, { detail: 4, seed: 3 })
    const b = curveValue('hold', 0.2, { detail: 4, seed: 3 })
    expect(a).toBe(b)
    const values = new Set([0, 0.25, 0.5, 0.75].map((t) => curveValue('hold', t + 0.01, { detail: 4, seed: 3 })))
    expect(values.size).toBeGreaterThan(1)
  })

  it('endret frø gir en annen støykurve', () => {
    const a = curveValue('noise', 0.3, { detail: 8, seed: 1 })
    const b = curveValue('noise', 0.3, { detail: 8, seed: 2 })
    expect(a).not.toBe(b)
  })
})

describe('kurvenoder styrer andre noders parametere', () => {
  const target: NodeDefinition = {
    type: 'test.target',
    label: 'Mål',
    category: 'modifier',
    inputs: [],
    outputs: [
      { id: 'a', label: 'A', type: 'number' },
      { id: 'b', label: 'B', type: 'number' },
    ],
    params: [
      { key: 'a', label: 'A', type: 'number', default: 0, min: 0, max: 100, animatable: true },
      { key: 'b', label: 'B', type: 'int', default: 0, min: 0, max: 10, animatable: true },
    ],
    evaluate: (_ctx, _inputs, p) => ({ a: p.a, b: p.b }),
  }

  const localRegistry = new NodeRegistry().registerAll([...curveNodes, target])

  function node(id: string, type: string, params: Record<string, unknown> = {}) {
    return { id, type, title: id, params, tracks: {}, lfo: {}, position: { x: 0, y: 0 } }
  }

  function graph(): Graph {
    return {
      version: 1,
      settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
      nodes: [
        node('sin', 'curve.sine', { min: 0, max: 100 }),
        node('tri', 'curve.triangle', { min: 0, max: 10 }),
        node('t', 'test.target'),
      ],
      edges: [
        createEdge('sin', 'value', 't', 'param:a', 'param'),
        createEdge('tri', 'value', 't', 'param:b', 'param'),
      ],
    }
  }

  it('hver kurve kan styre sin egen parameter på samme node', async () => {
    const evaluator = new Evaluator(localRegistry, fakeRender())
    // frame 15 av 60 → fase 0,25: sinus på topp, trekant på topp
    const out = await evaluator.evaluateFrame(graph(), 15, ['t'])
    expect(out.get('t')?.a).toBeCloseTo(100, 6)
    expect(out.get('t')?.b).toBe(10)

    // frame 45 → fase 0,75: begge i bunn
    const low = await evaluator.evaluateFrame(graph(), 45, ['t'])
    expect(low.get('t')?.a).toBeCloseTo(0, 6)
    expect(low.get('t')?.b).toBe(0)
  })

  it('en kurve kan styre flere parametere samtidig', async () => {
    const g = graph()
    g.edges = [
      createEdge('sin', 'value', 't', 'param:a', 'param'),
      createEdge('sin', 'inverse', 't', 'param:b', 'param'),
    ]
    g.nodes[0].params = { min: 0, max: 10 }
    const evaluator = new Evaluator(localRegistry, fakeRender())
    const out = await evaluator.evaluateFrame(g, 15, ['t'])
    expect(out.get('t')?.a).toBeCloseTo(10, 6)
    expect(out.get('t')?.b).toBe(0)
  })
})
