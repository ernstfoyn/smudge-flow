import { describe, expect, it } from 'vitest'
import { fitNode, type FitParams } from '../src/nodes/modifier/fit'
import { displaceNode, type DisplaceParams } from '../src/nodes/modifier/displace'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

interface FakeCanvas {
  width: number
  height: number
  canvas: { width: number; height: number }
  ctx: ReturnType<typeof ctxFor>
}

function ctxFor(sourcePixels?: Uint8ClampedArray, mapPixels?: Uint8ClampedArray) {
  const calls: Array<{ name: string; args: unknown[] }> = []
  const props: Record<string, unknown> = {}
  let putData: Uint8ClampedArray | null = null
  const target = {
    save: () => {},
    restore: () => {},
    setTransform: () => {},
    clearRect: () => {},
    drawImage: (...args: unknown[]) => calls.push({ name: 'drawImage', args }),
    getImageData: () => ({ data: sourcePixels ?? new Uint8ClampedArray(0), width: 0, height: 0 }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData: (image: { data: Uint8ClampedArray }) => {
      putData = image.data
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
      if (key === 'putData') return putData
      if (key === 'mapPixels') return mapPixels
      if (key in t) return t[key as keyof typeof t]
      return props[String(key)]
    },
  })
  return ctx
}

function render(width: number, height: number, sourcePixels?: Uint8ClampedArray, mapPixels?: Uint8ClampedArray) {
  const canvases = new Map<string, FakeCanvas>()
  const r = {
    ...fakeRender(width, height),
    canvas: (key: string) => {
      let record = canvases.get(key)
      if (!record) {
        const canvas = { width, height }
        const created: FakeCanvas = {
          canvas,
          ctx: ctxFor(sourcePixels, mapPixels),
          width,
          height,
        }
        record = created
        canvases.set(key, created)
      }
      return { ...record, version: 0 }
    },
  } as unknown as RenderServices
  return { r, canvases }
}

const context = (r: RenderServices): EvalContext => ({
  nodeId: 'tool', scopeKey: 'root/tool', frame: 0, fps: 60, totalFrames: 60, time: 0, phase: 0,
  width: 100, height: 100, render: r, nodeCache: new Map(),
})

describe('Beskjær / tilpass', () => {
  const base: FitParams = {
    mode: 'cover', cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1, scale: 1, offsetX: 0, offsetY: 0,
  }
  const source = { width: 200, height: 100 } as unknown as CanvasImageSource

  function draw(params: Partial<FitParams> = {}) {
    const { r, canvases } = render(100, 100)
    const out = fitNode.evaluate(context(r), { in: source }, { ...base, ...params }) as { out: unknown }
    const call = (canvases.get('root/tool')!.ctx as unknown as { calls: Array<{ name: string; args: unknown[] }> })
      .calls.find((c) => c.name === 'drawImage')
    return { out, args: call?.args ?? [] }
  }

  it('dekker hele flaten og beskjærer sidene', () => {
    const { args } = draw({ mode: 'cover' })
    expect(args).toEqual([source, 0, 0, 200, 100, -50, 0, 200, 100])
  })

  it('passer inn med gjennomsiktig kant', () => {
    const { args } = draw({ mode: 'contain' })
    expect(args).toEqual([source, 0, 0, 200, 100, 0, 25, 100, 50])
  })

  it('strekker til hele flaten', () => {
    const { args } = draw({ mode: 'stretch' })
    expect(args).toEqual([source, 0, 0, 200, 100, 0, 0, 100, 100])
  })

  it('bruker utsnitt, skala og forskyvning', () => {
    const { args } = draw({ mode: 'cover', cropX: 0.25, cropWidth: 0.5, scale: 0.5, offsetX: 0.1 })
    expect(args[1]).toBe(50)
    expect(args[3]).toBe(100)
    expect(args[5]).toBe(35)
    expect(args[7]).toBe(50)
  })

  it('gir tomt lerret uten input', () => {
    const { r } = render(100, 100)
    expect(() => fitNode.evaluate(context(r), {}, base)).not.toThrow()
  })
})

describe('Displace', () => {
  const base: DisplaceParams = { amount: 0.25, angle: 0, invert: false }
  const input = { image: true } as unknown as CanvasImageSource
  const map = { map: true } as unknown as CanvasImageSource

  it('går rett gjennom uten kart', () => {
    const { r, canvases } = render(4, 1)
    displaceNode.evaluate(context(r), { in: input }, base)
    const calls = (canvases.get('root/tool')!.ctx as unknown as { calls: Array<{ name: string; args: unknown[] }> }).calls
    expect(calls.some((c) => c.name === 'drawImage')).toBe(true)
    expect(calls.some((c) => c.name === 'putImageData')).toBe(false)
  })

  it('forskyver piksler med rød og grønn kanal', () => {
    const source = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ])
    // Rød = 255 gir +1 px i X for første piksel. Resten er nøytralt (128).
    const mapPixels = new Uint8ClampedArray([
      255, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255,
    ])
    const { r, canvases } = render(4, 1, source, mapPixels)
    displaceNode.evaluate(context(r), { in: input, map }, base)
    const data = (canvases.get('root/tool')!.ctx as unknown as { putData: Uint8ClampedArray }).putData
    expect([...data.slice(0, 4)]).toEqual([0, 255, 0, 255])
  })

  it('inverterer kartet når det er valgt', () => {
    const source = new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ])
    const mapPixels = new Uint8ClampedArray([
      255, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255,
    ])
    const { r, canvases } = render(4, 1, source, mapPixels)
    displaceNode.evaluate(context(r), { in: input, map }, { ...base, invert: true })
    const data = (canvases.get('root/tool')!.ctx as unknown as { putData: Uint8ClampedArray }).putData
    expect([...data.slice(0, 4)]).toEqual([255, 0, 0, 255])
  })
})

describe('registeret', () => {
  it('har de nye bildenodene', () => {
    for (const type of ['modifier.fit', 'modifier.displace']) {
      expect(registry.has(type)).toBe(true)
      expect(registry.listed().some((def) => def.type === type)).toBe(true)
    }
  })
})
