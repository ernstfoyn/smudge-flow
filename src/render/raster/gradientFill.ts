import { paint, stops, type GradientStop } from '../../engine/color/gradient'

export interface GradientPaintParams {
  fill: 'solid' | 'linear' | 'radial'
  colorA: string
  colorB: string
  stops?: GradientStop[]
  angle: number
  travel: number
  density: number
}

/**
 * Lager en Canvas-gradient med vilkårlig mange fargestopp.
 * Kalles med et koordinatsystem som er sentrert på flaten.
 */
export function gradientPaint(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: GradientPaintParams,
  phase: number,
): string | CanvasGradient {
  if (p.fill === 'solid') return p.colorA

  const material = {
    travel: p.travel > 0,
    amount: p.travel,
    density: p.density,
    time: phase * Math.PI * 2,
  }

  const base: GradientStop[] = stops({
    colorA: p.colorA,
    colorB: p.colorB,
    gradient: p.stops && p.stops.length ? { stops: p.stops } : undefined,
  })
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
