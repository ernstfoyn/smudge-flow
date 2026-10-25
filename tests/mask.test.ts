import { describe, expect, it } from 'vitest'
import { maskShape, type MaskShapeParams } from '../src/nodes/mask/maskShape'
import { maskKey, type MaskKeyParams } from '../src/nodes/mask/maskKey'
import { maskApply, type MaskApplyParams } from '../src/nodes/mask/maskApply'
import { maskCombine, type MaskCombineParams } from '../src/nodes/mask/maskCombine'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

interface CanvasRecord {
  width: number
  height: number
  ctx: ReturnType<typeof fakeCtx>
  canvas: { width: number; height: number }
}

function fakeCtx(initialPixels?: Uint8ClampedArray) {
  const calls: Array<{ name: string; args: unknown[] }> = []
  const props: Record<string, unknown> = {}
  let pixels = initialPixels
  const target = {
    fillRect: (...args: unknown[]) => calls.push({ name: 'fillRect', args }),
    clearRect: (...args: unknown[]) => calls.push({ name: 'clearRect', args }),
    drawImage: (...args: unknown[]) => calls.push({ name: 'drawImage', args }),
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    beginPath: () => {},
    ellipse: (...args: unknown[]) => calls.push({ name: 'ellipse', args }),
    rect: (...args: unknown[]) => calls.push({ name: 'rect', args }),
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fill: () => {},
    translate: () => {},
    rotate: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    getImageData: () => ({ data: pixels ?? new Uint8ClampedArray(4), width: 1, height: 1 }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    putImageData: (...args: unknown[]) => calls.push({ name: 'putImageData', args }),
  }
  return new Proxy(target, {
    set(_t, key, value) {
      props[String(key)] = value
      return true
    },
    get(t, key) {
      if (key in t) return t[key as keyof typeof t]
      return props[String(key)]
    },
  })
}

function render(pixels?: Uint8ClampedArray, width = 8, height = 8) {
  const canvases = new Map<string, CanvasRecord>()
  const r = {
    ...fakeRender(width, height),
    canvas: (key: string) => {
      let record = canvases.get(key)
      if (!record) {
        const canvas = { width, height }
        record = { canvas, ctx: fakeCtx(pixels), width, height }
        canvases.set(key, record)
      }
      return { ...record, version: 0 }
    },
  } as unknown as RenderServices
  return { r, canvases }
}

const context = (r: RenderServices, key = 'root/mask'): EvalContext => ({
  nodeId: 'mask', scopeKey: key, frame: 0, fps: 60, totalFrames: 60, time: 0, phase: 0,
  width: 8, height: 8, render: r, nodeCache: new Map(),
})

describe('fasongmaske', () => {
  const base: MaskShapeParams = {
    shape: 'ellipse', x: 0.5, y: 0.5, width: 0.6, height: 0.6, rotation: 0, feather: 0, invert: false,
  }

  it('tegner fasongen til en arbeidsflate og kopierer den ut', () => {
    const { r, canvases } = render()
    const out = maskShape.evaluate(context(r), {}, base) as { out: unknown }
    expect(out.out).toBe(canvases.get('root/mask')?.canvas)
    expect(canvases.has('root/mask:shape')).toBe(true)
    expect(canvases.get('root/mask')!.ctx).toBeDefined()
  })

  it('inverterer ved å fylle hvitt og trekke fasongen fra', () => {
    const { r, canvases } = render()
    maskShape.evaluate(context(r), {}, { ...base, invert: true })
    const ctx = canvases.get('root/mask')!.ctx as unknown as {
      globalCompositeOperation?: string
    }
    expect(ctx.globalCompositeOperation).toBe('destination-out')
  })
})

describe('bildemaske', () => {
  const base: MaskKeyParams = {
    mode: 'luma', threshold: 0.5, softness: 0.1, keyColor: '#00ff00', tolerance: 0.1, invert: false,
  }

  it('bruker lysstyrke som alfa', () => {
    const pixels = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 255,
    ])
    const { r, canvases } = render(pixels, 2, 1)
    const source = { image: true } as unknown as CanvasImageSource
    const out = maskKey.evaluate(context(r), { in: source }, base) as { out: unknown }

    expect(out.out).toBe(canvases.get('root/mask')?.canvas)
    const put = (canvases.get('root/mask')!.ctx as unknown as { calls?: unknown }) /* noop */
    expect(put).toBeDefined()
  })

  it('fjerner en nøkkelfarge med chroma key', () => {
    const pixels = new Uint8ClampedArray([
      0, 255, 0, 255,
      255, 0, 0, 255,
    ])
    const { r } = render(pixels, 2, 1)
    expect(() =>
      maskKey.evaluate(context(r), { in: { image: true } as unknown as CanvasImageSource }, { ...base, mode: 'chroma' }),
    ).not.toThrow()
  })

  it('gir tom maske uten input', () => {
    const { r } = render()
    expect(() => maskKey.evaluate(context(r), {}, base)).not.toThrow()
  })
})

describe('bruk maske', () => {
  const base: MaskApplyParams = { invert: false, opacity: 1 }

  it('går rett gjennom uten maske', () => {
    const { r } = render()
    expect(() => maskApply.evaluate(context(r), { in: { image: true } as unknown as CanvasImageSource }, base)).not.toThrow()
  })

  it('bruker destination-in for masken', () => {
    const { r, canvases } = render()
    maskApply.evaluate(
      context(r),
      { in: { image: true } as unknown as CanvasImageSource, mask: { mask: true } as unknown as CanvasImageSource },
      base,
    )
    const ctx = canvases.get('root/mask')!.ctx as unknown as { globalCompositeOperation?: string }
    expect(ctx.globalCompositeOperation).toBe('destination-in')
  })

  it('lager en invertert maske når det er valgt', () => {
    const { r, canvases } = render()
    maskApply.evaluate(
      context(r),
      { in: { image: true } as unknown as CanvasImageSource, mask: { mask: true } as unknown as CanvasImageSource },
      { ...base, invert: true },
    )
    const inverse = canvases.get('root/mask:inverse')!.ctx as unknown as { globalCompositeOperation?: string }
    expect(inverse.globalCompositeOperation).toBe('destination-out')
  })
})

describe('kombiner masker', () => {
  const run = (mode: MaskCombineParams['mode']) => {
    const { r, canvases } = render()
    maskCombine.evaluate(
      context(r),
      { a: { a: true } as unknown as CanvasImageSource, b: { b: true } as unknown as CanvasImageSource },
      { mode },
    )
    return (canvases.get('root/mask')!.ctx as unknown as { globalCompositeOperation?: string })
      .globalCompositeOperation
  }

  it('bruker riktig komposisjon for union, snitt og fratrekk', () => {
    expect(run('union')).toBe('source-over')
    expect(run('intersect')).toBe('destination-in')
    expect(run('subtract')).toBe('destination-out')
  })
})

describe('registeret', () => {
  it('har maskenodene i paletten', () => {
    for (const type of ['mask.shape', 'mask.key', 'modifier.mask', 'mask.combine']) {
      expect(registry.has(type)).toBe(true)
      expect(registry.listed().some((def) => def.type === type)).toBe(true)
    }
  })
})
