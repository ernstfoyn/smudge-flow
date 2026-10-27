import { describe, expect, it } from 'vitest'
import { text2D } from '../src/nodes/source/text2D'
import { shape2D } from '../src/nodes/source/shape2D'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function recordingRender(width = 200, height = 100) {
  const calls: Array<{ name: string; args: unknown[] }> = []
  const props: Record<string, unknown> = {}
  const ctx = new Proxy(
    {
      fillText: (...args: unknown[]) => calls.push({ name: 'fillText', args }),
      beginPath: () => calls.push({ name: 'beginPath', args: [] }),
      ellipse: (...args: unknown[]) => calls.push({ name: 'ellipse', args }),
      rect: (...args: unknown[]) => calls.push({ name: 'rect', args }),
      moveTo: (...args: unknown[]) => calls.push({ name: 'moveTo', args }),
      lineTo: (...args: unknown[]) => calls.push({ name: 'lineTo', args }),
      closePath: () => calls.push({ name: 'closePath', args: [] }),
      fill: () => calls.push({ name: 'fill', args: [] }),
      stroke: () => calls.push({ name: 'stroke', args: [] }),
      translate: (...args: unknown[]) => calls.push({ name: 'translate', args }),
      rotate: (...args: unknown[]) => calls.push({ name: 'rotate', args }),
      createLinearGradient: (...args: unknown[]) => {
        calls.push({ name: 'createLinearGradient', args })
        return {
          addColorStop: (...stop: unknown[]) => calls.push({ name: 'addColorStop', args: stop }),
        }
      },
      measureText: (text: string) => {
        calls.push({ name: 'measureText', args: [text] })
        return { width: text.length * 10 }
      },
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      clearRect: () => {},
    },
    {
      set(_target, key, value) {
        props[String(key)] = value
        return true
      },
      get(target, key) {
        if (key in target) return target[key as keyof typeof target]
        return props[String(key)]
      },
    },
  )
  const canvas = { width, height } as HTMLCanvasElement
  const render = {
    ...fakeRender(width, height),
    canvas: () => ({ canvas, ctx, width, height, version: 0 }),
  } as unknown as RenderServices
  return { render, calls, props, canvas }
}

const ctx = (render: RenderServices): EvalContext => ({
  nodeId: 'n',
  scopeKey: 'root/n',
  frame: 0,
  fps: 60,
  totalFrames: 60,
  time: 0,
  phase: 0,
  width: 200,
  height: 100,
  render,
  nodeCache: new Map(),
})

describe('2D-tekst', () => {
  const params = {
    text: 'Hei\ndu',
    size: 20,
    scale: 1,
    font: 'ui-sans-serif',
    weight: '700',
    color: '#ff0000',
    align: 'center' as const,
    x: 0.5,
    y: 0.5,
    lineHeight: 1.2,
    opacity: 1,
  }

  it('tegner hver linje og returnerer lerretet', () => {
    const { render, calls, props, canvas } = recordingRender()
    const out = text2D.evaluate(ctx(render), {}, params) as { out: unknown }

    expect(out.out).toBe(canvas)
    expect(calls.filter((c) => c.name === 'fillText')).toHaveLength(2)
    expect(calls.find((c) => c.name === 'fillText')?.args[0]).toBe('Hei')
    expect(props.font).toBe('700 20px ui-sans-serif')
    expect(props.fillStyle).toBe('#ff0000')
    expect(props.textAlign).toBe('center')
  })

  it('skalerer tekststørrelsen med Universell skala', () => {
    const { render, props } = recordingRender()
    text2D.evaluate(ctx(render), {}, { ...params, scale: 2 })
    expect(props.font).toBe('700 40px ui-sans-serif')
  })

  it('påvirker bare sitt eget lerret', () => {
    const a = recordingRender()
    const b = recordingRender()
    text2D.evaluate(ctx(a.render), {}, params)
    expect(a.calls.length).toBeGreaterThan(0)
    expect(b.calls).toHaveLength(0)
  })

  it('kan fylle teksten med en flerfarge-gradient', () => {
    const { render, calls, props } = recordingRender()
    text2D.evaluate(ctx(render), {}, {
      ...params,
      gradient: true,
      gradientAngle: 0,
      stops: [
        { position: 0, color: '#ff0000', softness: 1 },
        { position: 0.5, color: '#00ff00', softness: 1 },
        { position: 1, color: '#0000ff', softness: 1 },
      ],
    })
    expect(calls.some((c) => c.name === 'createLinearGradient')).toBe(true)
    expect(calls.filter((c) => c.name === 'addColorStop').length).toBeGreaterThan(2)
    expect(typeof props.fillStyle).toBe('object')
  })
})

