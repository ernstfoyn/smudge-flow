import type { NodeDefinition } from '../../engine/types'
import type { SmudgeRenderer, SmudgeShape } from '../../render/three/smudgeRenderer'

export interface SmudgeParams {
  shape: SmudgeShape
  segments: number
  cameraDistance: number
  scale: number
  posX: number
  posY: number
  posZ: number
  rotX: number
  rotY: number
  rotZ: number
  twist: number
  pull: number
  noiseScale: number
  octaves: number
  noiseType: number
  repeat: number
  mirror: boolean
  kaleido: number
  trailCount: number
  trailSpread: number
  trailSwirl: number
  trailFade: number
  hue: number
  saturation: number
  gloss: number
  rimColor: string
  speed: number
}

/**
 * Smudge-materialet — den flytende «liquid glass»-effekten.
 *
 * Port av Stage.jsx + vertex/fragment.glsl.js i Smudge_animator @ 81cf506.
 * Vertex-shaderen forskyver geometrien etter et støyfelt (twist/pull),
 * fragment-shaderen bygger trailen av ekko-kopier, og legger på hue,
 * fresnel-rand og glans.
 *
 * De 16 stilistiske effektene ligger i egne noder (lookNodes.ts), så
 * rekkefølgen deres bestemmes av kantene i grafen.
 */
export const smudgeDeform: NodeDefinition<SmudgeParams> = {
  type: 'modifier.smudgeDeform',
  label: 'Smudge-materiale',
  category: 'modifier',
  description:
    'Flytende glass-effekt: forskyver bildet i 3D, bygger en trail av ekko-kopier, og legger på glans.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    {
      key: 'shape', label: 'Form', type: 'enum', default: 'plane',
      options: [
        { value: 'plane', label: 'Plan' },
        { value: 'sphere', label: 'Kule' },
        { value: 'cylinder', label: 'Sylinder' },
      ],
    },
    { key: 'segments', label: 'Subdividering', type: 'int', default: 180, min: 8, max: 400 },
    { key: 'cameraDistance', label: 'Kameraavstand', type: 'number', default: 3.6, min: 1, max: 12, step: 0.1, animatable: true },
    { key: 'scale', label: 'Skala', type: 'number', default: 1, min: 0.2, max: 3, step: 0.01, animatable: true },
    { key: 'posX', label: 'Posisjon X', type: 'number', default: 0, min: -1.5, max: 1.5, animatable: true },
    { key: 'posY', label: 'Posisjon Y', type: 'number', default: 0, min: -1.5, max: 1.5, animatable: true },
    { key: 'posZ', label: 'Posisjon Z', type: 'number', default: 0, min: -3, max: 3, animatable: true },
    { key: 'rotX', label: 'Rotasjon X', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotY', label: 'Rotasjon Y', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'rotZ', label: 'Rotasjon Z', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'twist', label: 'Twist', type: 'number', default: 3, min: 0, max: 10, step: 0.1, animatable: true },
    { key: 'pull', label: 'Pull', type: 'number', default: 2.5, min: 0, max: 10, step: 0.1, animatable: true },
    { key: 'noiseScale', label: 'Støyskala', type: 'number', default: 1.6, min: 0.1, max: 8, step: 0.05, animatable: true },
    { key: 'octaves', label: 'Octaver', type: 'int', default: 4, min: 1, max: 8, animatable: true },
    {
      key: 'noiseType', label: 'Støytype', type: 'enum', default: 'simplex',
      options: [
        { value: 'simplex', label: 'Simplex' },
        { value: 'perlin', label: 'Perlin' },
        { value: 'voronoi', label: 'Voronoi' },
        { value: 'curl', label: 'Curl' },
        { value: 'ridged', label: 'Ridged' },
        { value: 'turbulence', label: 'Turbulens' },
      ],
    },
    { key: 'speed', label: 'Hastighet', type: 'number', default: 1, min: 0, max: 5, step: 0.05, animatable: true },
    { key: 'repeat', label: 'Repetisjon', type: 'int', default: 1, min: 1, max: 16, animatable: true },
    { key: 'mirror', label: 'Speil', type: 'boolean', default: false },
    { key: 'kaleido', label: 'Kaleidoskop', type: 'int', default: 0, min: 0, max: 16, animatable: true },
    { key: 'trailCount', label: 'Trail', type: 'int', default: 0, min: 0, max: 8, animatable: true },
    { key: 'trailSpread', label: 'Trail-spredning', type: 'number', default: 0.55, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'trailSwirl', label: 'Trail-rotasjon', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'trailFade', label: 'Trail-fade', type: 'number', default: 0.85, min: 0.1, max: 1, step: 0.01, animatable: true },
    { key: 'hue', label: 'Fase', type: 'number', default: 0, min: -0.5, max: 0.5, step: 0.01, animatable: true },
    { key: 'saturation', label: 'Metning', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'gloss', label: 'Glans', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'rimColor', label: 'Randfarge', type: 'color', default: '#8be9fd' },
  ],
  async evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as CanvasImageSource | undefined

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    // Lazy: three.js hentes først når noden faktisk evalueres.
    const { SmudgeRenderer } = await import('../../render/three/smudgeRenderer')

    let renderer = ctx.nodeCache.get('renderer') as SmudgeRenderer | undefined
    if (!renderer) {
      renderer = new SmudgeRenderer(ctx.width, ctx.height)
      ctx.nodeCache.set('renderer', renderer)
    }
    renderer.resize(ctx.width, ctx.height)
    renderer.setShape(p.shape as SmudgeShape, Number(p.segments))

    // Støytypene i den gamle appen var indeks 0..5.
    const noiseTypes = ['simplex', 'perlin', 'voronoi', 'curl', 'ridged', 'turbulence']
    const noiseType = Math.max(0, noiseTypes.indexOf(String(p.noiseType)))

    renderer.setInput(source)
    renderer.setUniforms({
      uTime: ctx.phase * (ctx.totalFrames / ctx.fps) * Number(p.speed),
      uTwist: Number(p.twist),
      uPull: Number(p.pull),
      uNoiseScale: Number(p.noiseScale),
      uOctaves: Number(p.octaves),
      uNoiseType: noiseType,
      uRepeat: Number(p.repeat),
      uMirror: p.mirror ? 1 : 0,
      uKaleido: Number(p.kaleido),
      uTrailCount: Number(p.trailCount),
      uTrailSpread: Number(p.trailSpread),
      uTrailSwirl: Number(p.trailSwirl),
      uTrailFade: Number(p.trailFade),
      uHue: Number(p.hue),
      uSaturation: Number(p.saturation),
      uGloss: Number(p.gloss),
      uRimColor: String(p.rimColor),
    })
    renderer.setTransform({
      position: { x: Number(p.posX), y: Number(p.posY), z: Number(p.posZ) },
      rotation: { x: Number(p.rotX), y: Number(p.rotY), z: Number(p.rotZ) },
      scale: Number(p.scale),
    })

    const gl = renderer.render(Number(p.cameraDistance))

    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)
    c.drawImage(gl, 0, 0, target.width, target.height)
    c.restore()

    return { out: target.canvas }
  },
}
