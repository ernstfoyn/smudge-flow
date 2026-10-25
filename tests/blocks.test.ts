import { describe, expect, it } from 'vitest'
import { TemplateBuilder, blockFromSelection, withDefaultSources } from '../src/blocks/builder'
import { BUILTIN_BLOCKS } from '../src/blocks/builtins'
import { createGroupFromSelection, nodePorts, rekeySubgraph } from '../src/engine/graph'
import { Evaluator } from '../src/engine/evaluator'
import { registry } from '../src/nodes'
import { defaultGraph } from '../src/state/defaultGraph'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphNode, RenderServices } from '../src/engine/types'

/** Minimal 2D-kontekst som bare registrerer kall. */
function mockContext() {
  const gradient = { addColorStop: () => {} }
  return {
    save() {}, restore() {}, setTransform() {}, translate() {}, scale() {}, rotate() {},
    clearRect() {}, fillRect() {}, drawImage() {}, beginPath() {}, arc() {}, fill() {},
    rect() {}, moveTo() {}, lineTo() {}, closePath() {},
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData() {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
  }
}

function fakeRender(): RenderServices {
  return {
    width: 10,
    height: 10,
    canvas: () => {
      const ctx = mockContext()
      const canvas = {
        width: 10,
        height: 10,
        getContext: () => ctx,
      }
      return {
        canvas: canvas as unknown as HTMLCanvasElement,
        ctx: ctx as unknown as CanvasRenderingContext2D,
        width: 10,
        height: 10,
        version: 0,
      }
    },
    touch: () => {},
    versionOf: () => 0,
    post: async () => {
      throw new Error('Ikke støttet i test')
    },
    assets: {
      resolveAsset: async () => {
        throw new Error('Ikke støttet i test')
      },
      audio: async () => {
        throw new Error('Ikke støttet i test')
      },
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

describe('blokk-bibliotek', () => {
  it('innebygde blokker har porter og kan bygges', () => {
    for (const block of BUILTIN_BLOCKS) {
      expect(block.nodes.length).toBeGreaterThan(0)
      expect(block.outputs.length).toBeGreaterThan(0)
      expect(block.builtin).toBe(true)
    }
  })

  it('TemplateBuilder lager noder med parameterdefaults', () => {
    const b = new TemplateBuilder()
    const id = b.node('modifier.raster')
    const block = b.build('Test')
    const node = block.nodes.find((n) => n.id === id)!
    expect(node.params.cellSize).toBe(10)
    expect(node.params.pattern).toBe('dots')
  })

  it('byggeren kan koble parametre', () => {
    const b = new TemplateBuilder()
    const loop = b.node('source.loop')
    const warp = b.node('modifier.warp')
    b.drive(loop, 'value', warp, 'amount')
    const block = b.build('Test')
    expect(block.edges.some((e) => e.kind === 'param' && e.targetParam === 'amount')).toBe(true)
  })

  it('eksponerte porter får synlige håndtak', () => {
    const b = new TemplateBuilder()
    const rast = b.node('modifier.raster')
    const blur = b.node('modifier.blur')
    b.connect(rast, 'out', blur, 'in')
    b.exposeInput(rast, 'in', 'Bilde')
    b.exposeOutput(blur, 'out', 'Ferdig')
    const block = b.build('Test')

    expect(block.inputs).toHaveLength(1)
    expect(block.inputs[0].name).toBe('Bilde')
    expect(block.outputs).toHaveLength(1)
    expect(block.outputs[0].name).toBe('Ferdig')
  })

  it('blokk fra markering tar med behandlingen, men holder innholdet utenfor', () => {
    const nodes: GraphNode[] = [
      { id: 'src', type: 'source.gradient', title: 'Gradient', params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } },
      { id: 'rast', type: 'modifier.raster', title: 'Raster', params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } },
      { id: 'blur', type: 'modifier.blur', title: 'Blur', params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } },
    ]
    const edges = [
      { id: '1', source: 'src', sourcePort: 'out', target: 'rast', targetPort: 'in' },
      { id: '2', source: 'rast', sourcePort: 'out', target: 'blur', targetPort: 'in' },
    ]

    const { template } = blockFromSelection(nodes, edges, ['src', 'rast', 'blur'], 'Blokk')

    // Behandlingen er i blokken, innholdet er holdt utenfor.
    expect(template.nodes.map((n) => n.id).sort()).toEqual(['blur', 'rast'])
    // Én inngang (for innholdet) og én utgang (resultatet).
    expect(template.inputs).toHaveLength(1)
    expect(template.outputs).toHaveLength(1)
  })

  it('blokk uten egne innganger får et standardinnhold', () => {
    const b = new TemplateBuilder()
    const rast = b.node('modifier.raster')
    b.exposeInput(rast, 'in', 'Bilde')
    const withDefault = withDefaultSources(b.build('Test'))

    // Det finnes en intern kilde som fyller inngangen.
    expect(withDefault.nodes.length).toBe(2)
    expect(
      withDefault.edges.some((e) => e.target === rast && e.targetPort === 'in'),
    ).toBe(true)
  })

  it('kopier av en blokk får egne node-ID-er', () => {
    const b = new TemplateBuilder()
    const rast = b.node('modifier.raster')
    b.exposeInput(rast, 'in', 'Bilde')
    const block = b.build('Test')

    const copy = rekeySubgraph(
      { nodes: block.nodes, edges: block.edges, inputs: block.inputs, outputs: block.outputs },
      'kopi-1',
    )

    expect(copy.nodes[0].id).not.toBe(block.nodes[0].id)
    // Eksponerte porter peker på de nye ID-ene.
    expect(copy.inputs[0].targetNode).toBe(copy.nodes[0].id)
  })

  it('en blokk kan settes inn i en graf og evalueres', async () => {
    const b = new TemplateBuilder()
    const rast = b.node('modifier.raster')
    b.exposeInput(rast, 'in', 'Bilde')
    b.exposeOutput(rast, 'out', 'Ut')
    const block = withDefaultSources(b.build('Test'))

    const graph: Graph = {
      version: 1,
      settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
      nodes: [
        {
          id: 'grp',
          type: 'group',
          title: 'Blokk',
          params: {},
          tracks: {},
          lfo: {},
          position: { x: 0, y: 0 },
          enabled: true,
          group: rekeySubgraph(block, 'grp'),
        },
      ],
      edges: [],
    }

    const ports = nodePorts(graph.nodes[0])
    expect(ports.inputs).toHaveLength(1)
    expect(ports.outputs).toHaveLength(1)

    // Motoren skal evaluere gruppen uten å kaste (internt standardinnhold).
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph, 0, ['grp'])
    expect(out.get('grp')!['out-0']).toBeDefined()
  })

  it('grupper eksponerer bladnoders utganger automatisk', () => {
    const nodes: GraphNode[] = [
      { id: 'a', type: 'source.gradient', title: 'A', params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } },
      { id: 'b', type: 'modifier.blur', title: 'B', params: {}, tracks: {}, lfo: {}, position: { x: 0, y: 0 } },
    ]
    const edges = [{ id: '1', source: 'a', sourcePort: 'out', target: 'b', targetPort: 'in' }]

    const { node } = createGroupFromSelection(nodes, edges, ['b'], 'g1', registry)
    expect(node.group?.outputs).toHaveLength(1)
    expect(node.group?.outputs[0].sourceNode).toBe('b')
  })
})

