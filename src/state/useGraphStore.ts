import { create } from 'zustand'
import type { Graph, GraphSettings, Keyframe, LfoConfig, NodeId } from '../engine/types'
import { canConnectTypes, findPort } from '../engine/graph'
import { wouldCreateCycle } from '../engine/topoSort'
import { upsertKey } from '../engine/animation/keyframes'
import { registry } from '../nodes'
import { defaultGraph, makeNode } from './defaultGraph'

interface GraphState {
  graph: Graph
  selected: NodeId | null
  /** Kort melding om siste kobling (feil eller info). */
  notice: string | null

  setGraph: (graph: Graph) => void
  addNode: (type: string, position: { x: number; y: number }) => NodeId | null
  removeNode: (id: NodeId) => void
  moveNode: (id: NodeId, position: { x: number; y: number }) => void
  renameNode: (id: NodeId, title: string) => void
  toggleNode: (id: NodeId) => void

  connect: (source: NodeId, sourcePort: string, target: NodeId, targetPort: string) => boolean
  disconnect: (edgeId: string) => void
  reorderInput: (nodeId: NodeId, portId: string, from: number, to: number) => void
  clearNotice: () => void

  setParam: (id: NodeId, key: string, value: unknown) => void
  resetParams: (id: NodeId) => void
  setKeyframe: (id: NodeId, path: string, frame: number, value: unknown) => void
  removeKeyframe: (id: NodeId, path: string, frame: number) => void
  setLfo: (id: NodeId, path: string, patch: Partial<LfoConfig>) => void

  setSettings: (patch: Partial<GraphSettings>) => void
  select: (id: NodeId | null) => void
  reset: () => void
}

let counter = 0
const nextId = (type: string) => `${type}-${Date.now().toString(36)}-${counter++}`

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: defaultGraph(),
  selected: null,
  notice: null,

  setGraph: (graph) => set({ graph }),

  addNode: (type, position) => {
    if (!registry.has(type)) return null
    const id = nextId(type)
    const node = makeNode(type, id, position)
    set((s) => ({ graph: { ...s.graph, nodes: [...s.graph.nodes, node] }, selected: id }))
    return id
  },

  removeNode: (id) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.filter((n) => n.id !== id),
        edges: s.graph.edges.filter((e) => e.source !== id && e.target !== id),
      },
      selected: s.selected === id ? null : s.selected,
    })),

  moveNode: (id, position) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => (n.id === id ? { ...n, position } : n)),
      },
    })),

  renameNode: (id, title) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => (n.id === id ? { ...n, title } : n)),
      },
    })),

  toggleNode: (id) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) =>
          n.id === id ? { ...n, enabled: n.enabled === false } : n,
        ),
      },
    })),

  connect: (source, sourcePort, target, targetPort) => {
    const { graph } = get()
    if (source === target) return false
    if (wouldCreateCycle(graph, source, target)) {
      set({ notice: 'Koblingen ble avvist — den ville skapt en syklus i grafen.' })
      return false
    }

    const sourceDef = registry.get(graph.nodes.find((n) => n.id === source)?.type ?? '')
    const targetDef = registry.get(graph.nodes.find((n) => n.id === target)?.type ?? '')

    const outPort = findPort(sourceDef.outputs, sourcePort)
    const inPort = findPort(targetDef.inputs, targetPort)
    if (!outPort || !inPort) return false
    if (!canConnectTypes(outPort.type, inPort.type)) {
      set({ notice: `Kan ikke koble ${outPort.type} til ${inPort.type}.` })
      return false
    }

    const id = `${source}.${sourcePort}->${target}.${targetPort}`
    const existing = graph.edges.filter((e) => e.target === target && e.targetPort === targetPort)

    if (inPort.multiple) {
      // Flere lag tillatt: behold alle, den nye legges på toppen.
      if (existing.some((e) => e.id === id)) {
        set({ notice: 'Denne forbindelsen finnes allerede.' })
        return false
      }
      set({
        graph: { ...graph, edges: [...graph.edges, { id, source, sourcePort, target, targetPort }] },
        notice: null,
      })
      return true
    }

    // Én inngang per port: en ny kant erstatter den gamle.
    set({
      graph: {
        ...graph,
        edges: [
          ...graph.edges.filter((e) => !(e.target === target && e.targetPort === targetPort)),
          { id, source, sourcePort, target, targetPort },
        ],
      },
      notice: existing.length
        ? `«${inPort.label}» var allerede koblet — den gamle forbindelsen ble erstattet. Bruk en lagstabel for å kombinere flere lag.`
        : null,
    })
    return true
  },

  /**
   * Endrer rekkefølgen på lagene som er koblet til en multiple-port.
   * Lagene tegnes i kantrekkefølge, så dette bestemmer hva som ligger øverst.
   */
  reorderInput: (nodeId, portId, from, to) =>
    set((s) => {
      const matching = s.graph.edges.filter((e) => e.target === nodeId && e.targetPort === portId)
      if (from < 0 || from >= matching.length || to < 0 || to >= matching.length) return s

      const reordered = [...matching]
      const [moved] = reordered.splice(from, 1)
      reordered.splice(to, 0, moved)

      let cursor = 0
      const edges = s.graph.edges.map((e) => {
        if (e.target === nodeId && e.targetPort === portId) return reordered[cursor++]
        return e
      })

      return { graph: { ...s.graph, edges } }
    }),

  disconnect: (edgeId) =>
    set((s) => ({
      graph: { ...s.graph, edges: s.graph.edges.filter((e) => e.id !== edgeId) },
      notice: null,
    })),

  clearNotice: () => set({ notice: null }),

  setParam: (id, key, value) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) =>
          n.id === id ? { ...n, params: { ...n.params, [key]: value } } : n,
        ),
      },
    })),

  resetParams: (id) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const def = registry.get(n.type)
          const params: Record<string, unknown> = {}
          for (const p of def.params) params[p.key] = p.default
          return { ...n, params }
        }),
      },
    })),

  setKeyframe: (id, path, frame, value) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const tracks: Record<string, Keyframe[]> = { ...(n.tracks ?? {}) }
          tracks[path] = upsertKey(tracks[path] ?? [], frame, value)
          return { ...n, tracks }
        }),
      },
    })),

  removeKeyframe: (id, path, frame) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const tracks = { ...(n.tracks ?? {}) }
          tracks[path] = (tracks[path] ?? []).filter((k) => k.frame !== frame)
          return { ...n, tracks }
        }),
      },
    })),

  setLfo: (id, path, patch) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const lfo: Record<string, LfoConfig> = { ...(n.lfo ?? {}) }
          const defaults: LfoConfig = {
            on: false,
            amount: 0.25,
            cycles: 1,
            shape: 'sine',
            phase: 0,
          }
          lfo[path] = { ...defaults, ...(lfo[path] ?? {}), ...patch }
          return { ...n, lfo }
        }),
      },
    })),

  setSettings: (patch) =>
    set((s) => ({ graph: { ...s.graph, settings: { ...s.graph.settings, ...patch } } })),

  select: (selected) => set({ selected }),

  reset: () => set({ graph: defaultGraph(), selected: null }),
}))
