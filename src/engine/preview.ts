import type { Graph, GraphNode, NodeId, ValueType } from './types'
import { nodePorts } from './graph'

/** Hva som kan vises i forhåndsvisningen: ferdige bilder, ikke 3D-objekter. */
export type PreviewTarget = {
  nodeId: NodeId
  portId: string
}

export function isPreviewableType(type: ValueType): boolean {
  return type === 'canvas' || type === 'drawable' || type === 'frame'
}

/** Første utgang på noden som kan vises som bilde, eller null. */
export function previewPortFor(node: GraphNode): string | null {
  return nodePorts(node).outputs.find((port) => isPreviewableType(port.type))?.id ?? null
}

/**
 * Hvilken node og port forhåndsvisningen skal evaluere.
 *
 * En gyldig node-forhåndsvisning vinner. Ellers brukes Viewport, som er
 * standardmålet. Er noden borte eller utgangen ikke lenger et bilde, faller
 * vi tilbake til Viewport i stedet for å vise en gammel ramme.
 */
export function resolvePreviewTarget(
  graph: Graph,
  preview: PreviewTarget | null,
): PreviewTarget | null {
  if (preview) {
    const node = graph.nodes.find((n) => n.id === preview.nodeId)
    const port = node
      ? nodePorts(node).outputs.find(
          (p) => p.id === preview.portId && isPreviewableType(p.type),
        )
      : undefined
    if (node && port) return { nodeId: node.id, portId: port.id }
  }

  const viewport = graph.nodes.find((n) => n.type === 'output.viewport')
  return viewport ? { nodeId: viewport.id, portId: 'frame' } : null
}
