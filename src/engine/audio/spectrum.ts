/**
 * Lydanalyse for parameterstyring.
 *
 * Analysen er deterministisk: den leser et vindu rundt en bestemt tid i en
 * dekodet lydbuffer og regner ut nivå og energi i tre frekvensbånd. Da gir
 * samme frame samme verdi i preview og eksport.
 */

export interface AudioDataLike {
  numberOfChannels: number
  length: number
  sampleRate: number
  getChannelData(channel: number): Float32Array
}

export interface AudioLevels {
  level: number
  bass: number
  mid: number
  treble: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** In-place radix-2 FFT. Lengden må være en potens av to. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len
    const wRe = Math.cos(angle)
    const wIm = Math.sin(angle)
    for (let i = 0; i < n; i += len) {
      let curRe = 1
      let curIm = 0
      for (let j = 0; j < len / 2; j++) {
        const even = i + j
        const odd = even + len / 2
        const oddRe = re[odd] * curRe - im[odd] * curIm
        const oddIm = re[odd] * curIm + im[odd] * curRe
        re[odd] = re[even] - oddRe
        im[odd] = im[even] - oddIm
        re[even] += oddRe
        im[even] += oddIm
        const nextRe = curRe * wRe - curIm * wIm
        curIm = curRe * wIm + curIm * wRe
        curRe = nextRe
      }
    }
  }
}

function bandPeak(
  re: Float32Array,
  im: Float32Array,
  sampleRate: number,
  minHz: number,
  maxHz: number,
): number {
  const n = re.length
  const minBin = Math.max(1, Math.floor((minHz * n) / sampleRate))
  const maxBin = Math.min(n / 2 - 1, Math.ceil((maxHz * n) / sampleRate))
  let peak = 0
  for (let bin = minBin; bin <= maxBin; bin++) {
    const magnitude = Math.sqrt(re[bin] ** 2 + im[bin] ** 2) / n
    if (magnitude > peak) peak = magnitude
  }
  return peak
}

/** Leser nivå og frekvensbånd rundt `time` (sekunder). */
export function analyzeAudio(
  audio: AudioDataLike,
  time: number,
  windowSeconds = 0.06,
  gain = 1,
): AudioLevels {
  if (!audio || !audio.length || !audio.sampleRate) {
    return { level: 0, bass: 0, mid: 0, treble: 0 }
  }

  const target = Math.max(64, Math.round(windowSeconds * audio.sampleRate))
  const n = 2 ** Math.floor(Math.log2(Math.min(2048, target)))
  const start = Math.min(
    Math.max(0, audio.length - n),
    Math.max(0, Math.round(time * audio.sampleRate - n / 2)),
  )
  const channels = Math.max(1, audio.numberOfChannels)
  const mono = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    let sum = 0
    const index = start + i
    for (let ch = 0; ch < channels; ch++) {
      const data = audio.getChannelData(ch)
      sum += data[index] ?? 0
    }
    mono[i] = sum / channels
  }

  let energy = 0
  const re = new Float32Array(n)
  const im = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const sample = mono[i]
    energy += sample * sample
    // Hann-vindu gir mindre lekkasje mellom frekvensbåndene.
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)))
    re[i] = sample * window
  }
  fft(re, im)

  const scale = 4 * Math.max(0, gain)
  return {
    level: clamp01(Math.sqrt(energy / n) * 1.6 * Math.max(0, gain)),
    bass: clamp01(bandPeak(re, im, audio.sampleRate, 20, 250) * scale),
    mid: clamp01(bandPeak(re, im, audio.sampleRate, 250, 2000) * scale),
    treble: clamp01(bandPeak(re, im, audio.sampleRate, 2000, 12000) * scale),
  }
}
