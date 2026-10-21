import { describe, expect, it } from 'vitest'
import {
  evaluateTracks,
  neighbourKey,
  removeKey,
  upsertKey,
  valueAt,
} from '../src/engine/animation/keyframes'
import { applyLfo, wave } from '../src/engine/animation/lfo'

describe('keyframes', () => {
  it('returnerer grunnverdien når det ikke finnes spor', () => {
    expect(valueAt(5, [], 10)).toBe(5)
  })

  it('klamper til første og siste keyframe', () => {
    const keys = upsertKey([], 10, 0)
    const withEnd = upsertKey(keys, 20, 100)
    expect(valueAt(0, withEnd, 0)).toBe(0)
    expect(valueAt(0, withEnd, 99)).toBe(100)
  })

  it('interpolerer lineært', () => {
    const keys = upsertKey(upsertKey([], 0, 0), 10, 100)
    expect(valueAt(0, keys, 5)).toBe(50)
  })

  it('støtter hold', () => {
    const keys = upsertKey(upsertKey([], 0, 0, 'hold'), 10, 100)
    expect(valueAt(0, keys, 5)).toBe(0)
    expect(valueAt(0, keys, 10)).toBe(100)
  })

  it('blander hex-farger', () => {
    const keys = upsertKey(upsertKey([], 0, '#000000'), 10, '#ffffff')
    expect(valueAt('#000000', keys, 5)).toBe('#808080')
  })

  it('hopper over diskrete verdier', () => {
    const keys = upsertKey(upsertKey([], 0, 'a'), 10, 'b')
    expect(valueAt('a', keys, 5)).toBe('a')
    expect(valueAt('a', keys, 10)).toBe('b')
  })

  it('sorterer nøkler og erstatter eksisterende frame', () => {
    let keys = upsertKey([], 10, 1)
    keys = upsertKey(keys, 5, 2)
    keys = upsertKey(keys, 10, 9)
    expect(keys.map((k) => k.frame)).toEqual([5, 10])
    expect(keys[1].value).toBe(9)
  })

  it('fjerner nøkler', () => {
    const keys = upsertKey(upsertKey([], 0, 1), 10, 2)
    expect(removeKey(keys, 0)).toHaveLength(1)
  })

  it('finner nabo-nøkler', () => {
    const keys = upsertKey(upsertKey([], 0, 1), 10, 2)
    expect(neighbourKey(keys, 5, -1)?.frame).toBe(0)
    expect(neighbourKey(keys, 5, 1)?.frame).toBe(10)
  })

  it('evaluerer spor inn i params', () => {
    const params = { size: 10, nested: { value: 1 } }
    const tracks = {
      size: upsertKey(upsertKey([], 0, 0), 10, 100),
      'nested.value': upsertKey(upsertKey([], 0, 0), 10, 5),
    }
    const out = evaluateTracks(params, tracks, 5)
    expect(out.size).toBe(50)
    expect((out.nested as { value: number }).value).toBe(2.5)
    // Originalen skal ikke muteres.
    expect(params.size).toBe(10)
  })
})

describe('lfo', () => {
  it('er deterministisk', () => {
    const cfg = { on: true, amount: 0.5, cycles: 1, shape: 'sine' as const, phase: 0 }
    expect(applyLfo(0, cfg, [0, 10], false, 0.25)).toBe(applyLfo(0, cfg, [0, 10], false, 0.25))
  })

  it('ligger innenfor parameterens range', () => {
    const cfg = { on: true, amount: 1, cycles: 3, shape: 'sine' as const, phase: 0 }
    for (let p = 0; p < 1; p += 0.01) {
      const v = applyLfo(5, cfg, [0, 10], false, p)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(10)
    }
  })

  it('lukker seg eksakt over én loop', () => {
    const cfg = { on: true, amount: 1, cycles: 1, shape: 'sine' as const, phase: 0 }
    expect(applyLfo(0, cfg, [0, 10], false, 0)).toBeCloseTo(applyLfo(0, cfg, [0, 10], false, 1), 10)
  })

  it('rundner heltallsparametere', () => {
    const cfg = { on: true, amount: 1, cycles: 1, shape: 'sine' as const, phase: 0 }
    expect(Number.isInteger(applyLfo(5, cfg, [0, 10], true, 0.13))).toBe(true)
  })

  it('er av når den er slått av', () => {
    const cfg = { on: false, amount: 1, cycles: 1, shape: 'sine' as const, phase: 0 }
    expect(applyLfo(5, cfg, [0, 10], false, 0.5)).toBe(5)
  })

  it('gir verdier i -1..1', () => {
    for (const shape of ['sine', 'triangle', 'saw', 'square', 'random'] as const) {
      for (let t = 0; t < 2; t += 0.05) {
        const v = wave(shape, t)
        expect(v).toBeGreaterThanOrEqual(-1.000001)
        expect(v).toBeLessThanOrEqual(1.000001)
      }
    }
  })
})
