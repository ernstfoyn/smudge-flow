import type { NodeDefinition } from '../../engine/types'
import { blit } from '../../render/blit'
import { CUSTOM_SHADER_DEFAULT, customLookShader } from '../../render/shaders/custom'

export interface ShaderParams {
  code: string
  cycles: number
  amount: number
  scale: number
  valueA: number
  valueB: number
  valueC: number
  valueD: number
  colorA: string
  colorB: string
}

/**
 * Egen fullskjermseffekt, skrevet som GLSL i inspectoren.
 *
 * Koden er kroppen i `applyLook()` (se `render/shaders/custom.ts`), så den
 * har samme kontrakt som de innebygde effektene. Det gjør det mulig å
 * prototype en effekt her og senere flytte den til `looks.ts`.
 *
 * Tiden kommer fra `ctx.phase`, aldri fra `Date.now()`. Da er effekten
 * deterministisk og lukker seg når syklustallet er et heltall.
 */
export const shader: NodeDefinition<ShaderParams> = {
  type: 'modifier.shader',
  label: 'Egen shader',
  category: 'modifier',
  description:
    'Skriv egen GLSL som kroppen i applyLook(). Tilgjengelig: col, uv, centered, bl, pw, sc, uTime, uValueA–D, uColorA/B. Må returnere vec3.',
  timeDependent: true,
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'code', label: 'GLSL', type: 'code', default: CUSTOM_SHADER_DEFAULT },
    {
      key: 'cycles', label: 'Sykluser', type: 'int', default: 1, min: 0, max: 8,
    },
    { key: 'amount', label: 'Styrke', type: 'number', default: 1, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'scale', label: 'Skala', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'valueA', label: 'Verdi A', type: 'number', default: 0.5, min: -1, max: 1, step: 0.01, animatable: true },
    { key: 'valueB', label: 'Verdi B', type: 'number', default: 0.5, min: -1, max: 1, step: 0.01, animatable: true },
    { key: 'valueC', label: 'Verdi C', type: 'number', default: 0.5, min: -1, max: 1, step: 0.01, animatable: true },
    { key: 'valueD', label: 'Verdi D', type: 'number', default: 0.5, min: -1, max: 1, step: 0.01, animatable: true },
    { key: 'colorA', label: 'Farge A', type: 'color', default: '#b9ff66' },
    { key: 'colorB', label: 'Farge B', type: 'color', default: '#4bdac5' },
  ],
  async evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as HTMLCanvasElement | undefined

    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }

    // Hele sykluser per loop. Fasen brettes til 0..1, slik at fase 1 gir
    // nøyaktig samme tid som fase 0 — effekten lukker loopen.
    const cycles = Math.max(0, Math.round(Number(p.cycles)))
    const phase = ctx.phase - Math.floor(ctx.phase)
    const time = phase * (ctx.totalFrames / ctx.fps) * cycles

    const result = await ctx.render.post(source, {
      glsl: customLookShader(String(p.code ?? '')),
      custom: true,
      amount: Number(p.amount),
      scale: Number(p.scale),
      time,
      uniforms: {
        uValueA: Number(p.valueA),
        uValueB: Number(p.valueB),
        uValueC: Number(p.valueC),
        uValueD: Number(p.valueD),
      },
      colors: {
        uColorA: String(p.colorA),
        uColorB: String(p.colorB),
      },
    })

    blit(target, result)
    return { out: target.canvas }
  },
}
