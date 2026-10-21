/**
 * Port av public/orbit/image-effects.js (Smudge_animator @ 81cf506).
 *
 * Rene pikseloperasjoner, ingen DOM-avhengighet utover typed arrays.
 * Originalen er IIFE/CJS; logikken er flyttet ordrett slik at
 * paritetstestene kan sammenligne bit-identiske resultater.
 */

export const TAU = Math.PI * 2

/** Maksimal variasjon i nabolagene — brukes til adaptive rasterformer. */
export function variation(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  cell: number,
): number {
  const center = (y * w + x) * 4
  let maximum = 0
  for (const [dx, dy] of [
    [-cell, 0],
    [cell, 0],
    [0, -cell],
    [0, cell],
  ]) {
    const i = (Math.max(0, Math.min(h - 1, y + dy)) * w + Math.max(0, Math.min(w - 1, x + dx))) * 4
    for (let c = 0; c < 3; c++) maximum = Math.max(maximum, Math.abs(pixels[i + c] - pixels[center + c]))
  }
  return maximum
}

/** Linje- eller prikkeforrengning. */
export function warp(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: { type?: string; spacing?: number; amount?: number; cycles?: number },
  phase: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length)
  const spacing = Math.max(8, p.spacing ?? 48)
  const amount = p.amount ?? 12
  const time = phase * TAU * (p.cycles ?? 1)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = (y / spacing) * TAU - time
      const b = (x / spacing) * TAU
      const dx = p.type === 'warp-dots' ? amount * Math.sin(a) * Math.sin(b) : amount * Math.sin(a)
      const dy = p.type === 'warp-dots' ? amount * Math.cos(a) * Math.cos(b) : 0
      const sx = Math.max(0, Math.min(w - 1, Math.floor(x + dx + 0.5)))
      const sy = Math.max(0, Math.min(h - 1, Math.floor(y + dy + 0.5)))
      const i = (y * w + x) * 4
      const j = (sy * w + sx) * 4
      for (let c = 0; c < 4; c++) out[i + c] = data[j + c]
    }
  }
  return out
}

/** Separabel box blur, forclipped kanter, mellomresultatet rundet likt. */
export function blur(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(0, Math.min(30, Math.round(radius)))
  if (!r) return new Uint8ClampedArray(data)

  const tmp = new Uint8ClampedArray(data.length)
  const out = new Uint8ClampedArray(data.length)
  const n = 2 * r + 1

  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += data[(y * w + Math.max(0, Math.min(w - 1, k))) * 4 + c]
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = Math.floor(sum / n + 0.5)
        sum +=
          data[(y * w + Math.max(0, Math.min(w - 1, x + r + 1))) * 4 + c] -
          data[(y * w + Math.max(0, x - r)) * 4 + c]
      }
    }
  }

  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += tmp[(Math.max(0, Math.min(h - 1, k)) * w + x) * 4 + c]
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = Math.floor(sum / n + 0.5)
        sum +=
          tmp[(Math.max(0, Math.min(h - 1, y + r + 1)) * w + x) * 4 + c] -
          tmp[(Math.max(0, y - r)) * w * 4 + x * 4 + c]
      }
    }
  }

  return out
}

/** Pikselering — blokksenter-sampling. */
export function pixelate(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  size: number,
): Uint8ClampedArray {
  const block = Math.max(1, Math.round(size || 12))
  const out = new Uint8ClampedArray(data.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.floor(x / block) * block + Math.floor(block / 2))
      const sy = Math.min(h - 1, Math.floor(y / block) * block + Math.floor(block / 2))
      const i = (y * w + x) * 4
      const j = (sy * w + sx) * 4
      for (let c = 0; c < 4; c++) out[i + c] = data[j + c]
    }
  }
  return out
}

/** Relativ luminans 0..1. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

/**
 * Dekningsgrad for en rasterform, basert på luminans.
 * Formelen er ordrett fra Orbit: coverage(luminance, p).
 */
export function coverage(
  luminance: number,
  p: { sizeMode?: string; dotContrast?: number },
): number {
  if (p.sizeMode === 'uniform') return 1
  return Math.max(0, Math.min(1, 0.5 + (luminance - 0.5) * (p.dotContrast ?? 1)))
}
