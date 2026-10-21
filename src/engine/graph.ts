import type {
  Graph,
  GraphEdge,
  GraphNode,
  GraphSettings,
  NodeId,
  PortDef,
  ValueType,
} from './types'

export const DEFAULT_SETTINGS: GraphSettings = {
  width: 960,
  height: 960,
  fps: 60,
  frames: 360,
  loop: true,
  background: '#0b0b12',
}

export function createGraph(settings: Partial<GraphSettings> = {}): Graph {
  return {
    version: 1,
    nodes: [],
    edges: [],
    settings: { ...DEFAULT_SETTINGS, ...settings },
  }
}

export function createNode(
  type: string,
  id: NodeId,
  position: { x: number; y: number },
  params: Record<string, unknown> = {},
): GraphNode {
  return {
    id,
    type,
    title: type,
    params,
    tracks: {},
    lfo: {},
    position,
    enabled: true,
  }
}

export function createEdge(
  source: NodeId,
  sourcePort: string,
  target: NodeId,
  targetPort: string,
): GraphEdge {
  return { id: `${source}.${sourcePort}->${target}.${targetPort}`, source, sourcePort, target, targetPort }
}

/**
 * Port-kompatibilitet. Bevisst konservativ: bare identisk type (eller
 * 'drawable' → 'canvas') er tillatt. Alt annet krever en eksplisitt bro-node.
 */
export function canConnectTypes(source: ValueType, target: ValueType): boolean {
  if (source === target) return true
  return source === 'drawable' && target === 'canvas'
}

/** Finner port-definisjonen for en kant. */
export function findPort(
  ports: readonly PortDef[],
  portId: string,
): PortDef | undefined {
  return ports.find((p) => p.id === portId)
}

/** Alle noder som er uten inngående kant (dvs. kilder). */
export function sourceNodes(graph: Graph): GraphNode[] {
  const targets = new Set(graph.edges.map((e) => e.target))
  return graph.nodes.filter((n) => !targets.has(n.id))
}

/** Alle noder som ikke går videre til noe annet (dvs. utganger). */
export function sinkNodes(graph: Graph): GraphNode[] {
  const sources = new Set(graph.edges.map((e) => e.source))
  return graph.nodes.filter((n) => !sources.has(n.id))
}

export function serializeGraph(graph: Graph): string {
  return JSON.stringify(graph, null, 2)
}

export function deserializeGraph(raw: string): Graph {
  const parsed = JSON.parse(raw) as Partial<Graph>
  return {
    version: 1,
    nodes: parsed.nodes ?? [],
    edges: parsed.edges ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
  }
}
