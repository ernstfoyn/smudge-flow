import type {
  EvalContext,
  Graph,
  InputValues,
  NodeId,
  Outputs,
} from './types'
import { topoSort } from './topoSort'
import { GraphError } from './errors'
import { resolveParamsAt } from './params'
import type { NodeRegistry } from './registry'
import type { RenderServices } from './types'

export interface EvaluateOptions {
  signal?: AbortSignal
}

/**
 * Evaluerer grafen for én frame.
 *
 * 1. Topologisk sortering av delgrafen som mater målene.
 * 2. For hver node: resolve params (keyframes → LFO → clamp),
 *    hent input fra allerede evaluerte noder, kjør evaluate().
 * 3. Resultatet mellomlagres, slik at flere mål (preview + eksport)
 *    kan dele samme frame-evaluering.
 */
export class Evaluator {
  /** Ressurser som lever over frames, per node (textures, masker). */
  private nodeCaches = new Map<NodeId, Map<string, unknown>>()
  /** Resultater for noder med cache: 'static'. */
  private staticCache = new Map<string, Outputs>()

  constructor(
    private registry: NodeRegistry,
    private render: RenderServices,
  ) {}

  async evaluateFrame(
    graph: Graph,
    frame: number,
    targets: NodeId[],
    options: EvaluateOptions = {},
  ): Promise<Map<NodeId, Outputs>> {
    const { order, errors } = topoSort(graph, targets)
    if (errors.length) throw new GraphError(errors.join('\n'))

    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    const incoming = new Map<string, Graph['edges'][number]>()
    for (const e of graph.edges) incoming.set(`${e.target}\u0000${e.targetPort}`, e)

    const s = graph.settings
    const phase = frame / Math.max(1, s.frames)
    const outputs = new Map<NodeId, Outputs>()

    for (const id of order) {
      if (options.signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')

      const node = byId.get(id)!
      const def = this.registry.get(node.type)
      const params = resolveParamsAt(node, frame, phase, def)

      const inputs: InputValues = {}
      for (const port of def.inputs) {
        const edge = incoming.get(`${id}\u0000${port.id}`)
        const value = edge ? outputs.get(edge.source)?.[edge.sourcePort] : undefined
        if (value === undefined && !port.optional) {
          throw new GraphError(
            `«${node.title}» mangler input «${port.label}» — koble en kilde til porten.`,
          )
        }
        inputs[port.id] = value
      }

      const ctx: EvalContext = {
        nodeId: id,
        frame,
        fps: s.fps,
        totalFrames: s.frames,
        time: frame / s.fps,
        phase,
        width: s.width,
        height: s.height,
        render: this.render,
        nodeCache: this.nodeCache(id),
        signal: options.signal,
      }

      const cacheKey = `${id}:${s.width}x${s.height}`
      let result = def.cache === 'static' ? this.staticCache.get(cacheKey) : undefined
      if (!result) {
        result = await def.evaluate(ctx, inputs, params)
        if (def.cache === 'static') this.staticCache.set(cacheKey, result)
      }
      outputs.set(id, result)
    }

    return outputs
  }

  private nodeCache(id: NodeId): Map<string, unknown> {
    let cache = this.nodeCaches.get(id)
    if (!cache) {
      cache = new Map()
      this.nodeCaches.set(id, cache)
    }
    return cache
  }

  /** Kalles når params/graf endres, eller ved Reset. */
  invalidate(nodeId?: NodeId): void {
    if (nodeId) {
      this.nodeCaches.delete(nodeId)
      for (const key of [...this.staticCache.keys()]) {
        if (key.startsWith(`${nodeId}:`)) this.staticCache.delete(key)
      }
      return
    }
    this.nodeCaches.clear()
    this.staticCache.clear()
  }

  dispose(): void {
    this.nodeCaches.clear()
    this.staticCache.clear()
  }
}
