import { describe, expect, it } from 'vitest'
import { useGraphStore } from '../src/state/useGraphStore'

function reset() {
  useGraphStore.getState().reset()
}

describe('sletting av noder og koblinger', () => {
  it('removeNode fjerner noden og kantene dens', () => {
    reset()
    const store = useGraphStore.getState()
    const a = store.addNode('source.gradient', { x: 0, y: 0 })!
    const b = store.addNode('composite.stack', { x: 200, y: 0 })!
    useGraphStore.getState().connect(a, 'out', b, 'in')

    const edgesBefore = useGraphStore.getState().graph.edges.length
    expect(edgesBefore).toBeGreaterThan(0)

    useGraphStore.getState().removeNode(a)

    const graph = useGraphStore.getState().graph
    expect(graph.nodes.some((n) => n.id === a)).toBe(false)
    // Kanten som gikk inn i den slettede noden er også borte.
    expect(graph.edges).toHaveLength(edgesBefore - 1)
  })

  it('removeNode påvirker ikke andre noder', () => {
    reset()
    const store = useGraphStore.getState()
    const a = store.addNode('source.gradient', { x: 0, y: 0 })!
    const b = store.addNode('source.gradient', { x: 200, y: 0 })!
    useGraphStore.getState().removeNode(a)
    expect(useGraphStore.getState().graph.nodes.some((n) => n.id === b)).toBe(true)
  })

  it('disconnect fjerner bare den valgte koblingen', () => {
    reset()
    const store = useGraphStore.getState()
    const a = store.addNode('source.gradient', { x: 0, y: 0 })!
    const b = store.addNode('source.gradient', { x: 200, y: 0 })!
    const c = store.addNode('composite.stack', { x: 400, y: 0 })!
    useGraphStore.getState().connect(a, 'out', c, 'in')
    useGraphStore.getState().connect(b, 'out', c, 'in')

    const edges = useGraphStore.getState().graph.edges
    const before = edges.length
    expect(edges.some((e) => e.source === a)).toBe(true)
    expect(edges.some((e) => e.source === b)).toBe(true)

    useGraphStore.getState().disconnect(edges.find((e) => e.source === a)!.id)

    const after = useGraphStore.getState().graph.edges
    expect(after).toHaveLength(before - 1)
    expect(after.some((e) => e.source === a)).toBe(false)
    expect(after.some((e) => e.source === b)).toBe(true)
  })

  it('markering kan oppdateres enkeltvis (multi-selektering)', () => {
    reset()
    const store = useGraphStore.getState()
    const a = store.addNode('source.gradient', { x: 0, y: 0 })!
    const b = store.addNode('source.gradient', { x: 200, y: 0 })!

    useGraphStore.getState().updateSelection(a, true)
    useGraphStore.getState().updateSelection(b, true)
    expect(useGraphStore.getState().selection).toEqual([a, b])

    useGraphStore.getState().updateSelection(a, false)
    expect(useGraphStore.getState().selection).toEqual([b])
  })

  it('sletting av en node i en gruppe fjerner den fra gruppen', () => {
    reset()
    const store = useGraphStore.getState()
    const a = store.addNode('source.gradient', { x: 0, y: 0 })!
    const b = store.addNode('modifier.blur', { x: 200, y: 0 })!
    useGraphStore.getState().connect(a, 'out', b, 'in')
    useGraphStore.getState().setSelection([a, b])
    useGraphStore.getState().groupSelection()

    const group = useGraphStore.getState().graph.nodes.find((n) => n.type === 'group')!
    expect(group.group?.nodes).toHaveLength(2)

    // Noden som fjernes, finnes inne i gruppen.
    const inside = group.group!.nodes.find((n) => n.type === 'modifier.blur')!
    useGraphStore.getState().removeNode(inside.id)

    const after = useGraphStore.getState().graph.nodes.find((n) => n.id === group.id)!
    expect(after.group?.nodes).toHaveLength(1)
  })
})
