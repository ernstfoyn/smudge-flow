import { afterEach, describe, expect, it, vi } from 'vitest'
import { patternNode, type PatternParams } from '../src/nodes/modifier/pattern'
import { registry } from '../src/nodes'
import { isParamVisible } from '../src/engine/drive'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function fakeCtx(calls: Array<{ name: string; args: unknown[] }>) {
  const props: Record<string, unknown> = {}
  return new Proxy(
    {
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      clearRect: () => {},
      fillRect: (...args: unknown[]) => calls.push({ name: 'fillRect', args }),
      beginPath: () => {},
      rect: (...args: unknown[]) => calls.push({ name: 'rect', args }),
      clip: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      drawImage: (...args: unknown[]) => calls.push({ name: 'drawImage', args }),
    },
    {
      set(_t, key, value) {
        props[String(key)] = value
        return true
      },
      get(t, key) {
        if (key in t) return t[key as keyof typeof t]
        return props[String(key)]
      },
    },
  )
}

function setup() {
  const targetCalls: Array<{ name: string; args: unknown[] }> = []
  const glyphCalls: Array<{ name: string; args: unknown[] }> = []
  const glyphs: Array<{ width: number; height: number; getContext: () => unknown }> = []
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { width: 1, height: 1, getContext: () => fakeCtx(glyphCalls) }
      glyphs.push(canvas)
      return canvas
    },
  })
  const target = { width: 160, height: 100 }
  const render = {
    ...fakeRender(160, 100),
    canvas: () => ({ canvas: target, ctx: fakeCtx(targetCalls), width: 160, height: 100, version: 0 }),
  } as unknown as RenderServices
  return { render, target, targetCalls, glyphCalls, glyphs }
}

function params(patch: Partial<PatternParams> = {}): PatternParams {
  const out: Record<string, unknown> = {}
  for (const p of patternNode.params) out[p.key] = p.default
  return { ...out, ...patch } as PatternParams
}

function context(render: RenderServices): EvalContext {
  return {
    nodeId: 'pattern', scopeKey: 'root/pattern', frame: 3, fps: 60, totalFrames: 60,
    time: 0.05, phase: 0.05, width: 160, height: 100, render, nodeCache: new Map(),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Fragmentprisme', () => {
  it('tegner rutenettet og returnerer lerretet', () => {
    const { render, target, targetCalls, glyphCalls, glyphs } = setup()
    const input = { width: 120, height: 80 } as unknown as CanvasImageSource
    const out = patternNode.evaluate(context(render), { in: input }, params()) as { out: unknown }

    expect(out.out).toBe(target)
    expect(glyphs.length).toBe(1)
    expect(glyphCalls.some((c) => c.name === 'drawImage')).toBe(true)
    expect(targetCalls.filter((c) => c.name === 'drawImage').length).toBeGreaterThan(0)
    expect(targetCalls.some((c) => c.name === 'fillRect')).toBe(true)
  })

  it('kan ha gjennomsiktig bakgrunn', () => {
    const { render, targetCalls } = setup()
    const input = { width: 120, height: 80 } as unknown as CanvasImageSource
    patternNode.evaluate(context(render), { in: input }, params({ transparent: true }))
    expect(targetCalls.some((c) => c.name === 'fillRect')).toBe(false)
  })

  it('tegner midtrad-varianten uten feil', () => {
    const { render, targetCalls } = setup()
    const input = { width: 120, height: 80 } as unknown as CanvasImageSource
    expect(() =>
      patternNode.evaluate(context(render), { in: input }, params({ mode: 'echo' })),
    ).not.toThrow()
    expect(targetCalls.filter((c) => c.name === 'drawImage').length).toBeGreaterThan(0)
  })

  it('skjuler bakgrunnsfargen når bakgrunnen er gjennomsiktig', () => {
    const background = patternNode.params.find((p) => p.key === 'background')!
    expect(isParamVisible(background, { transparent: false })).toBe(true)
    expect(isParamVisible(background, { transparent: true })).toBe(false)
    expect(isParamVisible(background, {})).toBe(true)
  })

  it('bruker bildeord i stedet for tekstord i UI-et', () => {
    expect(patternNode.params.find((p) => p.key === 'size')?.label).toBe('Bildestørrelse')
    expect(patternNode.params.find((p) => p.key === 'mode')?.label).toBe('Fordeling')
    expect(patternNode.params.find((p) => p.key === 'mode')?.options?.map((o) => o.label)).toEqual([
      'Rutenett',
      'Midtrad + diagonaler',
    ])
  })

  it('gir tomt lerret uten input', () => {
    const { render, targetCalls } = setup()
    const out = patternNode.evaluate(context(render), {}, params()) as { out: unknown }
    expect(out.out).toBeDefined()
    expect(targetCalls.some((c) => c.name === 'drawImage')).toBe(false)
  })

  it('er registrert i paletten', () => {
    expect(registry.has('modifier.pattern')).toBe(true)
    expect(registry.listed().some((def) => def.type === 'modifier.pattern')).toBe(true)
  })
})
