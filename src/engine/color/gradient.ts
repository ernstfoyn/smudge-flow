/**
 * Port av public/orbit/gradient.js (Smudge_animator @ 81cf506).
 * Flerstops gradient-sampler. Mykhet er den blandede andelen av hvert intervall.
 */

export interface GradientStop {
  position: number
  color: string
  softness?: number
}

export interface GradientProperties {
  colorA: string
  colorB: string
  gradient?: { stops: Record<string, GradientStop> }
}

const rgb = (hex: string): number[] =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export function blend(a: string, b: string, t: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return (
    '#' +
    x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
  )
}

/** Normaliserer til en sortert liste på maks 8 stopp. */
export function stops(p: GradientProperties): GradientStop[] {
  const list = p.gradient
    ? Object.values(p.gradient.stops)
    : [
        { position: 0, color: p.colorA, softness: 1 },
        { position: 1, color: p.colorB, softness: 1 },
      ]
  return list
    .map((s) => ({
      ...s,
      position: Math.max(0, Math.min(1, s.position)),
      softness: s.softness ?? 1,
    }))
    .sort((a, b) => a.position - b.position)
    .slice(0, 8)
}

/** Fargen ved posisjon t. */
export function color(list: GradientStop[], t: number): string {
  let result = list[0].color
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]
    const b = list[i]
    if (t < a.position) break
    const span = b.position - a.position
    const x = span ? Math.max(0, Math.min(1, (t - a.position) / span)) : 1
    const soft = Math.max(0, Math.min(1, a.softness ?? 1))
    const mix = soft ? Math.max(0, Math.min(1, (x - 0.5) / soft + 0.5)) : x >= 0.5 ? 1 : 0
    result = blend(a.color, b.color, mix)
    if (t < b.position) break
  }
  return result
}

export interface PaintMaterial {
  travel?: boolean
  amount?: number
  density?: number
  time?: number
}

/**
 * Bygger en mal for gradient-fill. Når `travel` er sann, flyttes
 * fargestoppene langs en bølge (brukes av overflate-animasjon).
 */
export function paint(list: GradientStop[], m: PaintMaterial): GradientStop[] {
  const xs = new Set([0, 1])
  for (let i = 0; i <= 256; i++) xs.add(i / 256)

  if (!m.travel) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]
      const b = list[i]
      const mid = (a.position + b.position) / 2
      const width = (b.position - a.position) * (a.softness ?? 1) / 2
      xs.add(Math.max(0, mid - width - 0.000001))
      xs.add(Math.min(1, mid + width + 0.000001))
    }
  }

  return [...xs]
    .sort((a, b) => a - b)
    .map((x) => ({
      position: x,
      color: color(
        list,
        m.travel
          ? x * (1 - (m.amount ?? 0)) +
              (0.5 + 0.5 * Math.cos(Math.PI * 2 * x * (m.density ?? 1) - (m.time ?? 0))) *
                (m.amount ?? 0)
          : x,
      ),
    }))
}
