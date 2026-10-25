import { describe, expect, it, beforeEach } from 'vitest'
import { useGraphStore } from '../src/state/useGraphStore'
import type { Graph, GraphEdge, GraphNode } from '../src/engine/types'

function node(id: string, type: string, x = 0, y = 0, params: Record<string, unknown> = {}): GraphNode {
  return { id, type, title: id, params, tracks: {}, lfo: {}, position: { x, y } }
}

function edge(id: string, source: string, target: string, sourcePort = 'out', targetPort = 'in'): GraphEdge {
  return { id, source, sourcePort, target, targetPort }
}

function graph(nodes: GraphNode[], edges: GraphEdge[]): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes,
    edges,
  }
}

/** To kilder koblet til en lagstabel, og en kabel ut av utvalget. */
function setup() {
  const g = graph(
    [
      node('a', 'source.gradient', 0, 0),
      node('b', 'source.gradient', 0, 200),
      node('stack', 'composite.stack', 300, 100),
      node('outside', 'modifier.blur', 600, 100),
    ],
    [
      edge('e1', 'a', 'stack'),
      edge('e2', 'b', 'stack'),
      edge('e3', 'stack', 'outside'),
    ],
  )
  g.nodes[2].params = {
    layers: {
      e1: { mode: 'normal', opacity: 0.25, visible: true },
      e2: { mode: 'screen', opacity: 0.8, visible: true },
    },
  }
  useGraphStore.getState().setGraph(g)
  useGraphStore.getState().setSelection(['a', 'b', 'stack'])
}

describe('kopier og lim inn', () => {
  beforeEach(setup)

  it('kopierer markerte noder og kablene mellom dem', () => {
    expect(useGraphStore.getState().copySelection()).toBe(3)
    const ids = useGraphStore.getState().pasteClipboard({ x: 500, y: 500 })
    expect(ids).toHaveLength(3)

    const g = useGraphStore.getState().graph
    expect(g.nodes).toHaveLength(7)
    expect(g.edges).toHaveLength(5) // e3 går ut av utvalget og skal ikke kopieres

    const copies = g.nodes.filter((n) => ids.includes(n.id))
    expect(copies.every((n) => n.id !== 'a' && n.id !== 'b' && n.id !== 'stack')).toBe(true)
    expect(Math.min(...copies.map((n) => n.position.x))).toBe(500)
    expect(Math.min(...copies.map((n) => n.position.y))).toBe(500)

    const copiedIds = new Set(ids)
    const internal = g.edges.filter((e) => copiedIds.has(e.source) && copiedIds.has(e.target))
    expect(internal).toHaveLength(2)
    expect(internal.every((e) => e.id !== 'e1' && e.id !== 'e2')).toBe(true)
  })

  it('tar vare på per-lag-innstillingene i lagstabelen', () => {
    useGraphStore.getState().copySelection()
    const ids = useGraphStore.getState().pasteClipboard({ x: 500, y: 500 })
    const g = useGraphStore.getState().graph
    const stack = g.nodes.find((n) => ids.includes(n.id) && n.type === 'composite.stack')!
    const intoStack = g.edges.filter((e) => e.target === stack.id)
    const layers = stack.params.layers as Record<string, unknown>

    expect(intoStack).toHaveLength(2)
    expect(Object.keys(layers).sort()).toEqual(intoStack.map((e) => e.id).sort())
    expect(Object.values(layers)).toEqual([
      { mode: 'normal', opacity: 0.25, visible: true },
      { mode: 'screen', opacity: 0.8, visible: true },
    ])
  })

  it('markerer kopiene og limer inn flere ganger med nytt sprang', () => {
    useGraphStore.getState().copySelection()
    const first = useGraphStore.getState().pasteClipboard()
    expect(useGraphStore.getState().selection).toEqual(first)

    const second = useGraphStore.getState().pasteClipboard()
    const g = useGraphStore.getState().graph
    const x = (ids: string[]) => Math.min(...g.nodes.filter((n) => ids.includes(n.id)).map((n) => n.position.x))
    expect(x(second)).toBeGreaterThan(x(first))
  })

  it('kopierer et snapshot, ikke en levende referanse', () => {
    useGraphStore.getState().copySelection()
    const before = useGraphStore.getState().graph.nodes.find((n) => n.id === 'a')!
    useGraphStore.getState().setParam('a', 'fill', 'radial')
    const pasted = useGraphStore.getState().pasteClipboard({ x: 0, y: 400 })
    const copy = useGraphStore.getState().graph.nodes.find(
      (n) => pasted.includes(n.id) && n.type === 'source.gradient',
    )!
    expect(copy.params.fill).not.toBe('radial')
    expect(before.params.fill).not.toBe('radial')
  })

  it('kopierer ikke når utvalget er tomt, men husker det som allerede er kopiert', () => {
    useGraphStore.getState().copySelection()
    useGraphStore.setState({ selection: [], selected: null })
    expect(useGraphStore.getState().copySelection()).toBe(0)
    // Utklippstavlen er uavhengig av markeringen, som i andre programmer.
    expect(useGraphStore.getState().pasteClipboard({ x: 0, y: 0 })).toHaveLength(3)
  })
})

