import type { NodeDefinition } from '../../engine/types'
import { paint, stops, type GradientStop } from '../../engine/color/gradient'

export type FillType = 'solid' | 'linear' | 'radial'

export interface GradientParams {
  fill: FillType
  colorA: string
  colorB: string
  angle: number
  /** Animasjon: 0 = statisk, ellers hvor mye fargene vandrer. */
  travel: number
  density: number
}

/**
 * Lager en gradient-stoppliste som kan males på canvas.
 * Port av makeGradient() + GradientRamp fra Orbit.
 */
export function makeGradient(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: GradientParams,
  phase: number,
): string | CanvasGradient {
  if (p.fill === 'solid') return p.colorA

  const material = {
    travel: p.travel > 0,
    amount: p.travel,
    density: p.density,
    time: phase * Math.PI * 2,
  }

  const base: GradientStop[] = stops({ colorA: p.colorA, colorB: p.colorB })
  const paintStops = paint(base, material)

  const angle = (p.angle * Math.PI) / 180
  const dx = Math.cos(angle) * (size / Math.SQRT2)
  const dy = Math.sin(angle) * (size / Math.SQRT2)

  const gradient =
    p.fill === 'radial'
      ? ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.7)
      : ctx.createLinearGradient(-dx, -dy, dx, dy)

  for (const stop of paintStops) gradient.addColorStop(stop.position, stop.color)
  return gradient
}

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
