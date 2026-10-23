import { describe, expect, it } from 'vitest'
import type { EvalContext, NodeDefinition, PostOptions, RenderServices } from '../src/engine/types'
import { shader } from '../src/nodes/modifier/shader'
import { CUSTOM_SHADER_DEFAULT, customLookShader } from '../src/render/shaders/custom'

type ParamsOf<D> = D extends NodeDefinition<infer P> ? P : never

function params(patch: Partial<ParamsOf<typeof shader>> = {}): ParamsOf<typeof shader> {
  const out: Record<string, unknown> = {}
  for (const p of shader.params) out[p.key] = p.default
  return { ...out, ...patch } as ParamsOf<typeof shader>
}

function harness(phase: number) {
  const calls: PostOptions[] = []
  const canvas = {} as HTMLCanvasElement
  const target = {
    canvas,
    ctx: {
      save() {},
      restore() {},
      setTransform() {},
      clearRect() {},
      drawImage() {},
    } as unknown as CanvasRenderingContext2D,
    width: 10,
    height: 10,
    version: 1,
  }

  const render = {
    width: 10,
    height: 10,
    canvas: () => target,
    touch() {},
    versionOf: () => 0,
    post: async (_input: CanvasImageSource | null, options: PostOptions) => {
      calls.push(options)
      return canvas
    },
    assets: {},
    dispose() {},
  } as unknown as RenderServices

  const ctx: EvalContext = {
    nodeId: 'shader',
    scopeKey: 'root/shader',
    frame: Math.round(phase * 60),
    fps: 60,
    totalFrames: 60,
    time: phase,
    phase,
    width: 10,
    height: 10,
    render,
    nodeCache: new Map(),
  }

  return { ctx, calls }
}

function run(phase: number, patch: Partial<ParamsOf<typeof shader>> = {}) {
  const h = harness(phase)
  return {
    ...h,
    result: shader.evaluate(h.ctx, { in: {} as HTMLCanvasElement }, params(patch)) as Promise<{ out: unknown }>,
  }
}

describe('modifier.shader', () => {
  it('pakker brukerkoden inn i en komplett applyLook-shader', () => {
    const glsl = customLookShader('return vec3(1.0);')
    expect(glsl).toContain('return vec3(1.0);')
    expect(glsl).toContain('vec3 applyLook(')
    expect(glsl).toContain('uniform float uValueA;')
    expect(glsl).toContain('uniform vec3 uColorA;')
    expect(glsl).toContain('void main()')
  })

  it('gjør en tom kropp om til en gyldig no-op', () => {
    expect(customLookShader('   ')).toContain('return col;')
    expect(CUSTOM_SHADER_DEFAULT).toContain('return mix(col, plasma, bl);')
  })

  it('sender koden, fargene og de fire verdiene til post', async () => {
    const { calls, result } = run(0.25, {
      code: 'return uColorA * uValueA;',
      valueA: 0.25,
      colorB: '#112233',
    })
    await result
    const options = calls[0]
    expect(options.custom).toBe(true)
    expect(options.glsl).toContain('return uColorA * uValueA;')
    expect(options.uniforms?.uValueA).toBe(0.25)
    expect(options.colors?.uColorA).toBe('#b9ff66')
    expect(options.colors?.uColorB).toBe('#112233')
  })

  it('lukker loopen: fase 1 gir samme tid som fase 0', async () => {
    const first = run(0, { cycles: 2 })
    const last = run(1, { cycles: 2 })
    await Promise.all([first.result, last.result])
    expect(last.calls[0].time).toBe(first.calls[0].time)
    expect(first.calls[0].time).toBe(0)
  })

  it('bruker hele sykluser, ikke rå fase', async () => {
    const { calls, result } = run(0.5, { cycles: 2 })
    await result
    // 60 frames / 60 fps = 1 sekund per syklus, to sykluser.
    expect(calls[0].time).toBeCloseTo(1, 10)
  })

  it('tømmer lerretet når inngangen mangler', async () => {
    const h = harness(0)
    const out = (await shader.evaluate(h.ctx, {}, params())) as { out: unknown }
    expect(out.out).toBe(h.ctx.render.canvas('root/shader').canvas)
    expect(h.calls).toHaveLength(0)
  })
})
