import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnectStart,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../state/useGraphStore'
import { useConnectionDrag } from '../state/useConnectionDrag'
import {
  PARAM_PORT_PREFIX,
  canConnectTypes,
  nodeParamDefs,
  nodePorts,
} from '../engine/graph'
import { NodeCard } from './nodes/NodeCard'
import { NodeTabMenu } from './NodeTabMenu'
import { PortLegend } from './PortLegend'
import { PARAM_META, portMeta } from './portStyle'
import type { NodeDefinition } from '../engine/types'

const nodeTypes = { card: NodeCard }

interface MenuAnchor {
  x: number
  y: number
  host: { left: number; top: number; width: number; height: number }
}

/** Skal ikke stjele Tab fra felt og andre redigerbare elementer. */
function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true
  return !!target.closest(
    '[contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]',
  )
}

function FlowInner() {
  const graph = useGraphStore((s) => s.graph)
  const selection = useGraphStore((s) => s.selection)
  const selectedEdges = useGraphStore((s) => s.selectedEdges)
  const moveNode = useGraphStore((s) => s.moveNode)
  const connect = useGraphStore((s) => s.connect)
  const addNode = useGraphStore((s) => s.addNode)
  const updateSelection = useGraphStore((s) => s.updateSelection)
  const removeNode = useGraphStore((s) => s.removeNode)
  const disconnect = useGraphStore((s) => s.disconnect)
  const setSelectedEdges = useGraphStore((s) => s.setSelectedEdges)
  const groupSelection = useGraphStore((s) => s.groupSelection)
  const saveSelectionAsBlock = useGraphStore((s) => s.saveSelectionAsBlock)
  const drag = useConnectionDrag((s) => s.drag)
  const startDrag = useConnectionDrag((s) => s.start)
  const endDrag = useConnectionDrag((s) => s.end)
  const reactFlow = useReactFlow()

  const hostRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)

  useEffect(() => () => useConnectionDrag.getState().end(), [])

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'card',
        position: n.position,
        data: {},
        selected: selection.includes(n.id),
      })),
    [graph.nodes, selection],
  )

  const edges: Edge[] = useMemo(() => {
    const byId = new Map(graph.nodes.map((node) => [node.id, node]))

    return graph.edges.map((edge) => {
      let stroke = '#a3e635'

      if (edge.kind === 'param') {
        stroke = PARAM_META.color
      } else {
        const source = byId.get(edge.source)
        const port = source
          ? nodePorts(source).outputs.find((p) => p.id === edge.sourcePort)
          : undefined
        if (port) stroke = portMeta(port.type).color
      }

      const isSelected = selectedEdges.includes(edge.id)

      return {
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourcePort,
        target: edge.target,
        targetHandle: edge.targetPort,
        selected: isSelected,
        animated: edge.kind === 'param',
        style: {
          stroke,
          strokeWidth: isSelected ? 3 : edge.kind === 'param' ? 1.6 : 1.8,
          strokeDasharray: edge.kind === 'param' ? '4 3' : undefined,
          filter: isSelected ? `drop-shadow(0 0 3px ${stroke})` : undefined,
        },
      }
    })
  }, [graph.edges, graph.nodes, selectedEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position)
          continue
        }
        if (change.type === 'select') {
          // React Flow holder styringen; vi speiler markeringen i butikken.
          updateSelection(change.id, change.selected)
          continue
        }
        if (change.type === 'remove') {
          removeNode(change.id)
        }
      }
    },
    [moveNode, removeNode, updateSelection],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'select') {
          setSelectedEdges(change.selected ? [change.id] : [])
          continue
        }
        if (change.type === 'remove') {
          disconnect(change.id)
        }
      }
    },
    [disconnect, setSelectedEdges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      connect(
        connection.source,
        connection.sourceHandle ?? 'out',
        connection.target,
        connection.targetHandle ?? 'in',
      )
    },
    [connect],
  )

  /** Finner porttypen draget starter fra, slik at nodekortene kan lyse opp riktig. */
  const onConnectStart: OnConnectStart = useCallback(
    (_event, params) => {
      if (!params.nodeId || !params.handleId || !params.handleType) return
      const node = useGraphStore.getState().graph.nodes.find((n) => n.id === params.nodeId)
      if (!node) return

      const ports = nodePorts(node)

      if (params.handleType === 'source') {
        const port = ports.outputs.find((p) => p.id === params.handleId)
        if (!port) return
        startDrag({
          nodeId: node.id,
          portId: params.handleId,
          direction: 'source',
          type: port.type,
        })
        return
      }

      if (params.handleId.startsWith(PARAM_PORT_PREFIX)) {
        const key = params.handleId.slice(PARAM_PORT_PREFIX.length)
        const param = nodeParamDefs(node).find((p) => p.key === key)
        if (!param) return
        startDrag({
          nodeId: node.id,
          portId: params.handleId,
          direction: 'target',
          type: 'number',
          isParam: true,
        })
        return
      }

      const port = ports.inputs.find((p) => p.id === params.handleId)
      if (!port) return
      startDrag({
        nodeId: node.id,
        portId: params.handleId,
        direction: 'target',
        type: port.type,
      })
    },
    [startDrag],
  )

  const onConnectEnd = useCallback(() => endDrag(), [endDrag])

  /**
   * React Flow spør før en kobling fullføres. Da får brukeren «ulovlig»-markør
   * på feil typer, og vi slipper å lage kanter som butikken uansett avviser.
   */
  const isValidConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.source || !connection.target) return false
    if (connection.source === connection.target) return false

    const { graph } = useGraphStore.getState()
    const sourceNode = graph.nodes.find((n) => n.id === connection.source)
    const targetNode = graph.nodes.find((n) => n.id === connection.target)
    if (!sourceNode || !targetNode) return false

    const sourcePort = nodePorts(sourceNode).outputs.find(
      (p) => p.id === connection.sourceHandle,
    )
    if (!sourcePort) return false

    const targetHandle = connection.targetHandle ?? 'in'
    if (targetHandle.startsWith(PARAM_PORT_PREFIX)) {
      const key = targetHandle.slice(PARAM_PORT_PREFIX.length)
      const param = nodeParamDefs(targetNode).find((p) => p.key === key)
      return (
        sourcePort.type === 'number' &&
        !!param &&
        (param.type === 'number' || param.type === 'int')
      )
    }

    const targetPort = nodePorts(targetNode).inputs.find((p) => p.id === targetHandle)
    return !!targetPort && canConnectTypes(sourcePort.type, targetPort.type)
  }, [])

  const connectionLineStyle = useMemo(
    () =>
      drag
        ? {
            stroke: drag.isParam ? PARAM_META.color : portMeta(drag.type).color,
            strokeWidth: 2,
            strokeDasharray: drag.isParam ? '4 3' : undefined,
          }
        : undefined,
    [drag],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/smudge-node')
      if (!type) return
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      addNode(type, position)
    },
    [addNode, reactFlow],
  )

  /**
   * Tab åpner hurtigsøket på samme måte som i Houdini. Vi plasserer menyen
   * ved musepekeren når den er over lerretet, ellers midt på lerretet.
   *
   * Unntaket er felt og redigerbare elementer, der Tab fortsatt skal flytte
   * fokus. Står fokus på en knapp utenfor lerretet, og musepekeren ikke er
   * over lerretet, lar vi også Tab navigere som normalt.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.repeat || event.defaultPrevented) return
      if (event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.isComposing || menu) return

      const active = document.activeElement
      if (isTextEntryTarget(event.target) || isTextEntryTarget(active)) return

      const host = hostRef.current
      if (!host) return

      const rect = host.getBoundingClientRect()
      const pointer = pointerRef.current
      const inside =
        !!pointer &&
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      const focusInCanvas = active instanceof HTMLElement && host.contains(active)

      if (!inside && !focusInCanvas && active !== document.body) return

      event.preventDefault()
      setMenu({
        x: inside ? pointer.x : rect.left + rect.width / 2,
        y: inside ? pointer.y : rect.top + rect.height / 2,
        host: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      })
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menu])

  const closeTabMenu = useCallback(() => setMenu(null), [])

  const pickNode = useCallback(
    (def: NodeDefinition) => {
      if (!menu) return
      const position = reactFlow.screenToFlowPosition({ x: menu.x, y: menu.y })
      addNode(def.type, position)
      setMenu(null)
    },
    [addNode, menu, reactFlow],
  )

  /**
   * Delete/Backspace sletter det som er merket.
   *
   * Vi håndterer dette selv i stedet for å la React Flow gjøre det, fordi
   * grafen er kontrollert: da slipper vi å være avhengig av React Flows
   * interne merkingslogikk, og både noder og koblinger kan slettes.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return

      // Ikke når brukeren skriver i et felt.
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const state = useGraphStore.getState()
      const nodeIds = state.selection
      const edgeIds = state.selectedEdges
      if (!nodeIds.length && !edgeIds.length) return

      event.preventDefault()
      for (const id of edgeIds) state.disconnect(id)
      for (const id of nodeIds) state.removeNode(id)
      state.setSelection([])
      state.setSelectedEdges([])
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      ref={hostRef}
      className="relative h-full w-full"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onPointerMove={(event) => {
        pointerRef.current = { x: event.clientX, y: event.clientY }
      }}
      onPointerLeave={() => {
        pointerRef.current = null
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        connectionLineStyle={connectionLineStyle}
        deleteKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#27272a" gap={22} size={1} />
        <Controls className="!border-zinc-700 !bg-zinc-900 !fill-zinc-400" />
        <MiniMap
          pannable
          zoomable
          className="!border-zinc-700 !bg-zinc-900"
          style={{ width: 170, height: 120 }}
          maskColor="rgba(9, 9, 11, 0.72)"
          nodeColor={() => '#4d7c0f'}
          nodeStrokeColor="#a3e635"
          nodeBorderRadius={3}
        />
      </ReactFlow>

      <PortLegend />

      {drag && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/95 px-3 py-1.5 text-[10px] text-zinc-300 shadow-xl backdrop-blur">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: drag.isParam ? PARAM_META.color : portMeta(drag.type).color,
            }}
          />
          <span className="whitespace-nowrap">
            Slipp på en {drag.direction === 'source' ? 'inngang' : 'utgang'} med{' '}
            <strong className="font-semibold text-zinc-100">
              {drag.isParam ? 'Tall' : portMeta(drag.type).label}
            </strong>
          </span>
          <span className="hidden text-zinc-500 sm:inline">· like farger</span>
        </div>
      )}

      {selection.length > 0 && (
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {selection.length > 1 && (
            <button
              type="button"
              onClick={() => groupSelection()}
              className="rounded-lg border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-100 backdrop-blur transition hover:bg-violet-500/25"
            >
              ⬚ Lag gruppe ({selection.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('Navn på blokken', 'Min blokk')
              if (!name) return
              const description = window.prompt('Kort beskrivelse (valgfritt)', '') ?? undefined
              saveSelectionAsBlock(name, description)
            }}
            className="rounded-lg border border-lime-500/50 bg-lime-500/15 px-3 py-1.5 text-[11px] font-medium text-lime-100 backdrop-blur transition hover:bg-lime-500/25"
          >
            ⬚ Lag blokk ({selection.length})
          </button>
        </div>
      )}

      <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-zinc-600">
        Tab: legg til node · Dra noder fra paletten hit · Shift-klikk for å merke flere · Delete fjerner valgte noder og koblinger
      </span>

      {menu && (
        <NodeTabMenu
          anchor={{ x: menu.x, y: menu.y }}
          host={menu.host}
          onPick={pickNode}
          onClose={closeTabMenu}
        />
      )}
    </div>
  )
}

export function FlowCanvas() {
  return <FlowInner />
}
