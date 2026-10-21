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
        onConnect={onConnect}
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
      <span className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-zinc-600">
        Dra noder fra paletten hitte · klikk i en port for å koble
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
