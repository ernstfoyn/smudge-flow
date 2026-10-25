import { create } from 'zustand'
import type { DriveSettings, Graph, GraphEdge, GraphNode, GraphSettings, Keyframe, KeyframeEasing, LfoConfig, NodeId } from '../engine/types'
import {
  PARAM_PORT_PREFIX,
  canConnectTypes,
  createGroupFromSelection,
  createNode,
  explodeGroup,
  findPort,
  nodeParamDefs,
  nodePorts,
  rekeySubgraph,
  remapLayerKeys,
} from '../engine/graph'
import { wouldCreateCycle } from '../engine/topoSort'
import { DEFAULT_DRIVE, DRIVE_PORT_ID, SIGNAL_NODE_TYPE, drivableParams } from '../engine/drive'
import { upsertKey } from '../engine/animation/keyframes'
import { registry } from '../nodes'
import { blockFromSelection } from '../blocks/builder'
import { useLibraryStore } from './useLibraryStore'
import { previewPortFor, type PreviewTarget } from '../engine/preview'
import type { BlockTemplate } from '../blocks/types'
import type { TrailStamp } from '../nodes/modifier/trail'
import type { LayerSettings } from '../nodes/composite/stack'
import { defaultGraph, makeNode } from './defaultGraph'
import { EditHistory } from './history'

interface GraphState {
  graph: Graph
  selected: NodeId | null
  /** Markert utvalg (brukkes til å lage grupper). */
  selection: NodeId[]
  /** Markerte koblinger (kan slettes med Delete). */
  selectedEdges: string[]
  /** Noden som forhåndsvises i stedet for Viewport, eller null. */
  preview: PreviewTarget | null
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
  /** Viser valgt node i forhåndsvisningen, eller går tilbake til Viewport. */
  togglePreviewNode: (id: NodeId) => void
  /** Går tilbake til Viewport. */
  clearPreview: () => void

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
  /** Kopierer markerte noder og kablene mellom dem. Returnerer antall noder. */
  copySelection: () => number
  /** Ligger det noder på appens interne utklippstavle? */
  hasClipboard: () => boolean
  /**
   * Limer inn det som sist ble kopiert. `position` er øvre venstre hjørne i
   * grafkoordinater; uten den brukes et lite sprang fra originalen.
   */
  pasteClipboard: (position?: { x: number; y: number }) => NodeId[]
  /**
   * Dupliserer markerte noder. `restorePositions` brukes av Alt-dra: da
   * lages kopiene der originalen ble sluppet, og originalen flyttes tilbake.
   */
  duplicateSelection: (
    offset?: { x: number; y: number },
    restorePositions?: Record<NodeId, { x: number; y: number }>,
  ) => NodeId[]
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
  /** Erstatter hele nodetreet med en blokk og en viewport. */
  replaceWithBlock: (template: BlockTemplate) => NodeId | null
  /** Lagrer markerte noder som en blokk i biblioteket. */
  saveSelectionAsBlock: (name: string, description?: string) => BlockTemplate | null

  setParam: (id: NodeId, key: string, value: unknown) => void
  /** Setter flere parametere på én gang (ett historikksteg). */
  setParams: (id: NodeId, patch: Record<string, unknown>) => void
  /** Setter innstillinger for ett lag i en lagstabel (nøklet på kant-id). */
  setLayerSetting: (id: NodeId, edgeId: string, patch: Partial<LayerSettings>) => void
  resetParams: (id: NodeId) => void
  setKeyframe: (id: NodeId, path: string, frame: number, value: unknown) => void
  /** Endrer overgangen fra en keyframe til neste. */
  setKeyframeEasing: (id: NodeId, path: string, frame: number, easing: KeyframeEasing) => void
  removeKeyframe: (id: NodeId, path: string, frame: number) => void
  setLfo: (id: NodeId, path: string, patch: Partial<LfoConfig>) => void

