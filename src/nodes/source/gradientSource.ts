import type { NodeDefinition } from '../../engine/types'
import type { GradientStop } from '../../engine/color/gradient'
import { gradientPaint } from '../../render/raster/gradientFill'

export type FillType = 'solid' | 'linear' | 'radial'

export interface GradientParams {
  fill: FillType
  colorA: string
  colorB: string
  angle: number
  /** Animasjon: 0 = statisk, ellers hvor mye fargene vandrer. */
  travel: number
  density: number
  /** Overstyrer colorA/colorB når den har innhold. */
  stops?: GradientStop[]
}

/** Gradient med vilkårlig mange fargestopp, sentrert på flaten. */
export const makeGradient = gradientPaint

export const gradientSource: NodeDefinition<GradientParams> = {
  type: 'source.gradient',
  label: 'Gradient',
  category: 'source',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bakgrunn', type: 'canvas' }],
  params: [
    {
      key: 'fill', label: 'Fyll', type: 'enum', default: 'linear',
      options: [
        { value: 'solid', label: 'Ensfarget' },
        { value: 'linear', label: 'Lineær' },
        { value: 'radial', label: 'Radial' },
      ],
    },
    { key: 'colorA', label: 'Farge A', type: 'color', default: '#b9ff66' },
    { key: 'colorB', label: 'Farge B', type: 'color', default: '#4bdac5' },
    { key: 'stops', label: 'Fargestopp', type: 'gradient', default: [] },
    { key: 'angle', label: 'Vinkel', type: 'number', default: 45, min: -180, max: 180, animatable: true },
    { key: 'travel', label: 'Fargevandring', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'density', label: 'Tetthet', type: 'number', default: 2, min: 0.5, max: 8, step: 0.5, animatable: true },
  ],
  evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const { ctx: c, width: w, height: h } = target
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, w, h)
    c.translate(w / 2, h / 2)
    c.fillStyle = makeGradient(c, Math.max(w, h), p, ctx.phase)
    c.fillRect(-w / 2, -h / 2, w, h)
    c.restore()
    return { out: target.canvas }
  },
}
