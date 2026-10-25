import { describe, expect, it } from 'vitest'
import { trail, type TrailStamp } from '../src/nodes/modifier/trail'
import type { EvalContext, RenderServices } from '../src/engine/types'

/** Canvas-lignende mock som teller tegnekall. */
function mockTarget(calls: { draw: number }) {
  const ctx = {
    calls,
    save() {}, restore() {}, setTransform() {}, translate() {}, rotate() {},
    clearRect() {}, fillRect() {}, drawImage() { calls.draw++ },
    beginPath() {}, arc() {}, fill() {}, rect() {}, moveTo() {}, lineTo() {}, closePath() {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4), width: w, height: h,
    }),
    putImageData() {},
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
  }
  return {
    canvas: { width: 100, height: 100, getContext: () => ctx } as unknown as HTMLCanvasElement,
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width: 100,
    height: 100,
    version: 0,
  }
}

function fakeRender(calls: { draw: number }): RenderServices {
  return {
    width: 100,
    height: 100,
    canvas: () => mockTarget(calls),
    touch: () => {},
    versionOf: () => 0,
    post: async () => {
      throw new Error('Ikke støttet i test')
    },
    assets: {
      resolveAsset: async () => {
        throw new Error('Ikke støttet i test')
      },
      audio: async () => {
        throw new Error('Ikke støttet i test')
      },
      image: async () => {
        throw new Error('Ikke støttet i test')
      },
      videoFrame: async () => {
        throw new Error('Ikke støttet i test')
      },
    },
    dispose: () => {},
  }
}

function context(): EvalContext {
  return {
    nodeId: 'trail-1',
    scopeKey: 'root/trail-1',
    frame: 0,
    fps: 60,
    totalFrames: 60,
    time: 0,
    phase: 0,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: new Map(),
  }
}

const media = { width: 50, height: 50 } as unknown as CanvasImageSource

const baseParams = {
  brush: 0.28,
  spacing: 0.2,
  opacity: 1,
  rotateStrokes: false,
  strokeCount: 0,
  stamps: [] as TrailStamp[],
  background: '#05050a',
}

describe('trail-laget', () => {
  it('tegner basismediet når det ikke finnes stempler', () => {
    const calls = { draw: 0 }
    const ctx = context()
    ctx.render = fakeRender(calls)

    trail.evaluate(ctx, { in: media }, baseParams)

    // Ett kall for basismediet, ingen for stempler.
    expect(calls.draw).toBe(1)
  })

  it('tegner ett stempel per stempel i lista', () => {
    const calls = { draw: 0 }
    const ctx = context()
    ctx.render = fakeRender(calls)

    const stamps: TrailStamp[] = [
      { u: 0.2, v: 0.2, rotation: 0 },
      { u: 0.5, v: 0.5, rotation: 0 },
      { u: 0.8, v: 0.8, rotation: 0 },
    ]

    trail.evaluate(ctx, { in: media }, { ...baseParams, stamps })

    // Basis + tre stempler.
    expect(calls.draw).toBe(4)
  })

  it('er deterministisk: samme stempler gir samme antall tegnekall', () => {
    const stamps: TrailStamp[] = [{ u: 0.3, v: 0.7, rotation: 0.4 }]

    const a = { draw: 0 }
    const b = { draw: 0 }
    const ctxA = context()
    ctxA.render = fakeRender(a)
    const ctxB = context()
    ctxB.render = fakeRender(b)

    trail.evaluate(ctxA, { in: media }, { ...baseParams, stamps })
    trail.evaluate(ctxB, { in: media }, { ...baseParams, stamps })

    expect(a.draw).toBe(b.draw)
  })

  it('uten innhold gir et tomt lerret', () => {
    const calls = { draw: 0 }
    const ctx = context()
    ctx.render = fakeRender(calls)

    const out = trail.evaluate(ctx, { in: undefined }, baseParams) as Record<string, unknown>

    expect(calls.draw).toBe(0)
    expect(out.out).toBeDefined()
  })

  it('stemplene ligger i params, slik at de lagres i grafen', () => {
    // Stemplene er data i noden, ikke et eget lerret med tilstand.
    const node = {
      id: 'trail-1',
      type: 'modifier.trail',
      title: 'Trail',
      params: { ...baseParams, stamps: [{ u: 0.1, v: 0.2, rotation: 0 }] },
      tracks: {},
      lfo: {},
      position: { x: 0, y: 0 },
    }
    // Må overleve JSON-serialisering (lagring og eksport av prosjektet).
    const roundTrip = JSON.parse(JSON.stringify(node))
    expect(roundTrip.params.stamps).toHaveLength(1)
    expect(roundTrip.params.stamps[0].u).toBe(0.1)
  })
})
