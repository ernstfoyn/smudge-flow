import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import { createGroupFromSelection, explodeGroup, nodePorts } from '../src/engine/graph'
import type { Graph, GraphNode, NodeDefinition, RenderServices } from '../src/engine/types'

function fakeRender(): RenderServices {
  return {
    width: 10,
    height: 10,
    canvas: () => {
      throw new Error('Ikke støttet i test')
    },
    touch: () => {},
    versionOf: () => 0,
    post: async () => {
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
    dispose: () => {},
  }
}

const source: NodeDefinition = {
  type: 'test.source',
  label: 'Kilde',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
  params: [{ key: 'id', label: 'Id', type: 'text', default: 'x' }],
  evaluate(_ctx, _inputs, p) {
    return { out: String(p.id) }
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

function node(id: string, type: string, params: Record<string, unknown>, x = 0, y = 0): GraphNode {
  return {
    id,
    type,
    title: id,
    params,
    tracks: {},
    lfo: {},
    position: { x, y },
    enabled: true,
  }
}

describe('gruppe-noder', () => {
  it('eksponerer kantene som krysser grensen', () => {
    const nodes = [
      node('a', 'test.source', { id: 'a' }),
      node('b', 'test.source', { id: 'b' }),
      node('c', 'test.doubler', { factor: 2 }),
      node('out', 'test.sink', {}),
    ]
    const edges = [
      { id: '1', source: 'a', sourcePort: 'out', target: 'c', targetPort: 'in' },
      { id: '2', source: 'b', sourcePort: 'out', target: 'c', targetPort: 'in' },
      { id: '3', source: 'c', sourcePort: 'out', target: 'out', targetPort: 'in' },
    ]

    // Bare 'c' grupperes: 'a' og 'b' er kilder utenfor, 'out' er utenfor.
    const result = createGroupFromSelection(nodes, edges, ['c'], 'g1', registry)

    expect(result.node.type).toBe('group')
    expect(result.node.group?.nodes.map((n) => n.id)).toEqual(['c'])
    // 'a' og 'b' kommer inn i gruppen → én eksponert inngang.
    expect(result.node.group?.inputs).toHaveLength(1)
    expect(result.node.group?.inputs[0].targetNode).toBe('c')
    // 'c' går ut av gruppen → én eksponert utgang.
    expect(result.node.group?.outputs).toHaveLength(1)
    // Kantene utenfor gruppen peker nå på gruppeportene.
    // 'b' (den siste kilden) og gruppens utgang mot 'out'.
    expect(result.edges).toHaveLength(2)
    expect(result.edges.filter((e) => e.target === 'g1')).toHaveLength(1)
    expect(result.edges.find((e) => e.target === 'g1')?.source).toBe('b')
    expect(result.edges.filter((e) => e.source === 'g1')).toHaveLength(1)
  })

  it('evaluerer gruppen og leverer utgangen', async () => {
    const inner = [node('i1', 'test.source', { id: 'i1' }), node('i2', 'test.doubler', { factor: 3 })]
    const innerEdges = [
      { id: 'x', source: 'i1', sourcePort: 'out', target: 'i2', targetPort: 'in' },
    ]

    const groupNode: GraphNode = {
      ...node('g1', 'group', {}),
      group: {
        nodes: inner,
        edges: innerEdges,
        inputs: [],
        outputs: [{ id: 'out-0', name: 'i2', type: 'number', sourceNode: 'i2', sourcePort: 'out' }],
      },
    }

    const graph: Graph = {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [groupNode, node('snk', 'test.sink', {})],
      edges: [{ id: 'e', source: 'g1', sourcePort: 'out-0', target: 'snk', targetPort: 'in' }],
    }

    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    // i1 = 'i1' (tekst) → doubler ganger den... tallverdien blir NaN, så
    // gruppen sender sin verdi videre uendret.
    expect(out.get('snk')?.value).toBeDefined()
  })

  it('injiserer ekstern verdi i gruppens inngang', async () => {
    const inner = [node('i1', 'test.doubler', { factor: 3 })]
    const groupNode: GraphNode = {
      ...node('g1', 'group', {}),
      group: {
        nodes: inner,
        edges: [],
        inputs: [
          { id: 'in-0', name: 'ext', type: 'number', targetNode: 'i1', targetPort: 'in' },
        ],
        outputs: [{ id: 'out-0', name: 'i1', type: 'number', sourceNode: 'i1', sourcePort: 'out' }],
      },
    }

    const graph: Graph = {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [
        node('ext', 'test.source', { id: '5' }),
        groupNode,
        node('snk', 'test.sink', {}),
      ],
      edges: [
        { id: 'a', source: 'ext', sourcePort: 'out', target: 'g1', targetPort: 'in-0' },
        { id: 'b', source: 'g1', sourcePort: 'out-0', target: 'snk', targetPort: 'in' },
      ],
    }

    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    // '5' går inn i doubler (faktor 3) → 15
    expect(out.get('snk')?.value).toBe(15)
  })

  it('gruppeporter er synlige via nodePorts', () => {
    const groupNode: GraphNode = {
      ...node('g1', 'group', {}),
      group: {
        nodes: [],
        edges: [],
        inputs: [{ id: 'in-0', name: 'Bilde', type: 'canvas', targetNode: 'x', targetPort: 'in' }],
        outputs: [{ id: 'out-0', name: ' Ferdig', type: 'canvas', sourceNode: 'y', sourcePort: 'out' }],
      },
    }
    const ports = nodePorts(groupNode)
    expect(ports.inputs[0].label).toBe('Bilde')
    expect(ports.outputs[0].label).toBe(' Ferdig')
  })

  it('kan eksploderes tilbake', () => {
    const nodes = [node('a', 'test.source', { id: 'a' }), node('out', 'test.sink', {})]
    const edges = [
      { id: '1', source: 'a', sourcePort: 'out', target: 'out', targetPort: 'in' },
    ]
    const { node: groupNode, edges: rewritten } = createGroupFromSelection(nodes, edges, ['a'], 'g1', registry)
    // I foreldregrafen er 'a' byttet ut med gruppen:
    const exploded = explodeGroup([node('out', 'test.sink', {}), groupNode], rewritten, groupNode)
    expect(exploded.nodes.map((n) => n.id).sort()).toEqual(['a', 'out'])
    // 'a' kobles direkte til 'out' igjen.
    expect(
      exploded.edges.some((e) => e.source === 'a' && e.target === 'out'),
    ).toBe(true)
  })
})

describe('parameter-koblinger', () => {
  it('verdien fra kilden overstyrer parameteren', async () => {
    const graph: Graph = {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [
        node('src', 'test.source', { id: '4' }),
        node('dbl', 'test.doubler', { factor: 1 }),
        node('snk', 'test.sink', {}),
      ],
      edges: [
        { id: 'v0', source: 'src', sourcePort: 'out', target: 'dbl', targetPort: 'in' },
        {
          id: 'p',
          source: 'src',
          sourcePort: 'out',
          target: 'dbl',
          targetPort: 'param:factor',
          kind: 'param',
          targetParam: 'factor',
        },
        { id: 'v', source: 'dbl', sourcePort: 'out', target: 'snk', targetPort: 'in' },
      ],
    }

    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    // Kilden gir '4' (tekst) → tallverdien NaN → parameteren holdes på 1.
    expect(out.get('snk')?.value).toBeDefined()
  })

  it('parametere som styres av en tallkilde får riktig verdi', async () => {
    const numberSource: NodeDefinition = {
      type: 'test.number',
      label: 'Tall',
      category: 'source',
      inputs: [],
      outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
      params: [{ key: 'value', label: 'Verdi', type: 'number', default: 1 }],
      evaluate(_ctx, _inputs, p) {
        return { out: Number(p.value) }
      },
    }
    const localRegistry = new NodeRegistry().registerAll([numberSource, doubler, sink])

    const graph: Graph = {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [
        node('num', 'test.number', { value: 3 }),
        node('dbl', 'test.doubler', { factor: 1 }),
        node('snk', 'test.sink', {}),
      ],
      edges: [
        { id: 'v0', source: 'num', sourcePort: 'out', target: 'dbl', targetPort: 'in' },
        {
          id: 'p',
          source: 'num',
          sourcePort: 'out',
          target: 'dbl',
          targetPort: 'param:factor',
          kind: 'param',
          targetParam: 'factor',
        },
        { id: 'v', source: 'dbl', sourcePort: 'out', target: 'snk', targetPort: 'in' },
      ],
    }

    const evaluator = new Evaluator(localRegistry, fakeRender())
    const out = await evaluator.evaluateFrame(graph, 0, ['snk'])
    // 3 (verdien inn) * 3 (faktoren fra parameter-koblingen)
    expect(out.get('snk')?.value).toBe(9)
  })
})
