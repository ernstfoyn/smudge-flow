import type {
  EvalContext,
  Graph,
  GraphEdge,
  GraphNode,
  GraphSettings,
  InputValues,
  NodeId,
  Outputs,
  ParamDef,
} from './types'
import { topoSortScope } from './topoSort'
import { GraphError } from './errors'
import { resolveParamsAt } from './params'
import type { NodeRegistry } from './registry'
import type { RenderServices } from './types'

export interface EvaluateOptions {
  signal?: AbortSignal
}

interface Scope {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * Evaluerer grafen for én frame.
 *
 * Motoren er *rekursiv*: en gruppe-node egen graf, som evalueres med
 * egne inngangsverdier. Det er det som gjør gjenbrukbare workflows mulige.
 *
 * 1. Topologisk sortering av delgrafen som mater målene.
 * 2. For hver node: resolve params (keyframes → LFO → clamp → paramet kobling),
 *    hent input fra allerede evaluerte noder, kjør evaluate().
 * 3. Memo: noder som ikke er tidsavhengige, gjenbrukes når innganger og
 *    parametere er uendret. Det holder store grafer responsive.
 */
export class Evaluator {
  /** Ressurser som lever over frames, per node (textures, masker). */
  private nodeCaches = new Map<string, Map<string, unknown>>()
  /** Memo for tidsuavhengige noder. */
  private memo = new Map<string, { sig: string; output: Outputs }>()
  /** Resultater for noder med cache: 'static'. */
  private staticCache = new Map<string, Outputs>()
  /** Versjon per node — brukes i memo-signaturen. */
  private versions = new Map<string, number>()

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
    const settings = graph.settings
    const phase = frame / Math.max(1, settings.frames)
    return this.evaluateScope(
      { nodes: graph.nodes, edges: graph.edges },
      frame,
      phase,
      targets,
      settings,
      new Map(),
      options.signal,
      '',
    )
  }

  private async evaluateScope(
    scope: Scope,
    frame: number,
    phase: number,
    targets: NodeId[],
    settings: GraphSettings,
    injected: Map<string, unknown>,
    signal: AbortSignal | undefined,
    path: string,
  ): Promise<Map<NodeId, Outputs>> {
    const { order, errors } = topoSortScope(scope.nodes, scope.edges, targets)
    if (errors.length) throw new GraphError(errors.join('\n'))

    const byId = new Map(scope.nodes.map((n) => [n.id, n]))
    const incoming = new Map<string, GraphEdge[]>()
    const paramEdges = new Map<NodeId, GraphEdge[]>()

    for (const e of scope.edges) {
      if (e.kind === 'param') {
        const list = paramEdges.get(e.target)
        if (list) list.push(e)
        else paramEdges.set(e.target, [e])
        continue
      }
      const key = `${e.target}\u0000${e.targetPort}`
      const list = incoming.get(key)
      if (list) list.push(e)
      else incoming.set(key, [e])
    }

    const outputs = new Map<NodeId, Outputs>()

    for (const id of order) {
      if (signal?.aborted) throw new DOMException('Avbrutt', 'AbortError')

      const node = byId.get(id)!

      // --- Gruppe-node: egen graf, egen evaluering -------------------------
      if (node.type === 'group' && node.group) {
        const group = node.group
        const innerInjected = new Map<string, unknown>()

        for (const groupInput of group.inputs) {
          const edges = incoming.get(`${id}\u0000${groupInput.id}`) ?? []
          if (!edges.length) continue
          const values = edges
            .map((edge) => outputs.get(edge.source)?.[edge.sourcePort])
            .filter((value) => value !== undefined)

          const value = groupInput.multiple
            ? values
            : values[values.length - 1]
          if (value !== undefined) {
            innerInjected.set(`${groupInput.targetNode}\u0000${groupInput.targetPort}`, value)
          }
        }

        const innerTargets = [...new Set(group.outputs.map((o) => o.sourceNode))]
        const innerOutputs = await this.evaluateScope(
          { nodes: group.nodes, edges: group.edges },
          frame,
          phase,
          innerTargets,
          settings,
          innerInjected,
          signal,
          `${path}/${id}`,
        )

        const groupOutputs: Outputs = {}
        for (const groupOutput of group.outputs) {
          groupOutputs[groupOutput.id] = innerOutputs.get(groupOutput.sourceNode)?.[
            groupOutput.sourcePort
          ]
        }
        outputs.set(id, groupOutputs)
        continue
      }

      // --- Vanlig node -----------------------------------------------------
      const def = this.registry.get(node.type)
      const params = resolveParamsAt(node, frame, phase, def)

      // Parameter-koblinger: verdien fra kilden overstyrer parameteren.
      for (const edge of paramEdges.get(id) ?? []) {
        const value = outputs.get(edge.source)?.[edge.sourcePort]
        if (typeof value === 'number' && edge.targetParam) {
          params[edge.targetParam] = clampToParam(value, def.params.find((p) => p.key === edge.targetParam))
        }
      }

      const inputs: InputValues = {}
      for (const port of def.inputs) {
        const injectionKey = `${id}\u0000${port.id}`
        if (injected.has(injectionKey)) {
          inputs[port.id] = injected.get(injectionKey)
          continue
        }

        const edges = incoming.get(injectionKey) ?? []

        if (port.multiple) {
          const values = edges
            .map((edge) => outputs.get(edge.source)?.[edge.sourcePort])
            .filter((value) => value !== undefined)
          inputs[port.id] = values
          if (!values.length && !port.optional) {
            throw new GraphError(
              `«${node.title}» mangler input «${port.label}» — koble minst én kilde til porten.`,
            )
          }
          continue
        }

        const edge = edges[edges.length - 1]
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
        scopeKey: `${path}/${id}`,
        frame,
        fps: settings.fps,
        totalFrames: settings.frames,
        time: frame / settings.fps,
        phase,
        width: settings.width,
        height: settings.height,
        render: this.render,
        nodeCache: this.nodeCache(`${path}/${id}`),
        signal,
      }

      const timeDependent =
        typeof def.timeDependent === 'function'
          ? def.timeDependent(params)
          : (def.timeDependent ?? true)

      const memoKey = ctx.scopeKey

      // Uforanderlig output (lastet bilde, parset geometri): mellomlagres
      // på tvers av frames.
      if (def.cache === 'static') {
        const cached = this.staticCache.get(memoKey)
        if (cached) {
          outputs.set(id, cached)
          continue
        }
        const result = await def.evaluate(ctx, inputs, params)
        this.render.touch(memoKey)
        this.bumpVersion(memoKey)
        this.staticCache.set(memoKey, result)
        outputs.set(id, result)
        continue
      }

      if (!timeDependent) {
        const cached = this.memo.get(memoKey)
        const sig = this.signature(params, incoming, id, injected)
        if (cached && cached.sig === sig) {
          outputs.set(id, cached.output)
          continue
        }

        const result = await def.evaluate(ctx, inputs, params)
        this.render.touch(memoKey)
        this.bumpVersion(memoKey)
        this.memo.set(memoKey, { sig, output: result })
        outputs.set(id, result)
        continue
      }

      const result = await def.evaluate(ctx, inputs, params)
      this.render.touch(memoKey)
      this.bumpVersion(memoKey)
      outputs.set(id, result)
    }

    return outputs
  }

