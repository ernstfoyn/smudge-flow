import { describe, expect, it } from 'vitest'
import { color, stops, type GradientStop } from '../src/engine/color/gradient'
import { gradientPaint } from '../src/render/raster/gradientFill'
import { gradientSource } from '../src/nodes/source/gradientSource'
import { gradientMap, type GradientMapParams } from '../src/nodes/modifier/gradientMap'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

const three: GradientStop[] = [
  { id: 'a', position: 1, color: '#0000ff', softness: 1 },
  { id: 'b', position: 0, color: '#ff0000', softness: 1 },
  { id: 'c', position: 0.5, color: '#00ff00', softness: 1 },
]

function fakeCtx(pixels?: Uint8ClampedArray) {
  const calls: Array<{ name: string; args: unknown[] }> = []
  const props: Record<string, unknown> = {}
  let put: Uint8ClampedArray | null = null
  const gradient = {
    addColorStop: (position: number, color: string) =>
      calls.push({ name: 'addColorStop', args: [position, color] }),
  }
  const target = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    drawImage: (...args: unknown[]) => calls.push({ name: 'drawImage', args }),
    fillRect: (...args: unknown[]) => calls.push({ name: 'fillRect', args }),
    translate: (...args: unknown[]) => calls.push({ name: 'translate', args }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    getImageData: () => ({ data: pixels ?? new Uint8ClampedArray(0), width: 0, height: 0 }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      put = image.data
      calls.push({ name: 'putImageData', args: [image] })
    },
  }
  const ctx = new Proxy(target, {
    set(_t, key, value) {
      props[String(key)] = value
      return true
    },
    get(t, key) {
      if (key === 'calls') return calls
      if (key === 'put') return put
      if (key in t) return t[key as keyof typeof t]
      return props[String(key)]
    },
  })
  return { ctx, calls, props, put: () => put }
}

function render(width = 100, height = 100, pixels?: Uint8ClampedArray) {
  const canvases = new Map<string, { canvas: { width: number; height: number }; ctx: ReturnType<typeof fakeCtx>['ctx']; put: () => Uint8ClampedArray | null; width: number; height: number }>()
  const r = {
    ...fakeRender(width, height),
    canvas: (key: string) => {
      let record = canvases.get(key)
      if (!record) {
        const made = fakeCtx(pixels)
        record = {
          canvas: { width, height },
          ctx: made.ctx,
          put: made.put,
          width,
          height,
        }
        canvases.set(key, record)
      }
      return { ...record, version: 0 }
    },
  } as unknown as RenderServices
  return { r, canvases }
}

const context = (r: RenderServices): EvalContext => ({
  nodeId: 'n', scopeKey: 'root/n', frame: 0, fps: 60, totalFrames: 60,
  time: 0, phase: 0, width: 100, height: 100, render: r, nodeCache: new Map(),
})

describe('flerfarge-gradient', () => {
  it('sorterer og klemmer fargestopp', () => {
    const list = stops({ colorA: '#000000', colorB: '#ffffff', gradient: { stops: three } })
    expect(list.map((s) => s.position)).toEqual([0, 0.5, 1])
    expect(list.map((s) => s.color)).toEqual(['#ff0000', '#00ff00', '#0000ff'])
  })

  it('interpolerer gjennom flere farger', () => {
    const list = stops({ colorA: '#000000', colorB: '#ffffff', gradient: { stops: three } })
    expect(color(list, 0)).toBe('#ff0000')
    expect(color(list, 0.5)).toBe('#00ff00')
    expect(color(list, 1)).toBe('#0000ff')
    expect(color(list, 0.25)).not.toBe('#ff0000')
  })

  it('legger alle fargestoppene på Canvas-gradienten', () => {
    const { ctx, calls } = fakeCtx()
    gradientPaint(ctx as unknown as CanvasRenderingContext2D, 100, {
      fill: 'linear', colorA: '#000000', colorB: '#ffffff', stops: three,
      angle: 0, travel: 0, density: 1,
    }, 0)
    expect(calls.filter((c) => c.name === 'addColorStop').length).toBeGreaterThan(2)
  })

  it('gradientkilden bruker stops når de finnes', () => {
    const { r, canvases } = render()
    gradientSource.evaluate(context(r), {}, {
      fill: 'linear', colorA: '#000000', colorB: '#ffffff', stops: three,
      angle: 45, travel: 0, density: 1,
    } as never)
    const calls = (canvases.get('root/n')!.ctx as unknown as { calls: Array<{ name: string }> }).calls
    expect(calls.filter((c) => c.name === 'addColorStop').length).toBeGreaterThan(2)
  })
})

describe('Gradient map', () => {
  const base: GradientMapParams = {
    mode: 'alpha',
    stops: [
      { position: 0, color: '#ff0000', softness: 1 },
      { position: 1, color: '#0000ff', softness: 1 },
    ],
    angle: 0, travel: 0, density: 1, opacity: 1, invert: false,
  }

  it('fyller formen med source-in', () => {
    const { r, canvases } = render()
    const input = { image: true } as unknown as CanvasImageSource
    gradientMap.evaluate(context(r), { in: input }, base)
    const ctx = canvases.get('root/n')!.ctx as unknown as {
      globalCompositeOperation?: string
      calls: Array<{ name: string }>
    }
    expect(ctx.globalCompositeOperation).toBe('source-in')
    expect(ctx.calls.some((c) => c.name === 'addColorStop')).toBe(true)
  })

  it('mapper lysstyrke gjennom gradienten', () => {
    // To piksler: svart og hvit.
    const pixels = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255])
    const { r, canvases } = render(2, 1, pixels)
    const input = { image: true } as unknown as CanvasImageSource
    gradientMap.evaluate(context(r), { in: input }, { ...base, mode: 'luminance' })
    const data = canvases.get('root/n')!.put()!
    expect([...data.slice(0, 3)]).toEqual([255, 0, 0])
    expect([...data.slice(4, 7)]).toEqual([0, 0, 255])
  })

  it('er registrert i paletten', () => {
    expect(registry.has('modifier.gradientMap')).toBe(true)
    expect(registry.listed().some((def) => def.type === 'modifier.gradientMap')).toBe(true)
  })
})
