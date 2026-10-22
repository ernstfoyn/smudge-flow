import { beforeEach, describe, expect, it } from 'vitest'
import { useGraphStore } from '../src/state/useGraphStore'
import { EditHistory } from '../src/state/history'
import type { Graph } from '../src/engine/types'

function graph(n: number): Graph {
  return {
    version: 1,
    settings: { width: 100, height: 100, fps: 60, frames: 60, loop: true, background: '#000' },
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n${i}`,
      type: 'source.gradient',
      title: `N${i}`,
      params: { angle: 45 },
      tracks: {},
      lfo: {},
      position: { x: i * 100, y: 0 },
    })),
    edges: [],
  }
}

describe('historikk', () => {
  beforeEach(() => {
    useGraphStore.getState().clearHistory()
    useGraphStore.getState().setGraph(graph(2))
    useGraphStore.getState().clearHistory()
  })

  it('registrerer endringer og kan angres', () => {
    const store = useGraphStore.getState()
    store.addNode('source.gradient', { x: 0, y: 0 })
    expect(useGraphStore.getState().graph.nodes).toHaveLength(3)
    expect(useGraphStore.getState().canUndo).toBe(true)

    useGraphStore.getState().undo()
    expect(useGraphStore.getState().graph.nodes).toHaveLength(2)
  })

  it('gjør om det angrede', () => {
    useGraphStore.getState().addNode('source.gradient', { x: 0, y: 0 })
    useGraphStore.getState().undo()
    expect(useGraphStore.getState().canRedo).toBe(true)

    useGraphStore.getState().redo()
    expect(useGraphStore.getState().graph.nodes).toHaveLength(3)
  })

  it('angrer parameterendringer', () => {
    const id = useGraphStore.getState().graph.nodes[0].id
    useGraphStore.getState().setParam(id, 'angle', 123)
    expect(useGraphStore.getState().graph.nodes[0].params.angle).toBe(123)

    useGraphStore.getState().undo()
    expect(useGraphStore.getState().graph.nodes[0].params.angle).toBe(45)
  })

  it('forker historikken når man gjør en ny endring etter et angres', () => {
    const store = useGraphStore.getState()
    store.addNode('source.gradient', { x: 0, y: 0 })
    useGraphStore.getState().undo()
    useGraphStore.getState().addNode('source.gradient', { x: 0, y: 0 })

    // Den gamle «fremtiden» er borte.
    expect(useGraphStore.getState().canRedo).toBe(false)
  })

  it('slår sammen raske endringer med samme nøkkel', () => {
    const history = new EditHistory(80)
    const base = graph(1)

    // Mange små endringer av samme parameter.
    for (let i = 0; i < 20; i++) {
      const next = structuredClone(base)
      next.nodes[0].params.angle = i
      history.recordChange(base, next, 'Endret parameter', 'param:n0:angle')
    }

    // Ett innslag, ikke tjue.
    expect(history.undoLabel).toBe('Endret parameter')
  })
})

describe('EditHistory', () => {
  it('tar utgangspunktet som første innslag', () => {
    const history = new EditHistory(80)
    const base = graph(1)
    const next = graph(2)

    history.recordChange(base, next, 'La til node')
    expect(history.canUndo).toBe(true)

    const undone = history.undo()
    expect(undone?.nodes).toHaveLength(1)
  })

  it('deduplikerer like endringer', () => {
    const history = new EditHistory(80)
    const base = graph(1)

    expect(history.record(base, 'A')).toBe(true)
    expect(history.record(base, 'A')).toBe(false)
  })

  it('begrenser lengden', () => {
    const history = new EditHistory(5)
    let current = graph(1)
    for (let i = 0; i < 20; i++) {
      const next = graph(1 + i)
      history.recordChange(current, next, `Endring ${i}`)
      current = next
    }
    // Kan ikke angres lenger tilbake enn de siste fem.
    let steps = 0
    while (history.undo()) steps++
    expect(steps).toBeLessThanOrEqual(5)
  })

  it('stopper ved starten', () => {
    const history = new EditHistory(80)
    expect(history.undo()).toBeNull()
    expect(history.canUndo).toBe(false)
  })
})
