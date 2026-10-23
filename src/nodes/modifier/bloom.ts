import type { NodeDefinition } from '../../engine/types'
import { blit } from '../../render/blit'
import { bloomFragmentShader } from '../../render/shaders/postFx'

export interface BloomParams {
  threshold: number
  radius: number
  softness: number
  strength: number
}

/**
 * Gløding rundt lyse partier.
 *
 * Terskelen er luminansbasert, slik at bare det som faktisk er lyst
 * gløder — samme prinsipp som bright-pass-steget i vgpu-eksemplene
 * (earth, black-hole). 24 sampler i en Vogel-skive gir jevn gløding
 * uten synlig støy i ett enkelt pass.
 */
export const bloom: NodeDefinition<BloomParams> = {
  type: 'modifier.bloom',
  label: 'Glød',
  category: 'modifier',
  description: 'Luminansterskel + myk gløding rundt lyse partier. Bruk før Grade.',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'threshold', label: 'Terskel', type: 'number', default: 0.7, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'radius', label: 'Radius', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'softness', label: 'Mykhet', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'strength', label: 'Styrke', type: 'number', default: 0.8, min: 0, max: 2, step: 0.01, animatable: true },
  ],
  async evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as HTMLCanvasElement | undefined

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    const result = await ctx.render.post(source, {
      glsl: bloomFragmentShader,
      custom: true,
      amount: Number(p.strength),
      scale: 0.5,
      time: 0,
      uniforms: {
        uThreshold: Number(p.threshold),
        uRadius: Number(p.radius),
        uSoft: Number(p.softness),
      },
    })

    blit(target, result)
    return { out: target.canvas }
  },
}
