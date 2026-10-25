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

describe('keyframe-easing', () => {
  const keysWith = (easing: Parameters<typeof upsertKey>[3]) =>
    upsertKey(upsertKey([], 0, 0, easing), 10, 100)

  it('myk start og slutt treffer endepunktene', () => {
    const keys = keysWith('ease-in-out')
    expect(valueAt(0, keys, 0)).toBe(0)
    expect(valueAt(0, keys, 5)).toBe(50)
    expect(valueAt(0, keys, 10)).toBe(100)
    expect(valueAt(0, keys, 2.5)).toBeLessThan(25)
    expect(valueAt(0, keys, 7.5)).toBeGreaterThan(75)
  })

  it('myk start og myk slutt er ikke lineære', () => {
    expect(valueAt(0, keysWith('ease-in'), 5)).toBeLessThan(50)
    expect(valueAt(0, keysWith('ease-out'), 5)).toBeGreaterThan(50)
  })

  it('sprett og elastisk treffer målverdien til slutt', () => {
    expect(valueAt(0, keysWith('bounce'), 10)).toBe(100)
    expect(valueAt(0, keysWith('elastic'), 10)).toBe(100)
    expect(valueAt(0, keysWith('bounce'), 5)).not.toBe(50)
  })

  it('beholder overgangen når verdien på samme frame oppdateres', () => {
    let keys = keysWith('ease-in')
    keys = upsertKey(keys, 0, 10)
    expect(keys[0].interpolation).toBe('ease-in')
  })

  it('klemmer fargekanaler selv når en elastisk kurve overdriver', () => {
    const keys = upsertKey(upsertKey([], 0, '#000000', 'elastic'), 10, '#ffffff')
    for (let frame = 0; frame <= 10; frame += 0.25) {
      const value = String(valueAt('#000000', keys, frame))
      expect(value).toMatch(/^#[0-9a-f]{6}$/i)
      for (const i of [1, 3, 5]) {
        const channel = parseInt(value.slice(i, i + 2), 16)
        expect(channel).toBeGreaterThanOrEqual(0)
        expect(channel).toBeLessThanOrEqual(255)
      }
    }
  })

  it('lagrer valgt overgang i butikken', async () => {
    const { useGraphStore } = await import('../src/state/useGraphStore')
    useGraphStore.getState().reset()
    const id = useGraphStore.getState().addNode('source.gradient', { x: 0, y: 0 })!
    useGraphStore.getState().setKeyframe(id, 'angle', 0, 0)
    useGraphStore.getState().setKeyframe(id, 'angle', 10, 360)
    useGraphStore.getState().setKeyframeEasing(id, 'angle', 0, 'bounce')
    const keys = useGraphStore.getState().graph.nodes.find((n) => n.id === id)?.tracks?.angle
    expect(keys?.[0].interpolation).toBe('bounce')
    expect(keys?.[1].interpolation).toBe('linear')
  })
})
