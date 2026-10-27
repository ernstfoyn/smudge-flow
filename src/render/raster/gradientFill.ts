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
function paintedStops(p: GradientPaintParams, phase: number): GradientStop[] {
  const base: GradientStop[] = stops({
    colorA: p.colorA,
    colorB: p.colorB,
    gradient: p.stops && p.stops.length ? { stops: p.stops } : undefined,
  })
  return paint(base, {
    travel: p.travel > 0,
    amount: p.travel,
    density: p.density,
    time: phase * Math.PI * 2,
  })
}

export function gradientPaint(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: GradientPaintParams,
  phase: number,
): string | CanvasGradient {
  if (p.fill === 'solid') return p.colorA

  const paintStops = paintedStops(p, phase)
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

export interface GradientBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Gradient som dekker en vilkårlig boks i gjeldende koordinatsystem.
 *
 * Brukes av 2D-tekst og 2D-fasong, der gradienten skal følge objektets
 * egne mål i stedet for hele lerretet.
 */
export function gradientPaintBox(
  ctx: CanvasRenderingContext2D,
  box: GradientBox,
  p: GradientPaintParams,
  phase = 0,
): string | CanvasGradient {
  if (p.fill === 'solid') return p.colorA

  const paintStops = paintedStops(p, phase)
  const angle = (p.angle * Math.PI) / 180
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const gradient =
    p.fill === 'radial'
      ? ctx.createRadialGradient(
          cx,
          cy,
          0,
          cx,
          cy,
          Math.max(box.width, box.height) / 2,
        )
      : ctx.createLinearGradient(
          cx - (Math.cos(angle) * box.width) / 2,
          cy - (Math.sin(angle) * box.height) / 2,
          cx + (Math.cos(angle) * box.width) / 2,
          cy + (Math.sin(angle) * box.height) / 2,
        )

  for (const stop of paintStops) gradient.addColorStop(stop.position, stop.color)
  return gradient
}
