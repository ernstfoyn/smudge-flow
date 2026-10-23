import type { NodeDefinition } from '../../engine/types'
import { blit } from '../../render/blit'
import { gradeFragmentShader } from '../../render/shaders/postFx'

export interface GradeParams {
  exposure: number
  tonemap: 'none' | 'aces' | 'reinhard'
  saturation: number
  contrast: number
  amount: number
}

const TONEMAPS = ['none', 'aces', 'reinhard'] as const

/**
 * Fargekorrigering i lineært rom.
 *
 * Rekkefølgen er den samme som i en vanlig grade-kjede:
 * eksponering → tonemap → metning → kontrast.
 *
 * Alle stegene er rene funksjoner av pikselen, så noden er uten tilstand
 * og lukker seg eksakt i loopen uten egne triks.
 */
export const grade: NodeDefinition<GradeParams> = {
  type: 'modifier.grade',
  label: 'Grade',
  category: 'modifier',
  description:
    'Eksponering, ACES/Reinhard-tonemap, metning og kontrast — regnet i lineært rom.',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'exposure', label: 'Eksponering', type: 'number', default: 0, min: -3, max: 3, step: 0.01, animatable: true },
    {
      key: 'tonemap', label: 'Tonemap', type: 'enum', default: 'aces',
      options: [
        { value: 'none', label: 'Ingen' },
        { value: 'aces', label: 'ACES' },
        { value: 'reinhard', label: 'Reinhard' },
      ],
    },
    { key: 'saturation', label: 'Metning', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'contrast', label: 'Kontrast', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'amount', label: 'Styrke', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  async evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as HTMLCanvasElement | undefined

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    const result = await ctx.render.post(source, {
      glsl: gradeFragmentShader,
      custom: true,
      amount: Number(p.amount),
      scale: 0.5,
      time: 0,
      uniforms: {
        uExposure: Number(p.exposure),
        uSaturation: Number(p.saturation),
        uContrast: Number(p.contrast),
        uTone: Math.max(0, TONEMAPS.indexOf(p.tonemap ?? 'none')),
      },
    })

    blit(target, result)
    return { out: target.canvas }
  },
}