  setSettings: (patch: Partial<GraphSettings>) => void
  /** Endrer innstillingene (styrke, hvilken parameter) på en signalkobling. */
  setDrive: (edgeId: string, patch: Partial<DriveSettings>) => void
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

interface SelectionClipboard {
  nodes: GraphNode[]
  edges: GraphEdge[]
  /** Hvor mange ganger den er limt inn, så gjentatt lim ikke legger alt oppå hverandre. */
  pasteCount: number
}

let selectionClipboard: SelectionClipboard | null = null

/**
 * Lager nye noder og kabler av et utvalg. Nye ID-er overalt, og kabler som
 * bare gikk mellom de kopierte nodene, følger med. Kabler ut av utvalget
 * kopieres ikke — de ville pekt på noe kopien ikke eier.
 */
function cloneSelection(
  nodes: GraphNode[],
  edges: GraphEdge[],
  delta: { x: number; y: number },
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const selected = new Set(nodes.map((node) => node.id))
  const idMap = new Map<NodeId, NodeId>()
  const edgeMap = new Map<string, string>()

  const copies = nodes.map((node) => {
    const id = nextId(node.type)
    idMap.set(node.id, id)
    const copy = structuredClone(node)
    copy.id = id
    copy.position = { x: node.position.x + delta.x, y: node.position.y + delta.y }
    if (copy.group) copy.group = rekeySubgraph(copy.group, id)
    return copy
  })

  const copiedEdges = edges
    .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
    .map((edge) => {
      const source = idMap.get(edge.source)!
      const target = idMap.get(edge.target)!
      const id = `${source}.${edge.sourcePort}->${target}.${edge.targetPort}`
      edgeMap.set(edge.id, id)
      return { ...structuredClone(edge), id, source, target }
    })

  // Lagstabelens per-lag-innstillinger er nøklet på kabel-ID-er.
  for (const copy of copies) {
    copy.params = remapLayerKeys(copy.params, edgeMap)
  }

  return { nodes: copies, edges: copiedEdges }
}

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

/**
 * Lager en gruppe-node av en blokk.
 *
 * Blokken får unike interne ID-er, men beholder de eksponerte portenes
 * ID-er, slik at ytre koblinger kan peke på dem.
 */
function blockNode(template: BlockTemplate, id: NodeId, position: { x: number; y: number }): GraphNode {
  return {
    id,
    type: 'group',
    title: template.name,
    params: {},
    tracks: {},
    lfo: {},
    position,
    enabled: true,
    group: rekeySubgraph(
      {
        nodes: template.nodes,
        edges: template.edges,
        inputs: template.inputs,
        outputs: template.outputs,
      },
      id,
    ),
  }
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

  for (const edge of next.edges) {
    if (edge.kind !== 'drive') continue
    const before = prev.edges.find((e) => e.id === edge.id)
    if (before && JSON.stringify(before.drive) !== JSON.stringify(edge.drive)) {
      return { label: 'Endret styring', key: `drive:${edge.id}` }
    }
  }

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
  preview: null,
  notice: null,
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,

  setGraph: (graph) => set({ graph, preview: null }),

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
      preview: s.preview?.nodeId === id ? null : s.preview,
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

  togglePreviewNode: (id) => {
    const { graph, preview } = get()
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return

    if (preview?.nodeId === id) {
      set({ preview: null })
      return
    }

    const portId = previewPortFor(node)
    if (!portId) {
      set({
        notice: `«${node.title}» har ingen bildeutgang å forhåndsvise. 3D-objekter må gjennom en 3D-scene først.`,
      })
      return
    }

    set({ preview: { nodeId: id, portId }, notice: null })
  },

  clearPreview: () => set({ preview: null }),

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

    // --- Styring: et signal som modulerer parametere -----------------------
    if (targetPort === DRIVE_PORT_ID) {
      if (outPort.type !== 'number') {
        set({ notice: 'Styring tar bare imot tall.' })
        return false
      }
      if (!drivableParams(nodeParamDefs(targetNode)).length) {
        set({ notice: `«${targetNode.title}» har ingen parametere som kan styres.` })
        return false
      }

      const id = `${source}.${sourcePort}->${target}.${targetPort}`
      if (graph.edges.some((e) => e.id === id)) {
        set({ notice: 'Denne forbindelsen finnes allerede.' })
        return false
      }
      // Flere signaler kan styre samme node: effektene legges sammen.
      set({
        graph: {
          ...graph,
          edges: [
            ...graph.edges,
            { id, source, sourcePort, target, targetPort, kind: 'drive', drive: { ...DEFAULT_DRIVE } },
          ],
        },
        notice: `«${sourceNode.title}» styrer «${targetNode.title}». Marker «${targetNode.title}» for å justere styrke og velge parameter.`,
      })
      return true
    }

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

      // Et signal til en diamant moduleres rundt grunnverdien (kun denne parameteren).
      if (sourceNode.type === SIGNAL_NODE_TYPE) {
        if (graph.edges.some((e) => e.id === id)) {
          set({ notice: 'Denne forbindelsen finnes allerede.' })
          return false
        }
        set({
          graph: {
            ...graph,
            edges: [
              ...graph.edges,
              {
                id, source, sourcePort, target, targetPort,
                kind: 'drive',
                drive: { ...DEFAULT_DRIVE, param: key },
              },
            ],
          },
          notice: `«${param.label}» styres nå av «${sourceNode.title}». Marker «${targetNode.title}» for å justere styrken.`,
        })
        return true
      }

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

  hasClipboard: () => !!selectionClipboard?.nodes.length,

  copySelection: () => {
    const { graph, selection } = get()
    const ids = new Set(selection)
    if (!ids.size) return 0

    const nodes = graph.nodes.filter((node) => ids.has(node.id))
    if (!nodes.length) return 0

    const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    selectionClipboard = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      pasteCount: 0,
    }
    return nodes.length
  },

