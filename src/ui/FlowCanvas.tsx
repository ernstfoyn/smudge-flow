import { useCallback, useEffect, useMemo } from 'react'
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
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../state/useGraphStore'
import { NodeCard } from './nodes/NodeCard'

const nodeTypes = { card: NodeCard }

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
  const reactFlow = useReactFlow()

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

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourcePort,
        target: e.target,
        targetHandle: e.targetPort,
        selected: selectedEdges.includes(e.id),
        animated: e.kind === 'param',
        style: {
          stroke: e.kind === 'param' ? '#c084fc' : '#a3e635',
          strokeWidth: e.kind === 'param' ? 1.4 : 1.6,
          strokeDasharray: e.kind === 'param' ? '4 3' : undefined,
        },
      })),
    [graph.edges, selectedEdges],
  )

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
    <div className="h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        Dra noder fra paletten hitte · Shift-klikk for å merke flere · Delete fjerner valgte noder og koblinger
      </span>
    </div>
  )
}

export function FlowCanvas() {
  return <FlowInner />
}
