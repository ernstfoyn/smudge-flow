import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useGraphStore } from '../state/useGraphStore'
import { NodeCard } from './nodes/NodeCard'

const nodeTypes = { card: NodeCard }

function FlowInner() {
  const graph = useGraphStore((s) => s.graph)
  const moveNode = useGraphStore((s) => s.moveNode)
  const connect = useGraphStore((s) => s.connect)
  const addNode = useGraphStore((s) => s.addNode)
  const setSelection = useGraphStore((s) => s.setSelection)
  const groupSelection = useGraphStore((s) => s.groupSelection)
  const selection = useGraphStore((s) => s.selection)
  const reactFlow = useReactFlow()

  const nodes: Node[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'card',
        position: n.position,
        data: {},
      })),
    [graph.nodes],
  )

  const edges: Edge[] = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        sourceHandle: e.sourcePort,
        target: e.target,
        targetHandle: e.targetPort,
        style: { stroke: '#a3e635', strokeWidth: 1.6 },
      })),
    [graph.edges],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          moveNode(change.id, change.position)
        }
      }
    },
    [moveNode],
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

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      setSelection(selectedNodes.map((n) => n.id))
    },
    [setSelection],
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

  return (
    <div className="h-full w-full" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
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

      {selection.length > 1 && (
        <button
          type="button"
          onClick={() => groupSelection()}
          className="absolute left-3 top-3 rounded-lg border border-violet-500/50 bg-violet-500/15 px-3 py-1.5 text-[11px] font-medium text-violet-100 backdrop-blur transition hover:bg-violet-500/25"
        >
          ⬚ Lag gruppe ({selection.length} noder)
        </button>
      )}

      <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-zinc-600">
        Dra noder fra paletten hitte · Shift-klikk for å merke flere · lille håndtak styrer parametere
      </span>
    </div>
  )
}

export function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  )
}