  pasteClipboard: (position) => {
    const clipboard = selectionClipboard
    if (!clipboard?.nodes.length) return []

    let delta: { x: number; y: number }
    if (position) {
      const minX = Math.min(...clipboard.nodes.map((n) => n.position.x))
      const minY = Math.min(...clipboard.nodes.map((n) => n.position.y))
      delta = { x: position.x - minX, y: position.y - minY }
    } else {
      const step = 40 + clipboard.pasteCount * 20
      delta = { x: step, y: step }
    }
    clipboard.pasteCount += 1

    const { nodes, edges } = cloneSelection(clipboard.nodes, clipboard.edges, delta)
    if (!nodes.length) return []

    const ids = nodes.map((node) => node.id)
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: [...s.graph.nodes, ...nodes],
        edges: [...s.graph.edges, ...edges],
      },
      selected: ids[ids.length - 1],
      selection: ids,
      selectedEdges: [],
    }))
    return ids
  },

  duplicateSelection: (offset = { x: 40, y: 40 }, restorePositions) => {
    const { graph, selection } = get()
    const ids = new Set(selection)
    const sources = graph.nodes.filter((node) => ids.has(node.id))
    if (!sources.length) return []

    const { nodes, edges } = cloneSelection(sources, graph.edges, offset)
    if (!nodes.length) return []
    const newIds = nodes.map((node) => node.id)

    const originals = restorePositions
      ? graph.nodes.map((node) => {
          const position = restorePositions[node.id]
          return position ? { ...node, position } : node
        })
      : graph.nodes

    set({
      graph: {
        ...graph,
        nodes: [...originals, ...nodes],
        edges: [...graph.edges, ...edges],
      },
      selected: newIds[newIds.length - 1],
      selection: newIds,
      selectedEdges: [],
    })
    return newIds
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
    const node = blockNode(template, groupId, position ?? { x: 120, y: 120 })

    set({
      graph: { ...graph, nodes: [...graph.nodes, node] },
      selected: groupId,
      selection: [groupId],
      notice: `Satte inn «${template.name}». Koble til eget innhold på inngangene.`,
    })
    return groupId
  },

  /**
   * Bytter ut hele nodetreet med en blokk.
   *
   * Prosjektinnstillingene (fps, lengde, oppløsning) beholdes — det er
   * bare grafen som erstattes. Blokkens første eksponerte utgang kobles
   * til en ny viewport, slik at resultatet vises med én gang.
   */
  replaceWithBlock: (template) => {
    const { graph } = get()
    const groupId = nextId('block')
    const node = blockNode(template, groupId, { x: 220, y: 160 })
    const out = createNode('output.viewport', nextId('out'), { x: 640, y: 200 })
    out.title = 'Viewport'

    const first = node.group?.outputs[0]
    const edges: GraphEdge[] = first
      ? [
          {
            id: `${node.id}.${first.id}->${out.id}.frame`,
            source: node.id,
            sourcePort: first.id,
            target: out.id,
            targetPort: 'frame',
            kind: 'value',
          },
        ]
      : []

    set({
      graph: { ...graph, nodes: [node, out], edges },
      selected: groupId,
      selection: [groupId],
      notice: `Erstattet grafen med «${template.name}».`,
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

  setParams: (id, patch) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) =>
          n.id === id ? { ...n, params: { ...n.params, ...patch } } : n,
        ),
      },
    })),

  /**
   * Setter innstillinger for ett lag i en lagstabel.
   *
   * Nøkkelen er kant-id, som er deterministisk (`kilde.port->mål.port`).
   * Derfor følger innstillingene laget når det flyttes, og kommer tilbake
   * hvis laget kobles fra og til igjen.
   */
  setLayerSetting: (id, edgeId, patch) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id) return n
          const layers = (n.params.layers ?? {}) as Record<string, LayerSettings>
          const current = layers[edgeId]
          const next: LayerSettings = {
            mode: current?.mode ?? ((n.params.mode as LayerSettings['mode']) ?? 'normal'),
            opacity: current?.opacity ?? Number(n.params.opacity ?? 1),
            visible: current?.visible ?? true,
            ...patch,
          }
          return { ...n, params: { ...n.params, layers: { ...layers, [edgeId]: next } } }
        }),
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

  setKeyframeEasing: (id, path, frame, easing) =>
    set((s) => ({
      graph: {
        ...s.graph,
        nodes: s.graph.nodes.map((n) => {
          if (n.id !== id || !n.tracks?.[path]) return n
          return {
            ...n,
            tracks: {
              ...n.tracks,
              [path]: n.tracks[path].map((k) =>
                k.frame === frame ? { ...k, interpolation: easing } : k,
              ),
            },
          }
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

  setDrive: (edgeId, patch) =>
    set((s) => ({
      graph: {
        ...s.graph,
        edges: s.graph.edges.map((e) =>
          e.id === edgeId && e.kind === 'drive'
            ? { ...e, drive: { ...DEFAULT_DRIVE, ...e.drive, ...patch } }
            : e,
        ),
      },
    })),

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

  reset: () => set({ graph: defaultGraph(), selected: null, preview: null }),
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
