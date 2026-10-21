import type { Graph, GraphNode, NodeId } from '../engine/types'
import { createEdge, createGraph, createNode } from '../engine/graph'
import { registry } from '../nodes'

/** Bygger en node med parameterdefaults hentet fra registret. */
export function makeNode(type: string, id: NodeId, position: { x: number; y: number }): GraphNode {
  const def = registry.get(type)
  const params: Record<string, unknown> = {}
  for (const p of def.params) params[p.key] = p.default
  const node = createNode(type, id, position, params)
  node.title = def.label
  return node
}

/**
 * Startgraf: en generativ bakgrunn + et generativt lag, blandet sammen.
 * Åpner appen med noe som faktisk beveger seg.
 */
export function defaultGraph(): Graph {
  const graph = createGraph()

  const gradient = makeNode('source.gradient', 'gradient-1', { x: 0, y: 40 })
  gradient.params = { ...gradient.params, fill: 'radial', colorA: '#1b2a4a', colorB: '#05050a' }

  const motion = makeNode('source.motionGraphics', 'motion-1', { x: 0, y: 300 })
  motion.params = {
    ...motion.params,
    motion: 'dotfield',
    count: 48,
    size: 90,
    colorA: '#b9ff66',
    colorB: '#4bdac5',
  }

  const blendNode = makeNode('composite.blend', 'blend-1', { x: 420, y: 160 })
  blendNode.params = { ...blendNode.params, mode: 'screen', opacity: 0.9 }

  const out = makeNode('output.viewport', 'out-1', { x: 720, y: 160 })

  graph.nodes = [gradient, motion, blendNode, out]
  graph.edges = [
    createEdge('gradient-1', 'out', 'blend-1', 'base'),
    createEdge('motion-1', 'out', 'blend-1', 'top'),
    createEdge('blend-1', 'out', 'out-1', 'frame'),
  ]

  return graph
}
