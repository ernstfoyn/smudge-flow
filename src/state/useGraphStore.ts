import { create } from 'zustand'
import type { Graph, GraphNode, GraphSettings, Keyframe, LfoConfig, NodeId } from '../engine/types'
import {
  PARAM_PORT_PREFIX,
  canConnectTypes,
  createGroupFromSelection,
  explodeGroup,
  findPort,
  nodeParamDefs,
  nodePorts,
  rekeySubgraph,
} from '../engine/graph'
import { wouldCreateCycle } from '../engine/topoSort'
import { upsertKey } from '../engine/animation/keyframes'
import { registry } from '../nodes'
import { blockFromSelection } from '../blocks/builder'
import { useLibraryStore } from './useLibraryStore'
import type { BlockTemplate } from '../blocks/types'
import type { TrailStamp } from '../nodes/modifier/trail'
import { defaultGraph, makeNode } from './defaultGraph'
import { EditHistory } from './history'

interface GraphState {
  graph: Graph
  selected: NodeId | null
  /** Markert utvalg (brukkes til å lage grupper). */
  selection: NodeId[]
  /** Markerte koblinger (kan slettes med Delete). */
  selectedEdges: string[]
  /** Kort melding om siste kobling (feil eller info). */
  notice: string | null
  /** Kan angres / gjøres om? */
  canUndo: boolean
  canRedo: boolean
  /** Etikett på neste angres. */
  undoLabel: string | null
  redoLabel: string | null

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

  /** Lager en gruppe-node av markerte noder. */
  groupSelection: (ids?: NodeId[]) => NodeId | null
  /** Exploderer en gruppe-node tilbake til enkelte noder. */
  ungroup: (id: NodeId) => void
  /** Lager en ny kopi av en node (eller gruppe). */
  instantiate: (id: NodeId, offset?: { x: number; y: number }) => NodeId | null
  /** Legger til et stempel i trail-laget. */
  addStamp: (id: NodeId, u: number, v: number, newStroke: boolean) => void
  /** Tømmer trail-laget. */
  clearStamps: (id: NodeId) => void
  /** Eksponerer en intern port som inngang i gruppen. */
  exposeInput: (groupId: NodeId, targetNode: NodeId, targetPort: string) => void
  /** Eksponerer en intern port som utgang fra gruppen. */
  exposeOutput: (groupId: NodeId, sourceNode: NodeId, sourcePort: string) => void
  /** Fjerner en eksponert inngang. */
  unexposeInput: (groupId: NodeId, inputId: string) => void
  /** Fjerner en eksponert utgang. */
  unexposeOutput: (groupId: NodeId, outputId: string) => void
  /** Koble fra en intern kobling i en gruppe. */
  disconnectGroupEdge: (groupId: NodeId, edgeId: string) => void
  /** Setter en blokk fra biblioteket inn i grafen. */
  insertBlock: (template: BlockTemplate, position?: { x: number; y: number }) => NodeId | null
  /** Lagrer markerte noder som en blokk i biblioteket. */
  saveSelectionAsBlock: (name: string, description?: string) => BlockTemplate | null

  setParam: (id: NodeId, key: string, value: unknown) => void
  resetParams: (id: NodeId) => void
  setKeyframe: (id: NodeId, path: string, frame: number, value: unknown) => void
  removeKeyframe: (id: NodeId, path: string, frame: number) => void
  setLfo: (id: NodeId, path: string, patch: Partial<LfoConfig>) => void

  setSettings: (patch: Partial<GraphSettings>) => void
  /** Tar ett steg tilbake i endringene. */
  undo: () => void
  /** Tar ett steg fram i endringene. */
  redo: () => void
  /** Tømmer historikken. */
  clearHistory: () => void
  select: (id: NodeId | null) => void
  setSelection: (ids: NodeId[]) => void
  /** Legger til/fjerner en node i markeringen (multi-selektering). */
  updateSelection: (id: NodeId, selected: boolean) => void
  setSelectedEdges: (ids: string[]) => void
  reset: () => void
}

let counter = 0
const nextId = (type: string) => `${type}-${Date.now().toString(36)}-${counter++}`

