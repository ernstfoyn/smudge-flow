import type { Keyframe, KeyframeEasing } from '../types'

type AnyRecord = Record<string, any>

/** Leser en verdi på en punktsti, f.eks. "transform.position.x". */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<any>((v, k) => (v == null ? v : v[k]), obj)
}

/** Skriver en verdi på en punktsti, og lager mellomnivåer ved behov. */
export function setPath(obj: AnyRecord, path: string, value: unknown): void {
  const keys = path.split('.')
  const last = keys.pop()!
  let target = obj
  for (const k of keys) target = target[k] ??= {}
  target[last] = value
}

function mix(a: unknown, b: unknown, t: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t
  if (
    typeof a === 'string' &&
    typeof b === 'string' &&
    /^#[0-9a-f]{6}$/i.test(a) &&
    /^#[0-9a-f]{6}$/i.test(b)
  ) {
    const channels = [1, 3, 5].map((i) =>
      Math.min(
        255,
        Math.max(
          0,
          Math.round(
            parseInt(a.slice(i, i + 2), 16) * (1 - t) +
              parseInt(b.slice(i, i + 2), 16) * t,
          ),
        ),
      ),
    )
    return '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('')
  }
  // Diskrete verdier (enums, strenger, objekttyper) hopper i stedet for å blandes.
  return t < 1 ? a : b
}

function easeIn(t: number): number {
  return t * t * t
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function outBounce(t: number): number {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) {
    const u = t - 1.5 / d
    return n * u * u + 0.75
  }
  if (t < 2.5 / d) {
    const u = t - 2.25 / d
    return n * u * u + 0.9375
  }
  const u = t - 2.625 / d
  return n * u * u + 0.984375
}

function outElastic(t: number): number {
  if (t === 0 || t === 1) return t
  const c = (2 * Math.PI) / 3
  return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c) + 1
}

/** Overgangskurvene brukerne kan velge per keyframe. */
export const EASINGS: Record<KeyframeEasing, (t: number) => number> = {
  linear: (t) => t,
  hold: (t) => (t < 1 ? 0 : 1),
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
  bounce: outBounce,
  elastic: outElastic,
}

export const EASING_OPTIONS: Array<{ value: KeyframeEasing; label: string }> = [
  { value: 'linear', label: 'Lineær' },
  { value: 'hold', label: 'Hold (hopp)' },
  { value: 'ease-in', label: 'Myk start' },
  { value: 'ease-out', label: 'Myk slutt' },
  { value: 'ease-in-out', label: 'Myk start og slutt' },
  { value: 'bounce', label: 'Sprett' },
  { value: 'elastic', label: 'Elastisk' },
]

const interpolators = Object.fromEntries(
  Object.entries(EASINGS).map(([name, easing]) => [
    name,
    (a: unknown, b: unknown, t: number) => mix(a, b, easing(t)),
  ]),
) as Record<string, (a: unknown, b: unknown, t: number) => unknown>

/**
 * Verdien til et spor på en gitt frame.
 * Binærsøk i sorterte keyframes; utgående keyframe bestemmer interpolasjonen.
 */
export function valueAt(base: unknown, keys: Keyframe[] = [], frame: number): unknown {
  if (!keys.length) return base
  if (frame <= keys[0].frame) return keys[0].value
  if (frame >= keys[keys.length - 1].frame) return keys[keys.length - 1].value

  let lo = 0
  let hi = keys.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (keys[mid].frame <= frame) lo = mid
    else hi = mid
  }

  const a = keys[lo]
  const b = keys[hi]
  const interpolate = interpolators[a.interpolation ?? 'linear'] ?? interpolators.linear
  const span = b.frame - a.frame
  return interpolate(a.value, b.value, span === 0 ? 0 : (frame - a.frame) / span)
}

/** Setter eller oppdaterer en keyframe. Listen holdes alltid sortert. */
export function upsertKey(
  keys: Keyframe[],
  frame: number,
  value: unknown,
  interpolation?: Keyframe['interpolation'],
): Keyframe[] {
  const existing = keys.find((k) => k.frame === frame)
  const next = keys.filter((k) => k.frame !== frame)
  next.push({ frame, value, interpolation: interpolation ?? existing?.interpolation ?? 'linear' })
  return next.sort((a, b) => a.frame - b.frame)
}

export function removeKey(keys: Keyframe[], frame: number): Keyframe[] {
  return keys.filter((k) => k.frame !== frame)
}

/** Finner keyframen rett før / rett etter en frame. */
export function neighbourKey(keys: Keyframe[], frame: number, direction: -1 | 1): Keyframe | null {
  if (direction < 0) {
    for (let i = keys.length - 1; i >= 0; i--) if (keys[i].frame < frame) return keys[i]
    return null
  }
  for (const k of keys) if (k.frame > frame) return k
  return null
}

/** Evaluerer alle spor i en node inn i en kopi av params. */
export function evaluateTracks(
  params: Record<string, unknown>,
  tracks: Record<string, Keyframe[]> | undefined,
  frame: number,
): Record<string, unknown> {
  const result = structuredClone(params) as AnyRecord
  for (const [path, keys] of Object.entries(tracks ?? {})) {
    setPath(result, path, valueAt(getPath(params, path), keys, frame))
  }
  return result
}
