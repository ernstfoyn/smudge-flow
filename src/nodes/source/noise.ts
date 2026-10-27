import type { NodeDefinition } from '../../engine/types'
import type { GradientStop } from '../../engine/color/gradient'
import { blit } from '../../render/blit'
import { gradientLutFor } from '../../render/raster/gradientTexture'
import { noiseFragmentShader } from '../../render/shaders/generators'

export interface NoiseParams {
  scale: number
  octaves: number
  warp: number
  drift: number
  contrast: number
  seed: number
  colorA: string
  colorB: string
  /** Flerfarge-gradient. Tom liste faller tilbake til Farge A/B. */
  stops?: GradientStop[]
}

/**
 * Organisk støyfelt (simplex-fBm).
 *
 * Animasjonen er loop-sikker uten pingpong: feltet driver i en sirkel og
 * morfer mellom to z-snitt med sin²(π·fase), som er null i begge ender.
 * Frame 0 og frame N er derfor identiske, også ved eksport.
 */
export const noise: NodeDefinition<NoiseParams> = {
  type: 'source.noise',
  label: 'Støy',
  category: 'source',
  description:
    'Simplex-fBm med domene-warp og fargerampe. Lukker seg eksakt i loopen.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'scale', label: 'Skala', type: 'number', default: 6, min: 1, max: 40, step: 0.1, animatable: true },
    { key: 'octaves', label: 'Oktaver', type: 'int', default: 4, min: 1, max: 6 },
    { key: 'warp', label: 'Forvrengning', type: 'number', default: 0.3, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'drift', label: 'Drift per loop', type: 'number', default: 0.25, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'contrast', label: 'Kontrast', type: 'number', default: 1, min: 0.1, max: 3, step: 0.01, animatable: true },
    { key: 'seed', label: 'Frø', type: 'number', default: 1, min: 0, max: 100, step: 0.01 },
    { key: 'colorA', label: 'Farge A', type: 'color', default: '#05050a' },
    { key: 'colorB', label: 'Farge B', type: 'color', default: '#b9ff66' },
    { key: 'stops', label: 'Fargestopp', type: 'gradient', default: [] },
  ],
  async evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const ramp = gradientLutFor(
      ctx.nodeCache,
      'colorRamp',
      String(p.colorA),
      String(p.colorB),
      p.stops,
    )

    const result = await ctx.render.post(null, {
      glsl: noiseFragmentShader,
      custom: true,
      amount: 1,
      scale: 0.5,
      // Fase, ikke sekunder: shaderen regner alt i 0..1.
      time: ctx.phase,
      uniforms: {
        uScale: Number(p.scale),
        uOctaves: Math.round(Number(p.octaves)),
        uWarp: Number(p.warp),
        uDrift: Number(p.drift),
        uContrast: Number(p.contrast),
        uSeed: Number(p.seed),
        uAspect: ctx.width / Math.max(1, ctx.height),
      },
      colors: {
        uColorA: String(p.colorA),
        uColorB: String(p.colorB),
      },
      textures: {
        uColorRamp: ramp,
      },
    })

    blit(target, result)
    return { out: target.canvas }
  },
}
