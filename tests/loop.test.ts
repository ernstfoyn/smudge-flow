import { describe, expect, it } from 'vitest'
import { loopSource } from '../src/nodes/source/loopSource'
import type { EvalContext } from '../src/engine/types'

function context(phase: number, frame: number): EvalContext {
  return {
    nodeId: 'loop',
    scopeKey: 'root/loop',
    frame,
    fps: 60,
    totalFrames: 60,
    time: frame / 60,
    phase,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: new Map(),
  }
}

const baseParams = {
  algorithm: 'sine' as const,
  cycles: 1,
  amplitude: 1,
  offset: 0,
  min: 0,
  max: 1,
  window: 'pingpong' as const,
  detail: 6,
  seed: 1,
}

/**
 * Løkkesikkerhet: verdien ved frame 0 må være lik verdien ved frame N,
 * ellers hopper animasjonen når loopen lukkes.
 */
describe('loop-generator', () => {
  it('lukker seg eksakt med pingpong-vindu', () => {
    for (const algorithm of ['sine', 'triangle', 'saw', 'square', 'noise'] as const) {
      const params = { ...baseParams, algorithm }
      const first = loopSource.evaluate(context(0, 0), {}, params) as { value: number }
      const last = loopSource.evaluate(context(1, 60), {}, params) as { value: number }
      expect(last.value).toBeCloseTo(first.value, 6)
    }
  })

  it('lukker seg eksakt med cosine-vindu', () => {
    for (const algorithm of ['sine', 'triangle', 'saw', 'square', 'noise'] as const) {
      const params = { ...baseParams, algorithm, window: 'cosine' as const }
      const first = loopSource.evaluate(context(0, 0), {}, params) as { value: number }
      const last = loopSource.evaluate(context(1, 60), {}, params) as { value: number }
      expect(last.value).toBeCloseTo(first.value, 6)
    }
  })

  it('er deterministisk for samme frame', () => {
    const a = loopSource.evaluate(context(0.25, 15), {}, baseParams) as { value: number }
    const b = loopSource.evaluate(context(0.25, 15), {}, baseParams) as { value: number }
    expect(a.value).toBe(b.value)
  })

  it('holder seg innenfor [min, max]', () => {
    const params = { ...baseParams, min: 10, max: 20, amplitude: 1 }
    for (let p = 0; p < 1; p += 0.05) {
      const out = loopSource.evaluate(context(p, 0), {}, params) as { value: number }
      expect(out.value).toBeGreaterThanOrEqual(10)
      expect(out.value).toBeLessThanOrEqual(20)
    }
  })

  it('samme frø gir samme støy, ulikt frø gir ulik støy', () => {
    const a = loopSource.evaluate(context(0.3, 18), {}, { ...baseParams, algorithm: 'noise' }) as {
      value: number
    }
    const b = loopSource.evaluate(context(0.3, 18), {}, { ...baseParams, algorithm: 'noise' }) as {
      value: number
    }
    const c = loopSource.evaluate(context(0.3, 18), {}, {
      ...baseParams,
      algorithm: 'noise',
      seed: 7,
    }) as { value: number }
    expect(a.value).toBe(b.value)
    expect(a.value).not.toBe(c.value)
  })

  it('fase går fra 0 til 1', () => {
    const first = loopSource.evaluate(context(0, 0), {}, baseParams) as { phase: number }
    const last = loopSource.evaluate(context(0.99, 59), {}, baseParams) as { phase: number }
    expect(first.phase).toBe(0)
    expect(last.phase).toBeCloseTo(0.99, 5)
  })
})
