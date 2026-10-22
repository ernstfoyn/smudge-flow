/**
 * Kjernekontrakter for dataflyt-motoren.
 *
 * Motoren (src/engine) er ren TypeScript uten React og uten DOM-tilgang.
 * Den snakker med omverdenen gjennom RenderServices, som er en *kontrakts*
 * (denne filen) og en *implementasjon* (src/render/RenderServices.ts).
 *
 * Tidskontrakt: evaluate() må være en ren funksjon av
 *   (inputs, params, ctx.frame, settings).
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
 *  object3d  = 3D-objekt (geometri + transform + material)
 *  geometry  = normalisert mesh (vertices/triangles/normals)
 *  material  = materialbeskrivelse (shader + uniforms)
 *  scene     = 3D-beskrivelse (fase 7)
 */
export type ValueType =
  | 'drawable'
  | 'canvas'
  | 'frame'
  | 'object3d'
  | 'geometry'
  | 'material'
  | 'scene'
  | 'number'
  | 'string'
  | 'boolean'
  | 'color'

export interface PortDef {
  id: string
  label: string
  type: ValueType
  optional?: boolean
  /**
   * Porten kan ha flere innkoblinger.
   * Da får noden et ARRAY med verdiene, i kantrekkefølge.
   * (Eks: composite.stack — lagstabel med uendelig mange lag.)
   */
  multiple?: boolean
}

export type ParamType =
  | 'number'
  | 'int'
  | 'boolean'
  | 'color'
  | 'enum'
  | 'text'
  /** En liste med egne widgets (f.eks. malte stempler). */
  | 'stamps'
  /** En fil — leses inn som data-URL. */
  | 'file'

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
  /** Kan styres fra en annen node (parameter-kobling). */
  drivable?: boolean
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

/** Eksponert inngang i en gruppe-node. */
export interface GroupInput {
  id: string
  name: string
  type: ValueType
  /** Intern node + port som mottar verdien. */
  targetNode: NodeId
  targetPort: string
  /** Flere eksterne kanter kan ramme samme interne port. */
  multiple?: boolean
}

/** Eksponert utgang i en gruppe-node. */
export interface GroupOutput {
  id: string
  name: string
  type: ValueType
  /** Intern node + port som leverer verdien. */
  sourceNode: NodeId
  sourcePort: string
}

/**
 * En gruppe-node inneholder sin egen graf.
 * Dette er det som gjør gjenbrukbare workflows mulige:
 * bygg behandlingskjeden én gang, eksponer innganger, og bytt bare innholdet.
 */
export interface Subgraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  inputs: GroupInput[]
  outputs: GroupOutput[]
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
  /** Innholdet i en gruppe-node (type: 'group'). */
  group?: Subgraph
  /** Nodekortet vises sammenklappet. */
  collapsed?: boolean
}

export interface GraphEdge {
  id: string
  source: NodeId
  sourcePort: string
  target: NodeId
  targetPort: string
  /**
   * 'value' = vanlig dataflyt.
   * 'param'  = verdien fra kilden driver en parameter i målnoden
   *            (targetParam peker på parameterens nøkkel).
   */
  kind?: 'value' | 'param'
  targetParam?: string
}

export interface GraphSettings {
  width: number
  height: number
  fps: number
  frames: number
  loop: boolean
  background: string
  /** Skalering av forhåndsvisningen (1 = full oppløsning). */
  previewScale?: number
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
  /** Øker hver gang innholdet skrives. Brukes til memoisering. */
  version: number
}

export interface PostOptions {
  /** GLOW-koden for effekten, eller en komplett fragment-shader når `custom`. */
  glsl: string
  /** Sant hvis glsl er en komplett shader med egen main(). */
  custom?: boolean
  /** Styrke 0..2. */
  amount: number
  /** Skala/frekvens 0..1. */
  scale: number
  /** Animert tid, i sekunder. */
  time: number
  /** Ekstra tall-uniformer. Et tallpar blir en vec2. */
  uniforms?: Record<string, number | [number, number]>
  /** Ekstra farge-uniformer. */
  colors?: Record<string, string>
}

export interface RenderServices {
  readonly width: number
  readonly height: number
  /** Basseng av canvas, nøklet på nodeId. Samme node gjenbruker lerretet mellom frames. */
  canvas(key: string): CanvasTarget
  /** Markerer at lerreret for nøkkelen har nytt innhold. */
  touch(key: string): void
  /** Versjonen av en verdi (0 for verdier som ikke er lerret). */
  versionOf(value: unknown): number
  /**
   * Fullskjerm-postprosessering av et raster-lerret.
   * Alle effektnoder deler én GPU-kontekst gjennom denne.
   */
  post(input: CanvasImageSource, options: PostOptions): Promise<HTMLCanvasElement>
  assets: {
    image(src: string): Promise<HTMLImageElement>
    /** Deterministisk: seeker og venter på 'seeked' per frame. */
    videoFrame(src: string, time: number): Promise<HTMLVideoElement>
  }
  dispose(): void
}

export interface EvalContext {
  nodeId: NodeId
  /**
   * Unik nøkkel for noden *innenfor sin scope*.
   * Brukes til lerret- og cache-nøkler, slik at en node inne i en gruppe
   * ikke kolliderer med en node utenfor gruppen.
   */
  scopeKey: string
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

/**
 * Løser node-definisjoner. Motoren bruker denne i stedet for å være
 * bundet til applikasjonens register, slik at motoren kan testes isolert
 * og senere flyttes til en egen pakke.
 */
export interface NodeResolver {
  get(type: string): {
    inputs: readonly PortDef[]
    outputs: readonly PortDef[]
    params: readonly ParamDef[]
  }
}

export type InputValues = Record<string, unknown>
export type Outputs = Record<string, unknown>

export interface NodeDefinition<P = Record<string, unknown>> {
  type: string
  label: string
  category: 'source' | 'modifier' | 'composite' | 'output'
  /** Kort forklaring som vises i paletten og i noden. */
  description?: string
  inputs: readonly PortDef[]
  outputs: readonly PortDef[]
  params: readonly ParamDef[]
  evaluate(ctx: EvalContext, inputs: InputValues, params: P): Outputs | Promise<Outputs>
  /**
   * 'static' caches på tvers av frames. KUN for immutable output
   * (lastet bilde, parset geometri). Standard er 'frame'.
   */
  cache?: 'frame' | 'static'
  /**
   * Er noden avhengig av tiden? Hvis nei, kan motoren hoppe over
   * evalueringen når innganger og parametere er uendret.
   *
   * `true` (standard) = alltid evalueres.
   * `false`           = kan memoiseres mellom frames.
   * Funksjon          = avgjøres ut fra de oppløste parameterne.
   */
  timeDependent?: boolean | ((params: Record<string, unknown>) => boolean)
}
