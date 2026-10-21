import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import type { Graph, NodeDefinition, RenderServices } from '../src/engine/types'

function fakeRender(): RenderServices {
  return {
    width: 10,
    height: 10,
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

/** En kilde som gir ut sin id, slik at vi kan se rekkefølgen på lagene. */
const source: NodeDefinition = {
  type: 'test.source',
  label: 'Kilde',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Ut', type: 'string' }],
  params: [{ key: 'id', label: 'Id', type: 'text', default: 'x' }],
  evaluate(_ctx, _inputs, p) {
    return { out: String(p.id) }
  },
}

/** En node med multiple-port som bare videregir lagene i rekkefølge. */
const stack: NodeDefinition = {
  type: 'test.stack',
  label: 'Stabel',
  category: 'composite',
  inputs: [{ id: 'in', label: 'Lag', type: 'string', multiple: true }],
  outputs: [{ id: 'out', label: 'Ut', type: 'string' }],
  params: [],
  evaluate(_ctx, inputs) {
    return { out: (inputs.in as string[]).join('|') }
  },
}

const sink: NodeDefinition = {
  type: 'test.sink',
  label: 'Mål',
  category: 'output',
  inputs: [{ id: 'in', label: 'Inn', type: 'string' }],
  outputs: [],
  params: [],
  evaluate(_ctx, inputs) {
    return { value: inputs.in }
  },
}

const registry = new NodeRegistry().registerAll([source, stack, sink])

function buildGraph(order: string[]): Graph {
  return {
    version: 1,
    settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
    nodes: [
      ...order.map((id) => ({
        id,
        type: 'test.source',
        title: id,
        params: { id },
        position: { x: 0, y: 0 },
      })),
      { id: 'st', type: 'test.stack', title: 'Stabel', params: {}, position: { x: 0, y: 0 } },
      { id: 'snk', type: 'test.sink', title: 'Mål', params: {}, position: { x: 0, y: 0 } },
    ],
    edges: [
      ...order.map((id, i) => ({
        id: `e${i}`,
        source: id,
        sourcePort: 'out',
        target: 'st',
        targetPort: 'in',
      })),
      { id: 'out', source: 'st', sourcePort: 'out', target: 'snk', targetPort: 'in' },
    ],
  }
}

describe('multiple-inngangsporter', () => {
  it('leverer alle lagene i kantrekkefølge', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(buildGraph(['a', 'b', 'c']), 0, ['snk'])
    expect(out.get('snk')?.value).toBe('a|b|c')
  })

  it('følger kantrekkefølgen når lagene kobles om', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph(['a', 'b', 'c'])

    // Flytt «c» først i porten.
    graph.edges = [
      { id: 'e2', source: 'c', sourcePort: 'out', target: 'st', targetPort: 'in' },
      { id: 'e0', source: 'a', sourcePort: 'out', target: 'st', targetPort: 'in' },
      { id: 'e1', source: 'b', sourcePort: 'out', target: 'st', targetPort: 'in' },
      { id: 'out', source: 'st', sourcePort: 'out', target: 'snk', targetPort: 'in' },
    ]

    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    expect(out.get('snk')?.value).toBe('c|a|b')
  })

  it('kaster feil når en multiple-port mangler lag', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph(['a'])
    graph.edges = graph.edges.filter((e) => e.target !== 'st')
    await expect(evaluator.evaluateFrame(graph, 0, ['snk'])).rejects.toThrow(/mangler input/i)
  })

  it('enkel port bruker den siste tilkoblede kantet', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const graph = buildGraph(['a'])
    // to kanter inn i enkel port (skulle blitt avvist av store, men motoren tåler det)
    graph.edges.push({
      id: 'extra',
      source: 'a',
      sourcePort: 'out',
      target: 'snk',
      targetPort: 'in',
    })
    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    expect(out.get('snk')?.value).toBe('a')
  })
})
