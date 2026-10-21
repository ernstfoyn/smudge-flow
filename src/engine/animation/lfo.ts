import type { LfoConfig } from '../types'

const TWO_PI = Math.PI * 2

/** Deterministisk hash — samme inngang gir samme utdata, alltid. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/** Glatt interpolert støy — organisk, men deterministisk. */
function smoothNoise(t: number): number {
  const i = Math.floor(t)
  const f = t - i
  const a = hash(i)
  const b = hash(i + 1)
  const u = f * f * (3 - 2 * f) // smoothstep
  return (a + (b - a) * u) * 2 - 1
}

/** Alle bølgeformer gir verdi i -1..1. */
export function wave(shape: LfoConfig['shape'], t: number): number {
  switch (shape) {
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(TWO_PI * t))
    case 'saw':
      return (t - Math.floor(t)) * 2 - 1
    case 'square':
      return Math.sin(TWO_PI * t) >= 0 ? 1 : -1
    case 'random':
      return smoothNoise(t)
    case 'sine':
    default:
      return Math.sin(TWO_PI * t)
  }
}

export const WAVEFORMS: Array<{ id: LfoConfig['shape']; label: string }> = [
  { id: 'sine', label: 'Sine' },
  { id: 'triangle', label: 'Trekant' },
  { id: 'saw', label: 'Sag' },
  { id: 'square', label: 'Firkant' },
  { id: 'random', label: 'Støy' },
]

/**
 * Effektiv verdi = grunnverdi + LFO.
 *
 * MERK: `phase` er frame/totalFrames (ikke sekunder). Da er en syklus
 * eksakt én loop, uansett fps — loopen lukker seg bit-identisk.
 */
export function applyLfo(
  base: number,
  cfg: LfoConfig | undefined,
  range: [number, number],
  isInt: boolean,
  phase: number,
): number {
  if (!cfg?.on) return base
  const [min, max] = range
  const t = phase * cfg.cycles + cfg.phase
  let value = base + wave(cfg.shape, t) * cfg.amount * (max - min) * 0.5
  value = Math.min(max, Math.max(min, value))
  return isInt ? Math.round(value) : value
}
