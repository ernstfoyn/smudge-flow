import { describe, expect, it } from 'vitest'
import { loadLegacy } from './loadLegacy'
import { valueAt } from '../../src/engine/animation/keyframes'

/**
 * Paritet: den nye keyframe-implementasjonen skal gi IDENTISKE svar som
 * den gamle Orbit-koden (public/orbit/animation.js).
 */
const legacy = loadLegacy<{
  valueAt: (base: unknown, keys: any[], frame: number) => unknown
  mix: (a: unknown, b: unknown, t: number) => unknown
}>('orbit/animation.js')

const keys = [
  { frame: 0, value: 0, interpolation: 'linear' as const },
  { frame: 10, value: 100, interpolation: 'linear' as const },
  { frame: 20, value: 0, interpolation: 'linear' as const },
]

const colorKeys = [
  { frame: 0, value: '#000000', interpolation: 'linear' as const },
  { frame: 10, value: '#ffffff', interpolation: 'linear' as const },
]

const holdKeys = [
  { frame: 0, value: 'a', interpolation: 'hold' as const },
  { frame: 10, value: 'b', interpolation: 'hold' as const },
]

describe('paritet: keyframes', () => {
  it('samme interpolasjon ved alle frames', () => {
    for (let frame = -5; frame <= 25; frame++) {
      expect(valueAt(0, keys, frame)).toBe(legacy.valueAt(0, keys, frame))
    }
  })

  it('samme fargeblanding', () => {
    for (let frame = 0; frame <= 10; frame++) {
      expect(valueAt('#000000', colorKeys, frame)).toBe(legacy.valueAt('#000000', colorKeys, frame))
    }
  })

  it('samme hold-oppførsel', () => {
    for (let frame = 0; frame <= 10; frame++) {
      expect(valueAt('a', holdKeys, frame)).toBe(legacy.valueAt('a', holdKeys, frame))
    }
  })

  it('samme blanding av diskrete typer', () => {
    expect(legacy.mix('a', 'b', 0.5)).toBe('a')
    expect(legacy.mix(10, 20, 0.25)).toBe(12.5)
  })

  it('tomme spor gir grunnverdien', () => {
    expect(valueAt(42, [], 3)).toBe(legacy.valueAt(42, [], 3))
  })
})