describe('dupliser', () => {
  beforeEach(setup)

  it('legger kopiene ved siden av og lar originalene stå', () => {
    const ids = useGraphStore.getState().duplicateSelection({ x: 100, y: 50 })
    const g = useGraphStore.getState().graph
    const original = g.nodes.find((n) => n.id === 'a')!
    const copy = g.nodes.find((n) => ids.includes(n.id) && n.type === 'source.gradient')!

    expect(original.position).toEqual({ x: 0, y: 0 })
    expect(copy.position).toEqual({ x: 100, y: 50 })
    expect(useGraphStore.getState().selection).toEqual(ids)
  })

  it('kan legge originalene tilbake der de startet (Alt-dra)', () => {
    // Simuler at draget har flyttet originalene til nye posisjoner.
    useGraphStore.getState().moveNode('a', { x: 400, y: 400 })
    useGraphStore.getState().moveNode('b', { x: 400, y: 600 })
    useGraphStore.getState().moveNode('stack', { x: 700, y: 500 })

    const ids = useGraphStore.getState().duplicateSelection(
      { x: 0, y: 0 },
      { a: { x: 0, y: 0 }, b: { x: 0, y: 200 }, stack: { x: 300, y: 100 } },
    )
    const g = useGraphStore.getState().graph
    expect(g.nodes.find((n) => n.id === 'a')!.position).toEqual({ x: 0, y: 0 })
    expect(g.nodes.find((n) => n.id === 'stack')!.position).toEqual({ x: 300, y: 100 })

    const copyOfA = g.nodes.find((n) => ids.includes(n.id) && n.type === 'source.gradient')!
    expect(copyOfA.position).toEqual({ x: 400, y: 400 })
  })

  it('dupliserer ikke når ingenting er markert', () => {
    useGraphStore.setState({ selection: [], selected: null })
    expect(useGraphStore.getState().duplicateSelection()).toEqual([])
  })
})

describe('kopi av gruppe', () => {
  it('gir gruppens indre noder nye ID-er', () => {
    const group: GraphNode = {
      id: 'g',
      type: 'group',
      title: 'Gruppe',
      params: {},
      position: { x: 0, y: 0 },
      group: {
        nodes: [node('inner', 'source.gradient')],
        edges: [],
        inputs: [],
        outputs: [],
      },
    }
    useGraphStore.getState().setGraph(graph([group], []))
    useGraphStore.getState().setSelection(['g'])
    useGraphStore.getState().copySelection()
    const ids = useGraphStore.getState().pasteClipboard({ x: 100, y: 100 })
    const copy = useGraphStore.getState().graph.nodes.find((n) => n.id === ids[0])!

    expect(copy.id).not.toBe('g')
    expect(copy.group?.nodes[0].id).toBe(`${copy.id}/inner`)
  })
})