/**
 * Fjerner en node (med sine kant) inne i en gruppe.
 * Rekursivt, slik at grupper inne i grupper også håndteres.
 */
function removeFromSubgraph(node: GraphNode, id: NodeId): GraphNode {
  if (!node.group) return node
  const group = structuredClone(node.group)

  const contained = group.nodes.some((n) => n.id === id)
  if (contained) {
    group.nodes = group.nodes.filter((n) => n.id !== id)
    group.edges = group.edges.filter((e) => e.source !== id && e.target !== id)
    // Eksponerte porter som peker på den slettede noden, fjernes også.
    group.inputs = group.inputs.filter((i) => i.targetNode !== id)
    group.outputs = group.outputs.filter((o) => o.sourceNode !== id)
  } else {
    group.nodes = group.nodes.map((n) => removeFromSubgraph(n, id))
  }

  return { ...node, group }
}

const history = new EditHistory(80)

/** True mens en historikkoppføring settes i grafen (skal ikke registreres). */
let applyingHistory = false

/**
 * Beskriver hva som endret seg, slik at historikken får gode etiketter
 * og raske endringer kan slås sammen.
 */
function describeChange(
  prev: Graph,
  next: Graph,
): { label: string; key?: string } | null {
  const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]))
  const nextNodes = new Map(next.nodes.map((n) => [n.id, n]))

  if (nextNodes.size !== prevNodes.size) return { label: 'Endret grafen' }
  if (next.edges.length !== prev.edges.length) return { label: 'Endret koblinger' }

  for (const [id, node] of nextNodes) {
    const before = prevNodes.get(id)
    if (!before) return { label: 'Endret grafen' }

    if (JSON.stringify(before.params) !== JSON.stringify(node.params)) {
      const key = Object.keys(node.params).find(
        (k) => JSON.stringify(before.params[k]) !== JSON.stringify(node.params[k]),
      )
      return { label: 'Endret parameter', key: `param:${id}:${key}` }
    }
    if (JSON.stringify(before.tracks) !== JSON.stringify(node.tracks)) {
      return { label: 'Endret keyframes', key: `tracks:${id}` }
    }
    if (JSON.stringify(before.lfo) !== JSON.stringify(node.lfo)) {
      return { label: 'Endret animasjon', key: `lfo:${id}` }
    }
    if (before.position.x !== node.position.x || before.position.y !== node.position.y) {
      return { label: 'Flyttet node', key: `move:${id}` }
    }
    if (before.title !== node.title) return { label: 'Omdøpte node', key: `title:${id}` }
  }

  return null
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graph: defaultGraph(),
  selected: null,
  selection: [],
  selectedEdges: [],
  notice: null,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,

  setGraph: (graph) => set({ graph }),

  addNode: (type, position) => {
    if (!registry.has(type)) return null
    const id = nextId(type)
    const node = makeNode(type, id, position)
    set((s) => ({ graph: { ...s.graph, nodes: [...s.graph.nodes, node] }, selected: id }))
    return id
  },

  /**
   * Fjerner en node — også noder som ligger inne i en gruppe.
   *
   * Kantene til noden fjernes alltid, uansett hvor den ligger.
   */
  removeNode: (id) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes
          .filter((n) => n.id !== id)
          .map((n) => (n.group ? removeFromSubgraph(n, id) : n)),
        edges: s.graph.edges.filter((e) => e.source !== id && e.target !== id),
      },
      selected: s.selected === id ? null : s.selected,
      selection: s.selection.filter((x) => x !== id),
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

    const sourceNode = graph.nodes.find((n) => n.id === source)
    const targetNode = graph.nodes.find((n) => n.id === target)
    if (!sourceNode || !targetNode) return false

    const sourcePorts = nodePorts(sourceNode)
    const targetPorts = nodePorts(targetNode)

    const outPort = findPort(sourcePorts.outputs, sourcePort)
    if (!outPort) return false

    // --- Parameter-kobling: verdien driver en parameter --------------------
    if (targetPort.startsWith(PARAM_PORT_PREFIX)) {
      const key = targetPort.slice(PARAM_PORT_PREFIX.length)
      const param = nodeParamDefs(targetNode).find((p) => p.key === key)
      if (!param) return false
      if (outPort.type !== 'number' || (param.type !== 'number' && param.type !== 'int')) {
        set({
          notice: `«${param.label}» kan bare styres fra en tallkilde (${param.type}).`,
        })
        return false
      }

      const id = `${source}.${sourcePort}->${target}.${targetPort}`
      set({
        graph: {
          ...graph,
          edges: [
            ...graph.edges.filter((e) => !(e.kind === 'param' && e.target === target && e.targetParam === key)),
            {
              id,
              source,
              sourcePort,
              target,
              targetPort,
              kind: 'param',
              targetParam: key,
            },
          ],
        },
        notice: `«${param.label}» styres nå av «${sourceNode.title}».`,
      })
      return true
    }

    const inPort = findPort(targetPorts.inputs, targetPort)
    if (!inPort) return false
    if (!canConnectTypes(outPort.type, inPort.type)) {
      set({ notice: `Kan ikke koble ${outPort.type} til ${inPort.type}.` })
      return false
    }

    const id = `${source}.${sourcePort}->${target}.${targetPort}`
    const existing = graph.edges.filter(
      (e) => e.target === target && e.targetPort === targetPort && e.kind !== 'param',
    )

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
          ...graph.edges.filter(
            (e) => !(e.target === target && e.targetPort === targetPort && e.kind !== 'param'),
          ),
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

  /**
   * Lager en gruppe-node av markerte noder.
   *
   * Kantene som krysser grensen blir eksponert som innganger/utganger, så
   * gruppen kan kobles inn i en større graf. Slik får du en gjenbrukbbar
   * behandlingsblokk: bygg kjeden én gang, bytt bare innholdet.
   */
  groupSelection: (ids) => {
    const { graph, selection } = get()
    const picked = (ids ?? selection).filter((id) => graph.nodes.some((n) => n.id === id))
    if (picked.length < 1) {
      set({ notice: 'Merk minst én node for å lage en gruppe.' })
      return null
    }

    const groupId = nextId('group')
    const { node, edges } = createGroupFromSelection(graph.nodes, graph.edges, picked, groupId)

    set({
      graph: {
        ...graph,
        nodes: [...graph.nodes.filter((n) => !picked.includes(n.id)), node],
        edges,
      },
      selected: groupId,
      selection: [groupId],
      notice: `Lagde gruppe «${node.title}» med ${node.group?.nodes.length ?? 0} noder.`,
    })
    return groupId
  },

  /** Exploderer en gruppe-node tilbake til enkelte noder. */
  ungroup: (id) => {
    const { graph } = get()
    const node = graph.nodes.find((n) => n.id === id)
    if (!node?.group) return

    const { nodes, edges } = explodeGroup(graph.nodes, graph.edges, node)
    set({
      graph: { ...graph, nodes, edges },
      selected: null,
      selection: node.group.nodes.map((n) => n.id),
      notice: 'Gruppen ble eksplodert.',
    })
  },

  /**
   * Lager en ny kopi av en node — eller av en hel gruppe.
   * Dette er veien til «samme behandling, nytt innhold».
   */
  instantiate: (id, offset = { x: 60, y: 60 }) => {
    const { graph } = get()
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return null

    const copyId = nextId(node.type)
    const copy = structuredClone(node)
    copy.id = copyId
    copy.title = `${node.title} kopi`
    copy.position = { x: node.position.x + offset.x, y: node.position.y + offset.y }

    // En kopi må ha egne node-ID-er, ellers deler den lerret og tilstand
    // med originalen — og de to ville overskrive hverandre.
    if (copy.group) {
      copy.group = rekeySubgraph(copy.group, copyId)
    }

    set({
      graph: { ...graph, nodes: [...graph.nodes, copy] },
      selected: copyId,
      selection: [copyId],
      notice: `Lagde kopi av «${node.title}».`,
    })
    return copyId
  },

  /**
   * Legger til et stempel i trail-laget.
   *
   * Stemplene lagres i nodens params, altså som data. Da er laget
   * deterministisk: samme stempler gir samme bilde, hver gang.
   */
  addStamp: (id, u, v, newStroke) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const stamps = Array.isArray(n.params.stamps)
            ? ([...n.params.stamps] as TrailStamp[])
            : []
          const strokeCount = Number(n.params.strokeCount ?? 0)
          const rotateStrokes = !!n.params.rotateStrokes
          const rotation = newStroke && rotateStrokes ? (strokeCount % 4) * (Math.PI / 2) : 0

          stamps.push({ u, v, rotation })

          return {
            ...n,
            params: {
              ...n.params,
              stamps,
              strokeCount: newStroke ? strokeCount + 1 : strokeCount,
            },
          }
        }),
      },
    })),

  clearStamps: (id) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) =>
          n.id === id ? { ...n, params: { ...n.params, stamps: [], strokeCount: 0 } } : n,
        ),
      },
    })),

  /**
   * Eksponerer en intern port som inngang i gruppen.
   *
   * Dette er nøkkelen til gjenbrukbare workflows: eksponer «Bunn» i
   * behandlingskjeden, og du kan koble hvilket som helst innhold inn i
   * gruppen senere. Uten en eksponert inngang er gruppen lukket.
   */
  exposeInput: (groupId, targetNode, targetPort) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== groupId || !n.group) return n
          const group = structuredClone(n.group)
          if (group.inputs.some((i) => i.targetNode === targetNode && i.targetPort === targetPort)) {
            return n
          }
          const target = group.nodes.find((node) => node.id === targetNode)
          if (!target) return n
          const port = nodePorts(target).inputs.find((p) => p.id === targetPort)
          if (!port) return n

          group.inputs.push({
            id: `in-${group.inputs.length}`,
            name: port.label,
            type: port.type,
            targetNode,
            targetPort,
            multiple: port.multiple,
          })
          return { ...n, group }
        }),
      },
      notice: 'Inngang eksponert. Koble en kilde til den nye porten.',
    })),

  /** Eksponerer en intern port som utgang fra gruppen. */
  exposeOutput: (groupId, sourceNode, sourcePort) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== groupId || !n.group) return n
          const group = structuredClone(n.group)
          if (group.outputs.some((o) => o.sourceNode === sourceNode && o.sourcePort === sourcePort)) {
            return n
          }
          const source = group.nodes.find((node) => node.id === sourceNode)
          if (!source) return n
          const port = nodePorts(source).outputs.find((p) => p.id === sourcePort)
          if (!port) return n

          group.outputs.push({
            id: `out-${group.outputs.length}`,
            name: port.label,
            type: port.type,
            sourceNode,
            sourcePort,
          })
          return { ...n, group }
        }),
      },
      notice: 'Utgang eksponert.',
    })),

  unexposeInput: (groupId, inputId) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== groupId || !n.group) return n
          const group = structuredClone(n.group)
          group.inputs = group.inputs.filter((i) => i.id !== inputId)
          return { ...n, group }
        }),
      },
      notice: null,
    })),

  unexposeOutput: (groupId, outputId) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== groupId || !n.group) return n
          const group = structuredClone(n.group)
          group.outputs = group.outputs.filter((o) => o.id !== outputId)
          return { ...n, group }
        }),
      },
      notice: null,
    })),

  /**
   * Setter en blokk fra biblioteket inn i grafen.
   *
   * Blokken blir en gruppe-node med egne interne node-ID-er, slik at den
   * er en selvstendig instans. Eksponerte innganger blir håndtak du kan
   * koble nytt innhold til.
   */
  insertBlock: (template, position) => {
    const { graph } = get()
    const groupId = nextId('block')
    const group = rekeySubgraph(
      {
        nodes: template.nodes,
        edges: template.edges,
        inputs: template.inputs,
        outputs: template.outputs,
      },
      groupId,
    )

    const node: GraphNode = {
      id: groupId,
      type: 'group',
      title: template.name,
      params: {},
      tracks: {},
      lfo: {},
      position: position ?? { x: 120, y: 120 },
      enabled: true,
      group,
    }

    set({
      graph: { ...graph, nodes: [...graph.nodes, node] },
      selected: groupId,
      selection: [groupId],
      notice: `Satte inn «${template.name}». Koble til eget innhold på inngangene.`,
    })
    return groupId
  },

  /**
   * Lagrer markerte noder som en blokk i biblioteket.
   *
   * Markeringen blir samtidig erstattet av en gruppe-node i grafen, slik
   * at du kan koble nye kilder inn i de eksponerte inngangene med én gang.
   */
  saveSelectionAsBlock: (name, description) => {
    const { graph, selection } = get()
    const picked = selection.filter((id) => graph.nodes.some((n) => n.id === id))
    if (!picked.length) {
      set({ notice: 'Merk nodene du vil lagre som en blokk.' })
      return null
    }

    const groupId = nextId('block')
    const { groupNode, remaining, template } = blockFromSelection(
      graph.nodes,
      graph.edges,
      picked,
      name,
      description,
    )
    const node = { ...groupNode, id: groupId, title: name }
    const edges = remaining

    set({
      graph: {
        ...graph,
        nodes: [...graph.nodes.filter((n) => !picked.includes(n.id)), node],
        edges,
      },
      selected: groupId,
      selection: [groupId],
      notice: `Lagret «${name}» i biblioteket.`,
    })

    // Blokken legges i biblioteket med én gang, slik at den kan brukes
    // på nytt innhold senere.
    useLibraryStore.getState().addBlock(template)

    return template
  },

  /** Koble fra en intern kobling i en gruppe. */
  disconnectGroupEdge: (groupId, edgeId) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== groupId || !n.group) return n
          const group = structuredClone(n.group)
          group.edges = group.edges.filter((e) => e.id !== edgeId)
          return { ...n, group }
        }),
      },
      notice: null,
    })),

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
          const params: Record<string, unknown> = {}
          for (const p of nodeParamDefs(n)) params[p.key] = p.default
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

  /**
   * Tar ett steg tilbake i endringene.
   *
   * Historikken er basert på øyeblikksbilder av grafen, så angres
   * gjenoppretter noder, koblinger, parametere og keyframes på én gang.
   */
  undo: () => {
    const graph = history.undo()
    if (!graph) return
    applyingHistory = true
    set({
      graph: structuredClone(graph),
      selected: null,
      selection: [],
      selectedEdges: [],
    })
    applyingHistory = false
    set({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      undoLabel: history.undoLabel,
      redoLabel: history.redoLabel,
    })
  },

  /** Tar ett steg fram i endringene. */
  redo: () => {
    const graph = history.redo()
    if (!graph) return
    applyingHistory = true
    set({
      graph: structuredClone(graph),
      selected: null,
      selection: [],
      selectedEdges: [],
    })
    applyingHistory = false
    set({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      undoLabel: history.undoLabel,
      redoLabel: history.redoLabel,
    })
  },

  clearHistory: () => {
    history.clear()
    set({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null })
  },

  select: (selected) => set({ selected, selection: selected ? [selected] : [] }),

  setSelection: (selection) => set({ selection, selected: selection[selection.length - 1] ?? null }),

  updateSelection: (id, selected) =>
    set((s) => {
      const has = s.selection.includes(id)
      if (selected && !has) return { selection: [...s.selection, id], selected: id }
      if (!selected && has) {
        const next = s.selection.filter((x) => x !== id)
        return { selection: next, selected: next[next.length - 1] ?? null }
      }
      return {}
    }),

  setSelectedEdges: (selectedEdges) => set({ selectedEdges }),

  reset: () => set({ graph: defaultGraph(), selected: null }),
}))

// Alle endringer i grafen registreres i historikken automatisk.
// Et abonnement fanger hver endring, og endringen beskrives med en etikett.
// Raske endringer med samme nøkkel (dragging, skyveknapper) slås sammen.
useGraphStore.subscribe((state, prev) => {
  if (state.graph === prev.graph) return
  if (applyingHistory) return

  const change = describeChange(prev.graph, state.graph)
  if (!change) return

  history.recordChange(prev.graph, state.graph, change.label, change.key)
  useGraphStore.setState({
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undoLabel: history.undoLabel,
    redoLabel: history.redoLabel,
  })
})
