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
  NodeDefinition,
  ValueType,
} from './types'
import { topoSortScope } from './topoSort'
import { GraphError } from './errors'
import { resolveParamsAt } from './params'
import { driveSettings, drivenKeys, modulate } from './drive'
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
    const driveEdges = new Map<NodeId, GraphEdge[]>()

    for (const e of scope.edges) {
      if (e.kind === 'drive') {
        const list = driveEdges.get(e.target)
        if (list) list.push(e)
        else driveEdges.set(e.target, [e])
        continue
      }
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
      const disabled = node.enabled === false

      // --- Gruppe-node: egen graf, egen evaluering -------------------------
      if (node.type === 'group' && node.group) {
        if (disabled) {
          // En deaktivert gruppe sluses forbi: den første kompatible inngangen
          // sendes videre til hver eksponert utgang, uten å evaluere innholdet.
          const bypassed: Outputs = {}
          for (const out of node.group.outputs) {
            const candidate = node.group.inputs.find((input) => canPass(input.type, out.type))
            if (!candidate) continue
            const edges = incoming.get(`${id}\u0000${candidate.id}`) ?? []
            const values = edges
              .map((edge) => outputs.get(edge.source)?.[edge.sourcePort])
              .filter((value) => value !== undefined)
            const value = values[values.length - 1]
            if (value !== undefined) bypassed[out.id] = value
          }
          outputs.set(id, bypassed)
          continue
        }

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

      // Signaler: modulerer parametere rundt grunnverdien. Flere signaler
      // legges sammen, og resultatet begrenses til parameterens område.
      const deltas = new Map<string, number>()
      for (const edge of driveEdges.get(id) ?? []) {
        const signal = outputs.get(edge.source)?.[edge.sourcePort]
        if (typeof signal !== 'number' || !Number.isFinite(signal)) continue
        const { amount } = driveSettings(edge)
        for (const key of drivenKeys(edge, def.params)) {
          deltas.set(key, (deltas.get(key) ?? 0) + signal * amount)
        }
      }
      for (const [key, delta] of deltas) {
        const param = def.params.find((p) => p.key === key)
        const base = Number(params[key])
        if (Number.isFinite(base)) params[key] = modulate(base, delta, param)
      }

      // Parameter-koblinger: verdien fra kilden overstyrer parameteren.
      for (const edge of paramEdges.get(id) ?? []) {
        const value = outputs.get(edge.source)?.[edge.sourcePort]
        if (typeof value === 'number' && edge.targetParam) {
          params[edge.targetParam] = clampToParam(value, def.params.find((p) => p.key === edge.targetParam))
        }
      }

      const inputs: InputValues = {}
      /** Kantene bak hver inputverdi — brukes til per-lag-innstillinger. */
      const inputEdges: Record<string, GraphEdge[]> = {}
      for (const port of def.inputs) {
        const injectionKey = `${id}\u0000${port.id}`
        if (injected.has(injectionKey)) {
          inputs[port.id] = injected.get(injectionKey)
          continue
        }

        const edges = incoming.get(injectionKey) ?? []

        if (port.multiple) {
          const values: unknown[] = []
          const used: GraphEdge[] = []
          for (const edge of edges) {
            const value = outputs.get(edge.source)?.[edge.sourcePort]
            // Verdier som mangler hoppes over, akkurat som før. Kanten
            // hoppes over samtidig, slik at verdi og kant følger hverandre.
            if (value === undefined) continue
            values.push(value)
            used.push(edge)
          }
          inputs[port.id] = values
          inputEdges[port.id] = used
          if (!values.length && !port.optional && !disabled) {
            throw new GraphError(
              `«${node.title}» mangler input «${port.label}» — koble minst én kilde til porten.`,
            )
          }
          continue
        }

        const edge = edges[edges.length - 1]
        const value = edge ? outputs.get(edge.source)?.[edge.sourcePort] : undefined
        if (edge && value !== undefined) inputEdges[port.id] = [edge]
        if (value === undefined && !port.optional && !disabled) {
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
        inputEdges,
        signal,
      }

      const memoKey = ctx.scopeKey

      // Deaktivert node: send verdien forbi i stedet for å evaluere den.
      if (disabled) {
        const bypassed = bypassOutputs(def, inputs, ctx)
        this.render.touch(memoKey)
        this.bumpVersion(memoKey)
        outputs.set(id, bypassed)
        continue
      }

      const timeDependent =
        typeof def.timeDependent === 'function'
          ? def.timeDependent(params)
          : (def.timeDependent ?? true)

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
        const sig = this.signature(params, incoming, id, injected, path)
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
   *
   * Kildene må slås opp med *scope-prefiks*: versjonene lagres under
   * `ctx.scopeKey` (`<sti>/<id>`), ikke under den rå node-ID-en. Uten
   * prefikset ville signaturen aldri sett at en inngang endret seg, og
   * tidsuavhengige noder ville blitt stående med gammel output.
   */
  private signature(
    params: Record<string, unknown>,
    incoming: Map<string, GraphEdge[]>,
    nodeId: NodeId,
    injected: Map<string, unknown>,
    path: string,
  ): string {
    const parts: string[] = [JSON.stringify(params)]
    for (const [key, edges] of incoming) {
      const tokens = edges
        .map((e) => `${e.source}@${this.nodeVersion(`${path}/${e.source}`)}`)
        .join(',')
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

/**
 * Kan en verdi av `source` sendes videre til en utgang av `target`?
 * Samme regler som port-kompatibiliteten i grafen.
 */
function canPass(source: ValueType, target: ValueType): boolean {
  if (source === target) return true
  if (target === 'drawable') return source === 'canvas' || source === 'drawable'
  if (source === 'drawable' && target === 'canvas') return true
  return false
}

/**
 * «Forbi»-utganger for en deaktivert node.
 *
 * Den første kompatible inngangen sendes videre. Ved flere innganger foretrekkes
 * «in», så «base», ellers den første — det gir forutsigbar oppførsel for både
 * effektnoder og blanding. En flerinngang (som lagstabelen) sender det øverste
 * laget videre.
 *
 * Bilder uten noen kompatibel inngang blir et gjennomsiktig lerret, så en
 * deaktivert kilde forsvinner i stedet for å stoppe hele grafen. Tall, 3D og
 * andre verdier blir borte, slik at en deaktivert kilde ikke styrer noe.
 */
function bypassOutputs(
  def: NodeDefinition,
  inputs: InputValues,
  ctx: EvalContext,
): Outputs {
  const result: Outputs = {}

  for (const out of def.outputs) {
    const candidates = def.inputs.filter((port) => canPass(port.type, out.type))
    const port =
      candidates.find((p) => p.id === 'in') ??
      candidates.find((p) => p.id === 'base') ??
      candidates[0]
    if (!port) continue

    const raw = inputs[port.id]
    const value = port.multiple && Array.isArray(raw) ? raw[raw.length - 1] : raw
    if (value !== undefined) {
      result[out.id] = value
      continue
    }

    if (out.type === 'canvas' || out.type === 'drawable') {
      const target = ctx.render.canvas(`${ctx.scopeKey}:bypass`)
      target.ctx.clearRect(0, 0, target.width, target.height)
      result[out.id] = target.canvas
    }
  }

  return result
}

function clampToParam(value: number, def?: ParamDef): number {
  let v = value
  if (!Number.isFinite(v)) v = 0
  if (def?.type === 'int') v = Math.round(v)
  if (def?.min !== undefined) v = Math.max(def.min, v)
  if (def?.max !== undefined) v = Math.min(def.max, v)
  return v
}
