/**
 * Kjernekontrakter for dataflyt-motoren.
 *
 * Motoren (src/engine) er ren TypeScript uten React og uten DOM-tilgang.
 * Den snakker med omverdenen gjennom RenderServices, som er en *kontrakts*
 * (denne filen) og en *implementasjon* (src/render/RenderServices.ts).
 *
 * Tidskontrakt: evaluate() må være en ren funksjon av
 *   (inputs, params, ctx.frame, graph.settings).
 * Ingen Date.now(), performance.now(), Math.random() eller requestAnimationFrame
 * inne i en node. All tid kommer fra ctx.frame / ctx.phase.
 */

export type NodeId = string

/**
 * Verdityper som flyter mellom porter. Holdes bevisst få, slik at
 * port-kobling kan valideres statisk.
 *
 *  drawable  = HTMLImageElement | HTMLCanvasElement | ImageBitmap | HTMLVideoElement
 *  canvas    = HTMLCanvasElement (raster-resultat)
 *  frame     = ferdig ramme (RGBA) klart for kompositt/eksport
 *  scene     = 3D-beskrivelse (fase 7)
 *  geometry  = normalisert mesh (vertices/triangles/normals)
 *  material  = materialbeskrivelse (shader + uniforms)
 */
export type ValueType =
  | 'drawable'
  | 'canvas'
  | 'frame'
  | 'scene'
  | 'geometry'
  | 'material'
  | 'number'
  | 'string'
  | 'boolean'
  | 'color'

export interface PortDef {
  id: string
  label: string
  type: ValueType
  optional?: boolean
}

export type ParamType = 'number' | 'int' | 'boolean' | 'color' | 'enum' | 'text'

export interface ParamDef {
  /** Støtter punktsti, f.eks. "transform.position.x". */
  key: string
  label: string
  type: ParamType
  default: unknown
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string | number; label: string }>
  /** Kan animeres med keyframes eller LFO. */
  animatable?: boolean
  group?: string
}

export interface Keyframe {
  frame: number
  value: unknown
  /**
   * Interpolasjonen tilhører den UTGÅENDE keyframen, slik som i Orbit.
   * Gir rom for bezier/hold senere uten at rendereren endres.
   */
  interpolation?: 'linear' | 'hold'
}

export interface LfoConfig {
  on: boolean
  /** 0..1 — andel av parameterens range. */
  amount: number
  /** Sykluser per loop (ikke per sekund) slik at loopen lukker seg eksakt. */
  cycles: number
  shape: 'sine' | 'triangle' | 'saw' | 'square' | 'random'
  phase: number
}

export interface GraphNode {
  id: NodeId
  type: string
  title: string
  params: Record<string, unknown>
  /** Sti (i params) → keyframes. */
  tracks?: Record<string, Keyframe[]>
  /** Sti (i params) → LFO-konfig. */
  lfo?: Record<string, LfoConfig>
  position: { x: number; y: number }
  enabled?: boolean
}

export interface GraphEdge {
  id: string
  source: NodeId
  sourcePort: string
  target: NodeId
  targetPort: string
}

export interface GraphSettings {
  width: number
  height: number
  fps: number
  frames: number
  loop: boolean
  background: string
}

export interface Graph {
  version: 1
  nodes: GraphNode[]
  edges: GraphEdge[]
  settings: GraphSettings
}

export interface CanvasTarget {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  width: number
  height: number
}

export interface RenderServices {
  readonly width: number
  readonly height: number
  /** Basseng av canvas, nøklet på nodeId. Samme node gjenbruker lerretet mellom frames. */
  canvas(key: string): CanvasTarget
  assets: {
    image(src: string): Promise<HTMLImageElement>
    /** Deterministisk: seeker og venter på 'seeked' per frame. */
    videoFrame(src: string, time: number): Promise<HTMLVideoElement>
  }
  dispose(): void
}

export interface EvalContext {
  nodeId: NodeId
  /** Heltall 0..totalFrames-1. */
  frame: number
  fps: number
  totalFrames: number
  /** frame / fps — sekunder inn i loopen. */
  time: number
  /** frame / totalFrames — 0..1. Løkker trygt. */
  phase: number
  width: number
  height: number
  render: RenderServices
  /** Ressurser som lever over frames for denne noden. */
  nodeCache: Map<string, unknown>
  signal?: AbortSignal
}

export type InputValues = Record<string, unknown>
export type Outputs = Record<string, unknown>

export interface NodeDefinition<P = Record<string, unknown>> {
  type: string
  label: string
  category: 'source' | 'modifier' | 'composite' | 'output'
  inputs: readonly PortDef[]
  outputs: readonly PortDef[]
  params: readonly ParamDef[]
  evaluate(ctx: EvalContext, inputs: InputValues, params: P): Outputs | Promise<Outputs>
  /**
   * 'static' caches på tvers av frames. KUN for immutable output
   * (lastet bilde, parset geometri). Standard er 'frame'.
   */
  cache?: 'frame' | 'static'
}
