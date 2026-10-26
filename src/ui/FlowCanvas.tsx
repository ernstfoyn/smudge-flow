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
import { useThemeStore } from '../state/useThemeStore'
import { useEditorStore } from '../state/useEditorStore'
import { isMediaFile, mediaParamsFromAsset, putAsset } from '../assets/media'
import { useConnectionDrag } from '../state/useConnectionDrag'
import {
  PARAM_PORT_PREFIX,
  canConnectTypes,
  nodeParamDefs,
  nodePorts,
} from '../engine/graph'
import { DRIVE_PORT_ID, drivableParams } from '../engine/drive'
import { layoutPositions, type NodeSize } from '../engine/layout'
import { NodeCard } from './nodes/NodeCard'
import { NodeTabMenu } from './NodeTabMenu'
import { PortLegend } from './PortLegend'
import { PARAM_META, portMeta } from './portStyle'
import type { NodeDefinition, NodeId } from '../engine/types'

const nodeTypes = { card: NodeCard }

interface MenuAnchor {
  x: number
  y: number
  host: { left: number; top: number; width: number; height: number }
  /** Når menyen ble åpnet på en kobling, skal valgt node settes inn der. */
  edgeId?: string
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

/** Finner koblingen nærmest et skjermpunkt, innenfor en liten radius. */
function edgeAtPoint(clientX: number, clientY: number, maxDistance = 24): string | null {
  let best: { id: string; distance: number } | null = null
  for (const path of document.querySelectorAll<SVGPathElement>('.react-flow__edge-path')) {
    const group = path.closest<HTMLElement>('.react-flow__edge')
    if (!group) continue
    const testId = group.getAttribute('data-testid') ?? group.id
    const id = testId.startsWith('rf__edge-')
      ? testId.slice('rf__edge-'.length)
      : testId || null
    if (!id) continue
    const matrix = path.getScreenCTM()
    if (!matrix) continue
    const length = path.getTotalLength()
    let distance = Number.POSITIVE_INFINITY
    for (let i = 0; i <= 24; i++) {
      const point = path.getPointAtLength((length * i) / 24).matrixTransform(matrix)
      distance = Math.min(distance, Math.hypot(point.x - clientX, point.y - clientY))
    }
    if (distance <= maxDistance && (!best || distance < best.distance)) {
      best = { id, distance }
    }
  }
  return best?.id ?? null
}

function FlowInner() {
  const graph = useGraphStore((s) => s.graph)
  const theme = useThemeStore((s) => s.theme)
  const selection = useGraphStore((s) => s.selection)
  const selectedEdges = useGraphStore((s) => s.selectedEdges)
  const moveNode = useGraphStore((s) => s.moveNode)
  const connect = useGraphStore((s) => s.connect)
  const addNode = useGraphStore((s) => s.addNode)
  const insertNodeOnEdge = useGraphStore((s) => s.insertNodeOnEdge)
  const setNodePositions = useGraphStore((s) => s.setNodePositions)
  const layoutRequest = useEditorStore((s) => s.layoutRequest)
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
  /** Startposisjonene når brukeren Alt-drar: da skal originalen bli stående. */
  const altDragRef = useRef<{ starts: Record<NodeId, { x: number; y: number }> } | null>(null)
  /** Alt-tasten holdes nede. Fanges opp, slik at draget ikke er avhengig av musens event. */
  const altKeyRef = useRef(false)
  const pointerRef = useRef<{ x: number; y: number } | null>(null)
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  const lastLayoutRequest = useRef(0)

  useEffect(() => () => useConnectionDrag.getState().end(), [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altKeyRef.current = true
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'Alt') altKeyRef.current = false
    }
    const clear = () => {
      altKeyRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
    }
  }, [])

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

      const dashed = edge.kind === 'param' || edge.kind === 'drive'

      if (dashed) {
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
        animated: dashed,
        style: {
          stroke,
          strokeWidth: isSelected ? 3 : edge.kind === 'drive' ? 2.4 : dashed ? 1.6 : 1.8,
          strokeDasharray: dashed ? '4 3' : undefined,
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

      if (params.handleId === DRIVE_PORT_ID) {
        startDrag({
          nodeId: node.id,
          portId: params.handleId,
          direction: 'target',
          type: 'number',
          isParam: true,
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
    if (targetHandle === DRIVE_PORT_ID) {
      return sourcePort.type === 'number' && drivableParams(nodeParamDefs(targetNode)).length > 0
    }
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
      if (event.defaultPrevented) return
      event.preventDefault()
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })

      const type = event.dataTransfer.getData('application/smudge-node')
      if (type) {
        if (event.shiftKey) {
          const edgeId = edgeAtPoint(event.clientX, event.clientY)
          if (edgeId) {
            insertNodeOnEdge(edgeId, type)
            return
          }
        }
        addNode(type, position)
        return
      }

      const file = Array.from(event.dataTransfer.files).find(isMediaFile)
      if (!file) return

      const targetElement = (event.target as HTMLElement | null)?.closest('.react-flow__node')
      const targetId = targetElement?.getAttribute('data-id')
      const targetNode = targetId
        ? useGraphStore.getState().graph.nodes.find((n) => n.id === targetId)
        : undefined

      // Slippes filen oppå en Bilde/video-node, byttes filen på den noden.
      // På andre noder skjer ingenting; slipp på lerretet i stedet.
      let id: NodeId | null
      if (targetNode) {
        if (targetNode.type !== 'source.image') return
        id = targetNode.id
      } else {
        id = addNode('source.image', position)
      }
      if (!id) return
      void putAsset(file)
        .then((asset) => useGraphStore.getState().setParams(id, mediaParamsFromAsset(asset)))
        .catch((err) =>
          useGraphStore.setState({
            notice: (err as Error)?.message ?? 'Kunne ikke lagre filen.',
          }),
        )
    },
    [addNode, insertNodeOnEdge, reactFlow],
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
      const selected = useGraphStore.getState().selectedEdges
      setMenu({
        x: inside ? pointer.x : rect.left + rect.width / 2,
        y: inside ? pointer.y : rect.top + rect.height / 2,
        host: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        edgeId: selected.length === 1 ? selected[0] : undefined,
      })
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menu])

  const closeTabMenu = useCallback(() => setMenu(null), [])

  const arrangeNodes = useCallback(() => {
    const sizes = new Map<NodeId, NodeSize>()
    for (const node of reactFlow.getNodes()) {
      sizes.set(node.id, {
        width: node.measured?.width ?? 232,
        height: node.measured?.height ?? 180,
      })
    }
    const positions = layoutPositions(useGraphStore.getState().graph, sizes)
    setNodePositions(positions)
    window.requestAnimationFrame(() => {
      void reactFlow.fitView({ padding: 0.2, duration: 350 })
    })
  }, [reactFlow, setNodePositions])

  useEffect(() => {
    if (layoutRequest === lastLayoutRequest.current) return
    lastLayoutRequest.current = layoutRequest
    arrangeNodes()
  }, [layoutRequest, arrangeNodes])

  const pickNode = useCallback(
    (def: NodeDefinition) => {
      if (!menu) return
      if (menu.edgeId) {
        insertNodeOnEdge(menu.edgeId, def.type)
      } else {
        const position = reactFlow.screenToFlowPosition({ x: menu.x, y: menu.y })
        addNode(def.type, position)
      }
      setMenu(null)
    },
    [addNode, insertNodeOnEdge, menu, reactFlow],
  )

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    setMenu({
      x: event.clientX,
      y: event.clientY,
      host: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      edgeId: edge.id,
    })
  }, [])

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

  /** Grafposisjonen under musepekeren, når den er over lerretet. */
  const positionAtPointer = useCallback((): { x: number; y: number } | undefined => {
    const pointer = pointerRef.current
    const host = hostRef.current
    if (!pointer || !host) return undefined
    const rect = host.getBoundingClientRect()
    const inside =
      pointer.x >= rect.left && pointer.x <= rect.right &&
      pointer.y >= rect.top && pointer.y <= rect.bottom
    return inside ? reactFlow.screenToFlowPosition(pointer) : undefined
  }, [reactFlow])

  /**
   * P forhåndsviser valgt node; P igjen (eller Escape) går tilbake til Viewport.
   * Ignoreres når en dialog er åpen eller brukeren skriver i et felt.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (document.querySelector('[role="dialog"]')) return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const state = useGraphStore.getState()
      if (event.key.toLowerCase() === 'p') {
        event.preventDefault()
        if (!state.selection.length) {
          state.clearPreview()
          return
        }
        state.togglePreviewNode(state.selection[state.selection.length - 1])
        return
      }
      if (event.key === 'Escape' && state.preview) {
        event.preventDefault()
        state.clearPreview()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * Kopier og dupliser. Cmd/Ctrl + C / D.
   * Lim inn håndteres av «paste»-hendelsen lenger ned.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return

      const key = event.key.toLowerCase()
      if (key !== 'c' && key !== 'd') return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const state = useGraphStore.getState()
      if (key === 'c') {
        if (!state.selection.length) return
        event.preventDefault()
        state.copySelection()
        return
      }
      if (!state.selection.length) return
      event.preventDefault()
      state.duplicateSelection()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * Lim inn: bilde/video fra systemets utklippstavle, eller noder som er
   * kopiert i appen. Vi bruker «paste»-hendelsen, fordi nettleseren bare
   * gir tilgang til filer der.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const data = event.clipboardData
      if (!data) return

      const files = Array.from(data.files)
      if (!files.length) {
        for (const item of Array.from(data.items ?? [])) {
          if (item.kind !== 'file') continue
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
      const media = files.find(isMediaFile)
      if (media) {
        event.preventDefault()
        const id = useGraphStore
          .getState()
          .addNode('source.image', positionAtPointer() ?? { x: 120, y: 120 })
        if (!id) return
        void putAsset(media)
          .then((asset) => useGraphStore.getState().setParams(id, mediaParamsFromAsset(asset)))
          .catch((err) =>
            useGraphStore.setState({
              notice: (err as Error)?.message ?? 'Kunne ikke lagre filen.',
            }),
          )
        return
      }

      if (useGraphStore.getState().hasClipboard()) {
        event.preventDefault()
        useGraphStore.getState().pasteClipboard(positionAtPointer())
      }
    }

    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [positionAtPointer])

  /**
   * Alt/Option + dra: kopien havner der du slipper, og originalen blir stående.
   * Vi venter til draget er ferdig, fordi React Flow da har sluttposisjonen.
   */
  const onNodeDragStart = useCallback((event: MouseEvent | TouchEvent, node: Node) => {
    const alt = (event instanceof MouseEvent && event.altKey) || altKeyRef.current
    if (!alt) {
      altDragRef.current = null
      return
    }
    const state = useGraphStore.getState()
    const ids = state.selection.includes(node.id) ? state.selection : [node.id]
    const starts: Record<NodeId, { x: number; y: number }> = {}
    for (const id of ids) {
      const current = state.graph.nodes.find((n) => n.id === id)
      if (current) starts[id] = { ...current.position }
    }
    altDragRef.current = { starts }
  }, [])

  const onNodeDragStop = useCallback(() => {
    const drag = altDragRef.current
    altDragRef.current = null
    if (!drag) return

    const state = useGraphStore.getState()
    const moved = Object.entries(drag.starts).some(([id, start]) => {
      const node = state.graph.nodes.find((n) => n.id === id)
      return node && (Math.abs(node.position.x - start.x) > 2 || Math.abs(node.position.y - start.y) > 2)
    })
    if (!moved) return
    state.duplicateSelection({ x: 0, y: 0 }, drag.starts)
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
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        isValidConnection={isValidConnection}
        connectionLineStyle={connectionLineStyle}
        colorMode={theme}
        deleteKeyCode={null}
        multiSelectionKeyCode={['Meta', 'Control', 'Shift']}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color={theme === 'dark' ? '#27272a' : '#c0c0c8'} gap={22} size={1} />
        <Controls className="!border-zinc-700 !bg-zinc-900 !fill-zinc-400" />
        <MiniMap
          pannable
          zoomable
          className="!border-zinc-700 !bg-zinc-900"
          style={{ width: 170, height: 120 }}
          maskColor={theme === 'dark' ? 'rgba(9, 9, 11, 0.72)' : 'rgba(230, 230, 234, 0.72)'}
          nodeColor={() => '#4d7c0f'}
          nodeStrokeColor="#a3e635"
          nodeBorderRadius={3}
        />
      </ReactFlow>

      <PortLegend />

      {drag && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/95 px-3 py-1.5 text-[10px] text-zinc-300 shadow-xl backdrop-blur">
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
        <div className="absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-2">
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

      <span className="pointer-events-none absolute bottom-2 left-2 right-2 truncate text-[10px] text-zinc-600">
        Tab: legg til node · Tab på valgt kobling: sett inn · Shift + dra fra paletten til en kobling: sett inn · Delete fjerner valgte noder og koblinger
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
