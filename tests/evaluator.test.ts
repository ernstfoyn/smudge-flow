import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { resolveParamsAt } from '../src/engine/params'
import type { Graph, NodeDefinition, RenderServices } from '../src/engine/types'

/** RenderServices uten DOM — nok til å teste motorens evalueringslogikk. */
function fakeRender(): RenderServices {
  return {
    width: 100,
    height: 100,
    canvas: () => {
      throw new Error('Ikke støttet i test')
    },
    assets: {
      image: async () => {
        throw new Error('Ikke støttet i test')
      },
      videoFrame: async () => {
        throw new Error('Ikke støttet i test')
      },
    },
    touch: () => {},
    versionOf: () => 0,
    dispose: () => {},
  }
}

const source: NodeDefinition = {
  type: 'test.source',
  label: 'Kilde',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
  params: [{ key: 'value', label: 'Verdi', type: 'number', default: 1, min: 0, max: 100, animatable: true }],
  evaluate(_ctx, _inputs, p) {
    return { out: Number(p.value) }
  },
}

const doubler: NodeDefinition = {
  type: 'test.doubler',
  label: 'Dobler',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'number' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
  params: [{ key: 'factor', label: 'Faktor', type: 'number', default: 2, min: 0, max: 10 }],
  evaluate(_ctx, inputs, p) {
    return { out: Number(inputs.in) * Number(p.factor) }
  },
}

const sink: NodeDefinition = {
  type: 'test.sink',
  label: 'Mål',
  category: 'output',
  inputs: [{ id: 'in', label: 'Inn', type: 'number' }],
  outputs: [],
  params: [],
  evaluate(_ctx, inputs) {
    return { value: inputs.in }
  },
}

const registry = new NodeRegistry().registerAll([source, doubler, sink])

function buildGraph(): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 30, frames: 60, loop: true, background: '#000' },
    nodes: [
      { id: 'src', type: 'test.source', title: 'Kilde', params: { value: 5 }, position: { x: 0, y: 0 } },
      { id: 'dbl', type: 'test.doubler', title: 'Dobler', params: { factor: 3 }, position: { x: 0, y: 0 } },
      { id: 'snk', type: 'test.sink', title: 'Mål', params: {}, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: '1', source: 'src', sourcePort: 'out', target: 'dbl', targetPort: 'in' },
      { id: '2', source: 'dbl', sourcePort: 'out', target: 'snk', targetPort: 'in' },
    ],
  }
}

describe('Evaluator', () => {
  it('evaluerer kjeden og gir riktig resultat', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(buildGraph(), 0, ['snk'])
    expect(out.get('snk')?.value).toBe(15)
  })

  it('er deterministisk: samme frame gir samme resultat', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph()
    const a = await evaluator.evaluateFrame(graph, 7, ['snk'])
    const b = await evaluator.evaluateFrame(graph, 7, ['snk'])
    expect(a.get('snk')?.value).toBe(b.get('snk')?.value)
  })

  it('bruker keyframes i evalueringen', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph()
    graph.nodes[0].tracks = {
      value: [
        { frame: 0, value: 0 },
        { frame: 10, value: 10 },
      ],
    }
    const out = await evaluator.evaluateFrame(graph, 5, ['snk'])
    expect(out.get('snk')?.value).toBe(15)
  })

  it('kaster tydelig feil når en input mangler', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph()
    graph.edges = graph.edges.filter((e) => e.target !== 'dbl')
    await expect(evaluator.evaluateFrame(graph, 0, ['snk'])).rejects.toThrow(/mangler input/i)
  })

  it('kaster tydelig feil ved syklus', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph()
    graph.edges.push({ id: '3', source: 'snk', sourcePort: 'out', target: 'src', targetPort: 'in' })
    await expect(evaluator.evaluateFrame(graph, 0, ['snk'])).rejects.toThrow(/syklus/i)
  })

  it('cache: static gjenbruker resultatet mellom frames', async () => {
    let calls = 0
    const cached: NodeDefinition = {
      ...source,
      type: 'test.cached',
      cache: 'static',
      evaluate: (_ctx, _inputs, p) => {
        calls++
        return { out: Number(p.value) }
      },
    }
    const localRegistry = new NodeRegistry().registerAll([cached, sink])
    const evaluator = new Evaluator(localRegistry, fakeRender())
    const graph = buildGraph()
    graph.nodes[0] = { ...graph.nodes[0], type: 'test.cached' }
    graph.edges = [{ id: '1', source: 'src', sourcePort: 'out', target: 'snk', targetPort: 'in' }]

    await evaluator.evaluateFrame(graph, 0, ['snk'])
    await evaluator.evaluateFrame(graph, 1, ['snk'])
    expect(calls).toBe(1)

    evaluator.invalidate()
    await evaluator.evaluateFrame(graph, 2, ['snk'])
    expect(calls).toBe(2)
  })
})

describe('resolveParamsAt', () => {
  it('legger keyframes over grunnverdien', () => {
    const node = {
      id: 'n',
      type: 'test.source',
      title: 'K',
      params: { value: 5 },
      tracks: { value: [{ frame: 0, value: 0 }, { frame: 10, value: 100 }] },
      position: { x: 0, y: 0 },
    }
    expect(resolveParamsAt(node, 5, 0, source).value).toBe(50)
  })

  it('legger LFO på toppen av keyframe-verdien', () => {
    const node = {
      id: 'n',
      type: 'test.source',
      title: 'K',
      params: { value: 50 },
      tracks: { value: [{ frame: 0, value: 50 }, { frame: 10, value: 50 }] },
      lfo: { value: { on: true, amount: 1, cycles: 1, shape: 'sine' as const, phase: 0 } },
      position: { x: 0, y: 0 },
    }
    const atHalf = resolveParamsAt(node, 5, 0.5, source).value as number
    const atQuarter = resolveParamsAt(node, 5, 0.25, source).value as number
    expect(atHalf).not.toBe(atQuarter)
  })

  it('klemmer til parameterens range', () => {
    const node = {
      id: 'n',
      type: 'test.source',
      title: 'K',
      params: { value: 500 },
      position: { x: 0, y: 0 },
    }
    expect(resolveParamsAt(node, 0, 0, source).value).toBe(100)
  })

  it('runder int-parametere', () => {
    const intSource: NodeDefinition = {
      ...source,
      params: [{ key: 'value', label: 'Verdi', type: 'int', default: 1, min: 0, max: 100 }],
    }
    const node = {
      id: 'n',
      type: 'test.source',
      title: 'K',
      params: { value: 4.6 },
      position: { x: 0, y: 0 },
    }
    expect(resolveParamsAt(node, 0, 0, intSource).value).toBe(5)
  })
})
