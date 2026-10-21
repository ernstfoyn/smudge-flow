import { describe, expect, it } from 'vitest'
import { loadLegacy } from './loadLegacy'
import { blur, coverage, pixelate, variation, warp } from '../../src/render/raster/effects'

/**
 * Paritet: de nye pikseloperasjonene skal gi IDENTISKE data som
 * public/orbit/image-effects.js.
 */
const legacy = loadLegacy<{
  warp: (d: Uint8ClampedArray, w: number, h: number, p: any, phase: number) => Uint8ClampedArray
  blur: (d: Uint8ClampedArray, w: number, h: number, r: number) => Uint8ClampedArray
  pixelate: (d: Uint8ClampedArray, w: number, h: number, s: number) => Uint8ClampedArray
  coverage: (l: number, p: any) => number
  variation: (d: Uint8ClampedArray, w: number, h: number, x: number, y: number, c: number) => number
}>('orbit/image-effects.js')

function makePixels(w: number, h: number, seed = 1): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  let s = seed
  for (let i = 0; i < data.length; i++) {
    s = (s * 1103515245 + 12345) % 2147483648
    data[i] = s % 256
  }
  return data
}

const W = 24
const H = 16

describe('paritet: pikseleffekter', () => {
  it('warp gir identisk resultat', () => {
    const data = makePixels(W, H)
    for (const type of ['warp-lines', 'warp-dots']) {
      const p = { type, spacing: 12, amount: 8, cycles: 2 }
      for (const phase of [0, 0.25, 0.5]) {
        const a = warp(data, W, H, p, phase)
        const b = legacy.warp(data, W, H, p, phase)
        expect(Array.from(a)).toEqual(Array.from(b))
      }
    }
  })

  it('blur gir identisk resultat', () => {
    const data = makePixels(W, H)
    for (const radius of [0, 1, 3, 7]) {
      const a = blur(data, W, H, radius)
      const b = legacy.blur(data, W, H, radius)
      expect(Array.from(a)).toEqual(Array.from(b))
    }
  })

  it('pixelate gir identisk resultat', () => {
    const data = makePixels(W, H)
    for (const size of [1, 4, 12]) {
      const a = pixelate(data, W, H, size)
      const b = legacy.pixelate(data, W, H, size)
      expect(Array.from(a)).toEqual(Array.from(b))
    }
  })

  it('coverage gir identisk resultat', () => {
    for (const lum of [0, 0.25, 0.5, 0.75, 1]) {
      for (const sizeMode of ['luminance', 'uniform', 'adaptive']) {
        for (const dotContrast of [1, 2, 4]) {
          const p = { sizeMode, dotContrast }
          expect(coverage(lum, p)).toBe(legacy.coverage(lum, p))
        }
      }
    }
  })

  it('variation gir identisk resultat', () => {
    const data = makePixels(W, H)
    for (const [x, y, cell] of [
      [0, 0, 4],
      [5, 7, 8],
      [23, 15, 3],
    ]) {
      expect(variation(data, W, H, x, y, cell)).toBe(legacy.variation(data, W, H, x, y, cell))
    }
  })
})
