/**
 * Løkkesikre kurveformer.
 *
 * Alle former er periodiske i `t` med periode 1 og gir verdi i -1..1.
 * Med heltalls antall sykluser per loop er verdien ved frame 0 derfor lik
 * verdien ved frame N — animasjonen lukker seg uten hopp.
 */

const TWO_PI = Math.PI * 2

/** Brøkdelen av t, alltid i 0..1 (også for negative t). */
export function fract(t: number): number {
  return t - Math.floor(t)
}

/** Deterministisk hash — samme inngang gir samme utdata, alltid. */
export function hash(n: number, seed: number): number {
  const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Støy som er *periodisk*: interpolerer mellom hash-verdier på et sirkulært
 * gitter, slik at siste punkt == første punkt.
 */
export function loopedNoise(t: number, detail: number, seed: number): number {
  const n = Math.max(2, Math.round(detail))
  const scaled = t * n
  const i = Math.floor(scaled)
  const f = scaled - i
  const a = hash(((i % n) + n) % n, seed)
  const b = hash((((i + 1) % n) + n) % n, seed)
  const u = f * f * (3 - 2 * f) // smoothstep
  return (a + (b - a) * u) * 2 - 1
}

/** Ett punkt på en tegnet kurve: x = 0..1 i syklusen, y = −1..1. */
export interface CurvePoint {
  x: number
  y: number
}

export const DEFAULT_CURVE_POINTS: CurvePoint[] = [
  { x: 0, y: 0 },
  { x: 0.25, y: 1 },
  { x: 0.5, y: 0 },
  { x: 0.75, y: -1 },
]

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Rydder opp i punkter fra en lagret graf: gyldige tall, sortert på x. */
export function normalizePoints(raw: unknown): CurvePoint[] {
  if (!Array.isArray(raw)) return DEFAULT_CURVE_POINTS
  const points = raw
    .filter((p): p is CurvePoint => !!p && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: clamp(p.x, 0, 0.999), y: clamp(p.y, -1, 1) }))
    .sort((a, b) => a.x - b.x)
  return points.length >= 2 ? points : DEFAULT_CURVE_POINTS
}

/**
 * Tegnet kurve. Punktene danner en *sluttet* løkke: kurven fortsetter fra det
 * siste punktet tilbake til det første, så verdien er lik ved syklusens start
 * og slutt. «smooth» bruker kubisk interpolasjon med felles tangenter over
 * skjøten, ellers rette linjer.
 */
export function drawnCurve(raw: unknown, t: number, smooth = true): number {
  const pts = normalizePoints(raw)
  const n = pts.length
  const f = fract(t)

  const at = (j: number): CurvePoint => {
    const wraps = Math.floor(j / n)
    const p = pts[((j % n) + n) % n]
    return { x: p.x + wraps, y: p.y }
  }

  let j = -1
  while (j + 1 <= n - 1 && at(j + 1).x <= f) j++

  const p0 = at(j)
  const p1 = at(j + 1)
  const h = p1.x - p0.x
  const u = h > 1e-9 ? (f - p0.x) / h : 0

  if (!smooth) return clamp(p0.y + (p1.y - p0.y) * u, -1, 1)

  const before = at(j - 1)
  const after = at(j + 2)
  const m0 = (p1.y - before.y) / Math.max(1e-9, p1.x - before.x)
  const m1 = (after.y - p0.y) / Math.max(1e-9, after.x - p0.x)
  const u2 = u * u
  const u3 = u2 * u
  const y =
    (2 * u3 - 3 * u2 + 1) * p0.y +
    (u3 - 2 * u2 + u) * h * m0 +
    (-2 * u3 + 3 * u2) * p1.y +
    (u3 - u2) * h * m1
  return clamp(y, -1, 1)
}

export interface CurveParams {
  /** Pulsbredde for firkant (0..1). */
  width: number
  /** Antall punkter i støy / antall trinn i trapp og tilfeldig trinn. */
  detail: number
  seed: number
  /** Antall svingninger per syklus i fjær-kurven. */
  ripples: number
  /** Hvor raskt fjær-kurven dør ut. */
  damping: number
  /** Punkter for den tegnede kurven. */
  points: unknown
  /** Tegnet kurve: 'smooth' (glatt) eller 'linear'. */
  interp: string
}

export type CurveShape =
  | 'sine'
  | 'triangle'
  | 'saw'
  | 'square'
  | 'noise'
  | 'ease'
  | 'bounce'
  | 'spring'
  | 'steps'
  | 'hold'
  | 'draw'

export const CURVE_DEFAULTS: CurveParams = {
  width: 0.5,
  detail: 6,
  seed: 1,
  ripples: 4,
  damping: 5,
  points: DEFAULT_CURVE_POINTS,
  interp: 'smooth',
}

/** Verdi i -1..1 for en kurveform. `t` er antall sykluser så langt. */
export function curveValue(
  shape: CurveShape,
  t: number,
  params: Partial<CurveParams> = {},
): number {
  const p = { ...CURVE_DEFAULTS, ...params }
  const f = fract(t)

  switch (shape) {
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(TWO_PI * t))
    case 'saw':
      return f * 2 - 1
    case 'square':
      return f < Math.min(1, Math.max(0, p.width)) ? 1 : -1
    case 'noise':
      return loopedNoise(f, p.detail, p.seed)
    case 'ease': {
      // Myk opp-og-ned: smoothstep over en frem-og-tilbake-bue.
      const u = 1 - Math.abs(2 * f - 1)
      return (u * u * (3 - 2 * u)) * 2 - 1
    }
    case 'bounce':
      // Ball som spretter: skarpe bunner, runde topper.
      return Math.abs(Math.sin(Math.PI * t)) * 2 - 1
    case 'spring':
      // Dempet svingning som starter på 1 og dør ut mot 0 hver syklus.
      return Math.exp(-Math.max(0, p.damping) * f) * Math.cos(TWO_PI * Math.max(0, p.ripples) * f)
    case 'steps': {
      const n = Math.max(2, Math.round(p.detail))
      return (Math.floor(f * n) / (n - 1)) * 2 - 1
    }
    case 'hold': {
      const n = Math.max(2, Math.round(p.detail))
      return hash(Math.floor(f * n) % n, p.seed) * 2 - 1
    }
    case 'draw':
      return drawnCurve(p.points, t, p.interp !== 'linear')
    case 'sine':
    default:
      return Math.sin(TWO_PI * t)
  }
}
