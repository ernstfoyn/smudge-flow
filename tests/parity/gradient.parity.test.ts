import { describe, expect, it } from 'vitest'
import { loadLegacy } from './loadLegacy'
import { blend, color, paint, stops } from '../../src/engine/color/gradient'
import { sample } from '../../src/render/raster/motionGraphics'

/**
 * Paritet: gradient-sampleren og den generative grafikken skal matche
 * public/orbit/gradient.js og public/orbit/motion-graphics.js.
 */
const legacyGradient = loadLegacy<{
  stops: (p: any) => any[]
  color: (list: any[], t: number) => string
  blend: (a: string, b: string, t: number) => string
  paint: (list: any[], m: any) => any[]
}>('orbit/gradient.js')

const legacyMotion = loadLegacy<{
  sample: (p: any, phase: number, w: number, h: number) => any[]
}>('orbit/motion-graphics.js')

describe('paritet: gradient', () => {
  it('stops matcher', () => {
    const p = { colorA: '#b9ff66', colorB: '#4bdac5' }
    expect(stops(p)).toEqual(legacyGradient.stops(p))
  })

  it('farge ved posisjon matcher', () => {
    const list = legacyGradient.stops({ colorA: '#b9ff66', colorB: '#4bdac5' })
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(color(list as any, t)).toBe(legacyGradient.color(list, t))
    }
  })

  it('blend matcher', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(blend('#b9ff66', '#4bdac5', t)).toBe(legacyGradient.blend('#b9ff66', '#4bdac5', t))
    }
  })

  it('paint matcher', () => {
    const list = legacyGradient.stops({ colorA: '#b9ff66', colorB: '#4bdac5' })
    for (const material of [
      { travel: false },
      { travel: true, amount: 0.4, density: 2, time: 1.2 },
    ]) {
      expect(paint(list as any, material)).toEqual(legacyGradient.paint(list, material))
    }
  })
})

describe('paritet: generativ grafikk', () => {
  const base = {
    motion: 'dotfield',
    count: 12,
    columns: 4,
    spacing: 70,
    phaseOffset: 0.12,
    lineWidth: 3,
    size: 76,
    spread: 100,
    amplitude: 100,
    centerX: 50,
    centerY: 50,
    opacity: 83,
    scale: 30,
    rotation: 35,
    speed: 1,
    colorA: '#b9ff66',
    colorB: '#4bdac5',
  }

  for (const motion of ['dotfield', 'tiles', 'fan', 'stripes', 'lozenges']) {
    it(`${motion} matcher`, () => {
      const p = { ...base, motion }
      for (const phase of [0, 0.33, 0.66]) {
        const a = sample(p as any, phase, 960, 960)
        const b = legacyMotion.sample(p, phase, 960, 960)
        expect(a.length).toBe(b.length)
        for (let i = 0; i < a.length; i++) {
          expect(a[i].x).toBeCloseTo(b[i].x, 10)
          expect(a[i].y).toBeCloseTo(b[i].y, 10)
          expect(a[i].size).toBeCloseTo(b[i].size, 10)
          expect(a[i].rotation).toBeCloseTo(b[i].rotation, 10)
          expect(a[i].sx).toBeCloseTo(b[i].sx, 10)
          expect(a[i].sy).toBeCloseTo(b[i].sy, 10)
          expect(a[i].shape).toBe(b[i].shape)
        }
      }
    })
  }
})
