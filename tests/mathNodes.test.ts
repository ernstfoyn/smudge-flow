import { describe, expect, it } from 'vitest'
import { imageSwitchNode } from '../src/nodes/composite/imageSwitch'
import { mathNode, remapNode, valueSwitchNode } from '../src/nodes/curve/mathNodes'
import { registry } from '../src/nodes'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

const ctx = {} as EvalContext

function math(operation: string, a: unknown, b: unknown, params: Record<string, unknown> = {}) {
  return (mathNode.evaluate(ctx, { a, b }, {
    operation,
    a: 0,
    b: 1,
    ...params,
  }) as { out: number }).out
}

describe('Matematikk', () => {
  it('regner på innganger og faste verdier', () => {
    expect(math('add', 2, 3)).toBe(5)
    expect(math('subtract', 2, 3)).toBe(-1)
    expect(math('multiply', 2, 3)).toBe(6)
    expect(math('divide', 6, 3)).toBe(2)
    expect(math('min', 2, 3)).toBe(2)
    expect(math('max', 2, 3)).toBe(3)
    expect(math('power', 2, 3)).toBe(8)
    expect(math('modulo', 7, 3)).toBe(1)
  })

  it('bruker faste verdier når inngangene ikke er koblet til', () => {
    expect(math('add', undefined, undefined, { a: 10, b: 5 })).toBe(15)
  })

  it('lar en tilkoblet inngang overstyre den faste verdien', () => {
    expect(math('add', 7, undefined, { a: 100, b: 5 })).toBe(12)
  })

  it('håndterer unære operasjoner og deling på null', () => {
    expect(math('abs', -4, 0)).toBe(4)
    expect(math('floor', 4.9, 0)).toBe(4)
    expect(math('ceil', 4.1, 0)).toBe(5)
    expect(math('round', 4.6, 0)).toBe(5)
    expect(math('sign', -4, 0)).toBe(-1)
    expect(math('divide', 4, 0)).toBe(0)
    expect(math('modulo', 4, 0)).toBe(0)
  })

  it('gir 0 i stedet for uendelig', () => {
    expect(math('power', -1, 0.5)).toBe(0)
  })
})

describe('Remap', () => {
  const run = (input: number | undefined, params: Record<string, unknown> = {}) =>
    (remapNode.evaluate(ctx, { in: input }, {
      value: 0,
      fromMin: -1,
      fromMax: 1,
      toMin: 0,
      toMax: 100,
      clamp: true,
      smooth: false,
      ...params,
    }) as { out: number }).out

  it('flytter et område til et annet', () => {
    expect(run(-1)).toBe(0)
    expect(run(0)).toBe(50)
    expect(run(1)).toBe(100)
  })

  it('klemmer utenfor området når clamp er på', () => {
    expect(run(2)).toBe(100)
    expect(run(-2, { clamp: false })).toBe(-50)
  })

  it('bruker smoothstep når det er valgt', () => {
    expect(run(0, { smooth: true })).toBeCloseTo(50, 9)
    expect(run(0.5, { smooth: true })).toBeCloseTo(84.375, 9)
  })

  it('håndterer et tomt kildeområde', () => {
    expect(run(5, { fromMin: 3, fromMax: 3 })).toBe(0)
  })

  it('bruker fast verdi når inngangen mangler', () => {
    expect(run(undefined, { value: 0.5 })).toBe(75)
  })
})

describe('Verdi-velger', () => {
  const run = (inputs: Record<string, unknown>, params: Record<string, unknown> = {}) =>
    (valueSwitchNode.evaluate(ctx, inputs, { index: 0, ...params }) as { out: number }).out

  it('velger riktig inngang', () => {
    const inputs = { in0: 10, in1: 20, in2: 30, in3: 40 }
    expect(run(inputs, { index: 0 })).toBe(10)
    expect(run(inputs, { index: 2 })).toBe(30)
    expect(run(inputs, { index: 3 })).toBe(40)
  })

  it('kan styres av en indeksinngang, og klemmer til 0–3', () => {
    expect(run({ in0: 10, in1: 20, index: 1 })).toBe(20)
    expect(run({ in0: 10, in1: 20, index: 9 })).toBe(0)
    expect(run({ in0: 10, in1: 20, index: -4 })).toBe(10)
  })

  it('gir 0 når valgt inngang er tom', () => {
    expect(run({})).toBe(0)
  })
})

describe('Bildevelger', () => {
  function render() {
    const calls: unknown[][] = []
    const target = { width: 64, height: 32 }
    const c = {
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      clearRect: () => {},
      drawImage: (...args: unknown[]) => calls.push(args),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
    }
    const r = {
      ...fakeRender(),
      canvas: () => ({ canvas: target, ctx: c, width: 64, height: 32, version: 0 }),
    } as unknown as RenderServices
    return { r, calls, target }
  }

  const run = (r: RenderServices, inputs: Record<string, unknown>, index = 0) =>
    (imageSwitchNode.evaluate({ ...ctx, render: r }, inputs, { index }) as { out: unknown }).out

  it('tegner valgt inngang inn på mållerretet', () => {
    const { r, calls, target } = render()
    const a = { name: 'A' }
    const b = { name: 'B' }
    run(r, { in0: a, in1: b }, 1)
    expect(calls).toContainEqual([b, 0, 0, 64, 32])
    expect(calls).not.toContainEqual([a, 0, 0, 64, 32])
    expect(run(r, { in0: a, in1: b }, 1)).toBe(target)
  })

  it('gir et gjennomsiktig bilde når valgt inngang er tom', () => {
    const { r, calls } = render()
    run(r, {}, 2)
    expect(calls).toHaveLength(0)
  })
})

describe('registeret', () => {
  it('har de nye nodene i paletten', () => {
    for (const type of ['value.math', 'value.remap', 'value.switch', 'image.switch']) {
      expect(registry.has(type)).toBe(true)
      expect(registry.listed().some((def) => def.type === type)).toBe(true)
    }
  })
})
