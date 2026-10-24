import { describe, expect, it } from 'vitest'
import {
  ASPECT_PRESETS,
  aspectPresetFor,
  clampOutputSize,
  dimensionsForAspect,
  resolveOutputFormat,
} from '../src/export/outputFormat'

describe('outputFormat', () => {
  it('gjenkjenner standard bildeformater', () => {
    expect(aspectPresetFor(960, 960)).toBe('square')
    expect(aspectPresetFor(1920, 1080)).toBe('landscape')
    expect(aspectPresetFor(1080, 1920)).toBe('portrait')
    expect(aspectPresetFor(1080, 1350)).toBe('vertical')
    expect(aspectPresetFor(1440, 1080)).toBe('classic')
    expect(aspectPresetFor(2520, 1080)).toBe('wide')
  })

  it('viser egendefinert når forholdet ikke matcher en preset', () => {
    expect(aspectPresetFor(1000, 700)).toBe('custom')
    expect(aspectPresetFor(0, 700)).toBe('custom')
  })

  it('beholder den lengste siden når formatet endres', () => {
    expect(dimensionsForAspect(16 / 9, 960, 960)).toEqual({ width: 960, height: 540 })
    expect(dimensionsForAspect(9 / 16, 960, 540)).toEqual({ width: 540, height: 960 })
    expect(dimensionsForAspect(16 / 9, 1080, 1920)).toEqual({ width: 1920, height: 1080 })
    expect(dimensionsForAspect(1, 1920, 1080)).toEqual({ width: 1920, height: 1920 })
    expect(dimensionsForAspect(4 / 5, 960, 540)).toEqual({ width: 768, height: 960 })
    expect(dimensionsForAspect(21 / 9, 960, 960)).toEqual({ width: 960, height: 412 })
  })

  it('krymper ikke når man veksler mellom formater', () => {
    const landscape = dimensionsForAspect(16 / 9, 960, 960)
    const portrait = dimensionsForAspect(9 / 16, landscape.width, landscape.height)
    const back = dimensionsForAspect(16 / 9, portrait.width, portrait.height)

    expect(portrait).toEqual({ width: 540, height: 960 })
    expect(back).toEqual(landscape)
  })

  it('holder alle preset-forhold innenfor lagrede partallsdimensjoner', () => {
    for (const preset of ASPECT_PRESETS) {
      const size = dimensionsForAspect(preset.ratio, 1920, 1080)
      expect(size.width % 2).toBe(0)
      expect(size.height % 2).toBe(0)
      expect(size.width).toBeGreaterThanOrEqual(64)
      expect(size.height).toBeGreaterThanOrEqual(64)
      expect(aspectPresetFor(size.width, size.height)).not.toBe('custom')
    }
  })

  it('klemmer og runder av eksportdimensjoner', () => {
    expect(clampOutputSize(0, 960)).toBe(960)
    expect(clampOutputSize('1920', 960)).toBe(1920)
    expect(clampOutputSize(65, 960)).toBe(66)
    expect(clampOutputSize(9000, 960)).toBe(4096)
  })

  it('lar eksportnoden overstyre prosjektformatet', () => {
    expect(resolveOutputFormat('webm', 'mp4')).toBe('webm')
    expect(resolveOutputFormat('mp4', 'webm')).toBe('mp4')
    expect(resolveOutputFormat(undefined, 'webm')).toBe('webm')
    expect(resolveOutputFormat('ukjent', 'ukjent')).toBe('mp4')
  })
})
