import type { NodeDefinition } from '../../engine/types'

export type BlobShape =
  | 'sphere'
  | 'box'
  | 'tetra'
  | 'octa'
  | 'torus'
  | 'capsule'
  | 'hexagon'
  | 'heart'
  | 'crescent'

export type BlobMaterial = 'matte' | 'chrome' | 'glass' | 'goo' | 'obsidian' | 'hologram'

export interface BlobParams {
  shape: BlobShape
  material: BlobMaterial
  count: number
  size: number
  blend: number
  morph: number
  spin: number
  wobble: number
  round: number
  tint: number
  scale: number
  hue: number
  saturation: number
  gloss: number
  speed: number
  background: string
  backgroundMode: 'solid' | 'gradient'
  backgroundA: string
  backgroundB: string
}

const SHAPES: BlobShape[] = [
  'sphere', 'box', 'tetra', 'octa', 'torus', 'capsule', 'hexagon', 'heart', 'crescent',
]
const MATERIALS: BlobMaterial[] = ['matte', 'chrome', 'glass', 'goo', 'obsidian', 'hologram']

/**
 * Blob-mode — SDF-raymarcheren.
 *
 * Port av src/shaders/blob.glsl.js + BlobView.jsx i Smudge_animator @ 81cf506.
 * Ingenting tegnes unntatt piksler: et fullskjerm-kvad marsjerer stråler
 * gjennom et avstandsfelt bygget av smeltede primitiver (metaballer), med
 * bildet pakket på via triplanar mapping.
 */
export const blob3D: NodeDefinition<BlobParams> = {
  type: 'source.blob3D',
  label: 'Blob',
  category: 'source',
  description:
    'Raymarchet metaball-form med bildet pakket på. Kan kobles til trail-laget for å males inn i formen.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    {
      key: 'shape', label: 'Form', type: 'enum', default: 'sphere',
      options: [
        { value: 'sphere', label: 'Kule' },
        { value: 'box', label: 'Boks' },
        { value: 'tetra', label: 'Tetraeder' },
        { value: 'octa', label: 'Oktaeder' },
        { value: 'torus', label: 'Torus' },
        { value: 'capsule', label: 'Kapsel' },
        { value: 'hexagon', label: 'Heksagon' },
        { value: 'heart', label: 'Hjerte' },
        { value: 'crescent', label: 'Måneskarv' },
      ],
    },
    {
      key: 'material', label: 'Materiale', type: 'enum', default: 'glass',
      options: [
        { value: 'matte', label: 'Matt' },
        { value: 'chrome', label: 'Krom' },
        { value: 'glass', label: 'Glass' },
        { value: 'goo', label: 'Goo' },
        { value: 'obsidian', label: 'Obsidian' },
        { value: 'hologram', label: 'Hologram' },
      ],
    },
    { key: 'count', label: 'Antall former', type: 'int', default: 5, min: 2, max: 8, animatable: true },
    { key: 'size', label: 'Størrelse', type: 'number', default: 0.46, min: 0.15, max: 0.8, step: 0.01, animatable: true },
    { key: 'blend', label: 'Sammensmelting', type: 'number', default: 0.55, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'morph', label: 'Formendring', type: 'number', default: 0.45, min: 0, max: 1.6, step: 0.01, animatable: true },
    { key: 'spin', label: 'Rotasjon', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'wobble', label: 'Organisk variasjon', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'round', label: 'Avrunding', type: 'number', default: 0.05, min: 0, max: 0.25, step: 0.01, animatable: true },
    { key: 'tint', label: 'Egen farge', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'scale', label: 'Skala', type: 'number', default: 1, min: 0.2, max: 3, step: 0.01, animatable: true },
    { key: 'hue', label: 'Fase', type: 'number', default: 0, min: -0.5, max: 0.5, step: 0.01, animatable: true },
    { key: 'saturation', label: 'Metning', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'gloss', label: 'Glans', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'speed', label: 'Hastighet', type: 'number', default: 1, min: 0, max: 5, step: 0.01, animatable: true },
    {
      key: 'backgroundMode', label: 'Bakgrunn', type: 'enum', default: 'gradient',
      options: [
        { value: 'solid', label: 'Ensfarget' },
        { value: 'gradient', label: 'Gradient' },
      ],
    },
    { key: 'backgroundA', label: 'Bakgrunn A', type: 'color', default: '#241f3d' },
    { key: 'backgroundB', label: 'Bakgrunn B', type: 'color', default: '#05050a' },
  ],
  async evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as CanvasImageSource | undefined

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    const { blobFragmentShader } = await import('../../render/shaders/blob.glsl')

    // Tiden ping-pong-er, slik at formen lukker seg i loopen.
    const cycle = ctx.totalFrames / ctx.fps
    const flowT = (1 - Math.abs(2 * ctx.phase - 1)) * cycle * Number(p.speed)

    const result = await ctx.render.post(source, {
      glsl: blobFragmentShader,
      custom: true,
      amount: 1,
      scale: 0.5,
      time: flowT,
      uniforms: {
        uResolution: [ctx.width, ctx.height],
        uHue: Number(p.hue),
        uSaturation: Number(p.saturation),
        uGloss: Number(p.gloss),
        uBlend: Number(p.blend),
        uSpread: Number(p.morph),
        uSize: Number(p.size),
        uSpin: Number(p.spin),
        uWobble: Number(p.wobble),
        uRound: Number(p.round),
        uTint: Number(p.tint),
        uScale: Number(p.scale),
        uShape: Math.max(0, SHAPES.indexOf(String(p.shape) as BlobShape)),
        uCount: Math.round(Number(p.count)),
        uMat: Math.max(0, MATERIALS.indexOf(String(p.material) as BlobMaterial)),
        uBgMode: p.backgroundMode === 'gradient' ? 1 : 0,
      },
      colors: {
        uBgA: String(p.backgroundA),
        uBgB: String(p.backgroundB),
      },
    })

    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)
    c.drawImage(result, 0, 0, target.width, target.height)
    c.restore()

    return { out: target.canvas }
  },
}