describe('last inn blokk i grafen', () => {
  it('legger blokken til som en gruppe uten å røre resten', () => {
    useGraphStore.getState().setGraph(defaultGraph())
    const before = useGraphStore.getState().graph.nodes.length

    const id = useGraphStore.getState().insertBlock(BUILTIN_BLOCKS[0])
    const graph = useGraphStore.getState().graph

    expect(id).toBeTruthy()
    expect(graph.nodes).toHaveLength(before + 1)
    expect(graph.nodes.find((n) => n.id === id)?.group?.nodes.length).toBeGreaterThan(0)
  })

  it('erstatter hele treet og kobler blokkens utgang til viewport', () => {
    useGraphStore.getState().setGraph(defaultGraph())

    const id = useGraphStore.getState().replaceWithBlock(BUILTIN_BLOCKS[0])
    const graph = useGraphStore.getState().graph

    expect(id).toBeTruthy()
    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes[0].id).toBe(id)
    expect(graph.nodes[0].group).toBeDefined()
    expect(graph.nodes[1].type).toBe('output.viewport')
    expect(graph.edges).toHaveLength(1)
    expect(graph.edges[0].source).toBe(id)
    expect(graph.edges[0].sourcePort).toBe(BUILTIN_BLOCKS[0].outputs[0].id)
    expect(graph.edges[0].target).toBe(graph.nodes[1].id)
    // Prosjektinnstillingene skal overleve erstatningen.
    expect(graph.settings).toEqual(defaultGraph().settings)
  })
})
