import { describe, expect, it } from 'vitest'
import {
  scatter2D,
  scatter2DCount,
  scatter2DInstance,
  scatter2DPoint,
  type Scatter2DParams,
} from '../src/nodes/modifier/scatter2D'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function params(patch: Partial<Scatter2DParams> = {}): Scatter2DParams {
  return {
    pattern: 'line',
    count: 5,
    spacing: 100,
    radius: 200,
    columns: 3,
    motion: 'none',
    motionAmount: 60,
    motionCycles: 1,
    phaseOffset: 0.15,
    spin: 0,
    rotationSpread: 0,
    scaleJitter: 0,
    opacity: 1,
    ...patch,
  }
}

function context(render: RenderServices): EvalContext {
  return {
    nodeId: 'scatter',
    scopeKey: 'root/scatter',
    frame: 0,
    fps: 60,
    totalFrames: 60,
    time: 0,
    phase: 0,
    width: 200,
    height: 100,
    render,
    nodeCache: new Map(),
  }
}

describe('2D-kloner', () => {
  it('legger klonene på linje rundt midten', () => {
    const points = Array.from({ length: 5 }, (_, i) => scatter2DPoint(params(), i, 5))
    expect(points.map((p) => p.x)).toEqual([-200, -100, 0, 100, 200])
    expect(points.every((p) => p.y === 0)).toBe(true)
  })

  it('legger klonene i grid med valgt antall kolonner', () => {
    const points = Array.from({ length: 6 }, (_, i) =>
      scatter2DPoint(params({ pattern: 'grid', count: 6, columns: 3, spacing: 50 }), i, 6),
    )
    expect(points.map((p) => p.x)).toEqual([-50, 0, 50, -50, 0, 50])
    expect(points.map((p) => p.y)).toEqual([-25, -25, -25, 25, 25, 25])
  })

  it('animasjonen er loop-sikker for hele sykluser', () => {
    const start = scatter2DInstance(params({ motion: 'orbit', motionCycles: 1 }), 2, 5, 0)
    const end = scatter2DInstance(params({ motion: 'orbit', motionCycles: 1 }), 2, 5, 1)
    expect(end.x).toBeCloseTo(start.x, 6)
    expect(end.y).toBeCloseTo(start.y, 6)
  })

  it('tegner en kopi per klone', () => {
    const calls: string[] = []
    const ctx = new Proxy(
      {
        save: () => {},
        restore: () => {},
        setTransform: () => {},
        clearRect: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        drawImage: () => calls.push('drawImage'),
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
      },
      {
        get(t, key) {
          if (key in t) return t[key as keyof typeof t]
          return undefined
        },
        set(t, key, value) {
          ;(t as Record<string, unknown>)[String(key)] = value
          return true
        },
      },
    )
    const canvas = { width: 200, height: 100 } as HTMLCanvasElement
    const render = {
      ...fakeRender(200, 100),
      canvas: () => ({ canvas, ctx, width: 200, height: 100, version: 0 }),
    } as unknown as RenderServices
    scatter2D.evaluate(context(render), { in: { width: 40, height: 40 } as CanvasImageSource }, params({ count: 7 }))
    expect(calls).toHaveLength(7)
  })

  it('fordeler kloner i ring, skive og spiral uten NaN', () => {
    for (const pattern of ['ring', 'disk', 'spiral'] as const) {
      const points = Array.from({ length: 8 }, (_, i) =>
        scatter2DPoint(params({ pattern, count: 8 }), i, 8),
      )
      expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
  })

  it('begrenser antall kloner til 1–64', () => {
    expect(scatter2DCount(params({ count: 0 }))).toBe(1)
    expect(scatter2DCount(params({ count: 200 }))).toBe(64)
  })
})