describe('2D-fasong', () => {
  const base = {
    shape: 'ellipse' as const,
    width: 0.5,
    height: 0.4,
    scale: 1,
    x: 0.5,
    y: 0.5,
    rotation: 45,
    sides: 6,
    innerRadius: 0.45,
    fill: '#00ff00',
    stroke: '#000000',
    strokeWidth: 3,
    opacity: 1,
  }

  it('tegner ellipse med fyll og kant', () => {
    const { render, calls, props, canvas } = recordingRender()
    const out = shape2D.evaluate(ctx(render), {}, base) as { out: unknown }

    expect(out.out).toBe(canvas)
    expect(calls.some((c) => c.name === 'ellipse')).toBe(true)
    expect(calls.some((c) => c.name === 'fill')).toBe(true)
    expect(calls.some((c) => c.name === 'stroke')).toBe(true)
    expect(calls.find((c) => c.name === 'translate')?.args).toEqual([100, 50])
    expect(calls.find((c) => c.name === 'rotate')?.args[0]).toBeCloseTo(Math.PI / 4, 9)
    expect(props.fillStyle).toBe('#00ff00')
    expect(props.lineWidth).toBe(3)
  })

  it('kan fylle fasongen med en flerfarge-gradient', () => {
    const { render, calls, props } = recordingRender()
    shape2D.evaluate(ctx(render), {}, {
      ...base,
      gradient: true,
      gradientAngle: 45,
      stops: [
        { position: 0, color: '#ff0000', softness: 1 },
        { position: 1, color: '#0000ff', softness: 1 },
      ],
    })
    expect(calls.some((c) => c.name === 'createLinearGradient')).toBe(true)
    expect(calls.filter((c) => c.name === 'addColorStop').length).toBeGreaterThan(1)
    expect(typeof props.fillStyle).toBe('object')
  })

  it('tegner alle fasongene uten feil', () => {
    for (const shape of ['rectangle', 'ellipse', 'triangle', 'diamond', 'star', 'polygon'] as const) {
      const { render, calls } = recordingRender()
      expect(() => shape2D.evaluate(ctx(render), {}, { ...base, shape })).not.toThrow()
      expect(calls.some((c) => c.name === 'fill')).toBe(true)
    }
  })

  it('skalerer bredde og høyde samlet', () => {
    const { render, calls } = recordingRender()
    shape2D.evaluate(ctx(render), {}, { ...base, scale: 2 })
    const ellipse = calls.find((c) => c.name === 'ellipse')
    expect(ellipse?.args.slice(2, 4)).toEqual([100, 40])
  })

  it('hopper over kanten når bredden er 0', () => {
    const { render, calls } = recordingRender()
    shape2D.evaluate(ctx(render), {}, { ...base, strokeWidth: 0 })
    expect(calls.some((c) => c.name === 'stroke')).toBe(false)
  })
})

describe('registeret', () => {
  it('har 2D-tekst og 2D-fasong i paletten', () => {
    for (const type of ['source.text2D', 'source.shape2D']) {
      expect(registry.has(type)).toBe(true)
      expect(registry.listed().some((def) => def.type === type)).toBe(true)
    }
  })
})
