import { describe, expect, it } from 'vitest'
import { echoNode, type EchoParams } from '../src/nodes/modifier/echo'
import { registry } from '../src/nodes'
import type { CanvasTarget, EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function render() {
  const canvases = new Map<string, { canvas: { width: number; height: number; key: string }; ctx: any; calls: unknown[][] }>()
  const r = {
    ...fakeRender(32, 18),
    canvas: (key: string) => {
      let record = canvases.get(key)
      if (!record) {
        const canvas = { width: 32, height: 18, key }
        const calls: unknown[][] = []
        const ctx = {
          save: () => {},
          restore: () => {},
          setTransform: () => {},
          clearRect: () => {},
          drawImage: (...args: unknown[]) => calls.push(args),
          globalAlpha: 1,
          globalCompositeOperation: 'source-over',
        }
        record = { canvas, ctx, calls }
        canvases.set(key, record)
      }
      return { canvas: record.canvas, ctx: record.ctx, width: 32, height: 18, version: 0 }
    },
  } as unknown as RenderServices
  return { r, canvases }
}

const params: EchoParams = { count: 4, decay: 0.7, offsetX: 0, offsetY: 0 }

function context(r: RenderServices, frame: number, nodeCache: Map<string, unknown>): EvalContext {
  return {
    nodeId: 'echo', scopeKey: 'root/echo', frame, fps: 60, totalFrames: 60,
    time: frame / 60, phase: frame / 60, width: 32, height: 18, render: r, nodeCache,
  }
}

describe('Echo', () => {
  it('bygger opp historikk frame for frame', () => {
    const { r } = render()
    const cache = new Map<string, unknown>()
    const input = { image: true } as unknown as CanvasImageSource

    echoNode.evaluate(context(r, 0, cache), { in: input }, params)
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(1)

    echoNode.evaluate(context(r, 1, cache), { in: input }, params)
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(2)

    echoNode.evaluate(context(r, 2, cache), { in: input }, params)
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(3)
  })

  it('tegner historikken bak gjeldende frame', () => {
    const { r, canvases } = render()
    const cache = new Map<string, unknown>()
    const input = { image: true } as unknown as CanvasImageSource
    echoNode.evaluate(context(r, 0, cache), { in: input }, params)
    const previous = (cache.get('root/echo:echo') as CanvasTarget[])[0]
    echoNode.evaluate(context(r, 1, cache), { in: input }, params)

    const calls = canvases.get('root/echo')!.calls
    expect(calls).toContainEqual([previous.canvas, 0, 0, 32, 18])
  })

  it('begrenser historikken til antallet etterslep', () => {
    const { r } = render()
    const cache = new Map<string, unknown>()
    const input = { image: true } as unknown as CanvasImageSource
    for (let frame = 0; frame < 10; frame++) {
      echoNode.evaluate(context(r, frame, cache), { in: input }, { ...params, count: 2 })
    }
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(2)
  })

  it('nullstiller historikken på frame 0', () => {
    const { r } = render()
    const cache = new Map<string, unknown>()
    const input = { image: true } as unknown as CanvasImageSource
    echoNode.evaluate(context(r, 5, cache), { in: input }, params)
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(1)
    echoNode.evaluate(context(r, 0, cache), { in: input }, params)
    expect((cache.get('root/echo:echo') as CanvasTarget[]).length).toBe(1)
  })

  it('er registrert i paletten', () => {
    expect(registry.has('modifier.echo')).toBe(true)
    expect(registry.listed().some((def) => def.type === 'modifier.echo')).toBe(true)
  })
})
