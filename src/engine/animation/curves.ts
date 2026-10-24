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

export const CURVE_DEFAULTS: CurveParams = {
  width: 0.5,
  detail: 6,
  seed: 1,
  ripples: 4,
  damping: 5,
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
    case 'sine':
    default:
      return Math.sin(TWO_PI * t)
  }
}
