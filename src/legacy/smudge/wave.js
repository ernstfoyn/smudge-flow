// ---------------------------------------------------------------------------
// LFO (low-frequency oscillator) helpers.
// These make a parameter value drift up and down over time, so it animates
// all by itself while the app is playing.
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2

// Cheap deterministic random in 0..1.
function hash(n) {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

// Smoothly interpolated random — gives an organic, non-repeating wobble.
function smoothNoise(t) {
  const i = Math.floor(t)
  const f = t - i
  const a = hash(i)
  const b = hash(i + 1)
  const u = f * f * (3 - 2 * f) // smoothstep
  return (a + (b - a) * u) * 2 - 1
}

// Every waveform returns a value in the -1 .. 1 range.
export function wave(shape, t) {
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

export const WAVEFORMS = [
  { id: 'sine', label: 'Sine — smooth' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'saw', label: 'Sawtooth' },
  { id: 'square', label: 'Square — on / off' },
  { id: 'random', label: 'Random — organic' },
]

// Work out the animated value for a single parameter.
//   base  : the value the slider is set to
//   cfg   : { on, amount, speed, shape, phase }
//   range : [min, max] of the parameter
//   isInt : round to a whole number (for octaves, kaleido, ...)
//   time  : the animation clock in seconds
export function applyLfo(base, cfg, range, isInt, time) {
  if (!cfg || !cfg.on) return base
  const [min, max] = range
  const t = time * cfg.speed + cfg.phase
  let value = base + wave(cfg.shape, t) * cfg.amount * (max - min) * 0.5
  value = Math.min(max, Math.max(min, value))
  return isInt ? Math.round(value) : value
}