  /**
   * Signatur for memo: parametere + kildenes versjoner.
   *
   * Vi bruker node-versjoner (ikke objektidentitet), slik at signaturen også
   * fungerer for verdier som ikke er lerret — 3D-objekter, geometri, tall.
   */
  private signature(
    params: Record<string, unknown>,
    incoming: Map<string, GraphEdge[]>,
    nodeId: NodeId,
    injected: Map<string, unknown>,
  ): string {
    const parts: string[] = [JSON.stringify(params)]
    for (const [key, edges] of incoming) {
      const tokens = edges.map((e) => `${e.source}@${this.nodeVersion(e.source)}`).join(',')
      parts.push(`${key}=${tokens}`)
    }
    for (const [key, value] of injected) {
      parts.push(`inj:${key}=${this.valueToken(value)}`)
    }
    parts.push(`self=${nodeId}`)
    return parts.join('|')
  }

  private nodeVersion(key: string): number {
    return this.versions.get(key) ?? 0
  }

  private bumpVersion(key: string): void {
    this.versions.set(key, this.nodeVersion(key) + 1)
  }

  private valueToken(value: unknown): string {
    if (value === undefined) return 'u'
    if (Array.isArray(value)) return `[${value.map((v) => this.valueToken(v)).join(',')}]`
    if (value && typeof value === 'object') return `o${this.render.versionOf(value)}`
    return JSON.stringify(value)
  }

  private nodeCache(key: string): Map<string, unknown> {
    let cache = this.nodeCaches.get(key)
    if (!cache) {
      cache = new Map()
      this.nodeCaches.set(key, cache)
    }
    return cache
  }

  /** Kalles når params/graf endres, eller ved Reset. */
  invalidate(nodeId?: NodeId): void {
    if (nodeId) {
      this.nodeCaches.delete(nodeId)
      for (const key of [...this.memo.keys()]) {
        if (key.endsWith(`/${nodeId}`) || key === nodeId) this.memo.delete(key)
      }
      for (const key of [...this.staticCache.keys()]) {
        if (key.endsWith(`/${nodeId}`) || key === nodeId) this.staticCache.delete(key)
      }
      return
    }
    this.nodeCaches.clear()
    this.memo.clear()
    this.staticCache.clear()
  }

  dispose(): void {
    this.nodeCaches.clear()
    this.memo.clear()
    this.staticCache.clear()
  }
}

function clampToParam(value: number, def?: ParamDef): number {
  let v = value
  if (!Number.isFinite(v)) v = 0
  if (def?.type === 'int') v = Math.round(v)
  if (def?.min !== undefined) v = Math.max(def.min, v)
  if (def?.max !== undefined) v = Math.min(def.max, v)
  return v
}
