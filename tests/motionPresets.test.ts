import { describe, expect, it } from 'vitest'
import type { EvalContext, RenderServices } from '../src/engine/types'
import {
  MOTION2D_PRESETS,
  MOTION3D_PRESETS,
  offsetPhase,
  sampleMotion2D,
  sampleMotion3D,
} from '../src/engine/animation/motionPresets'
import { motion2D, type Motion2DParams } from '../src/nodes/modifier/motion2D'
import { motion3D, type Motion3DParams } from '../src/nodes/modifier/motion3D'
import { identityTransform, type Object3DValue } from '../src/render/three/object3d'
import { registry } from '../src/nodes'
import { BUILTIN_BLOCKS } from '../src/blocks/builtins'

function fakeContext(phase: number, frame: number, render: RenderServices): EvalContext {
  return {
    nodeId: 'motion',
    scopeKey: 'root/motion',
    frame,
    fps: 60,
    totalFrames: 60,
    time: frame / 60,
    phase,
    width: 200,
    height: 100,
    render,
    nodeCache: new Map(),
  }
}

function unusedRender(): RenderServices {
  return {
    width: 200,
    height: 100,
    canvas: () => {
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
    touch: () => {},
    versionOf: () => 0,
    post: async () => {
      throw new Error('Ikke støttet i test')
    },
    dispose: () => {},
  }
}

interface CanvasCalls {
  translate: Array<[number, number]>
  rotate: number[]
  scale: Array<[number, number]>
  drawImage: number
  alphas: number[]
}

function renderWithCanvas(): { render: RenderServices; calls: CanvasCalls } {
  const calls: CanvasCalls = { translate: [], rotate: [], scale: [], drawImage: 0, alphas: [] }
  let alpha = 1
  const context = {
    save() {},
    restore() {},
    setTransform() {},
    clearRect() {},
    translate(x: number, y: number) {
      calls.translate.push([x, y])
    },
    rotate(angle: number) {
      calls.rotate.push(angle)
    },
    scale(x: number, y: number) {
      calls.scale.push([x, y])
    },
    drawImage() {
      calls.drawImage += 1
    },
    set globalAlpha(value: number) {
      alpha = value
      calls.alphas.push(value)
    },
    get globalAlpha() {
      return alpha
    },
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
  }
  const canvas = { width: 200, height: 100 } as HTMLCanvasElement
  return {
    render: {
      ...unusedRender(),
      canvas: () => ({
        canvas,
        ctx: context as unknown as CanvasRenderingContext2D,
        width: 200,
        height: 100,
        version: 0,
      }),
    },
    calls,
  }
}

function motion2DParams(patch: Partial<Motion2DParams> = {}): Motion2DParams {
  return { preset: 'float', amplitude: 80, cycles: 1, phase: 0, ...patch }
}

function motion3DParams(patch: Partial<Motion3DParams> = {}): Motion3DParams {
  return {
    preset: 'orbit',
    strength: 100,
    cycles: 1,
    phase: 0,
    phaseOffset: 0.15,
    ...patch,
  }
}

function object(children?: Object3DValue[]): Object3DValue {
  return {
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    opacity: 1,
    emissive: '#000000',
    transform: identityTransform(),
    children,
  }
}

describe('animasjonspresets fra den opprinnelige appen', () => {
  it('har de samme preset-navnene som originalen', () => {
    expect(MOTION2D_PRESETS.map((p) => p.value)).toEqual([
      'none',
      'float',
      'slide',
      'orbit',
      'wobble',
      'pulse',
      'fade',
    ])
    expect(MOTION3D_PRESETS.map((p) => p.value)).toEqual([
      'none',
      'orbit',
      'wave',
      'grid',
      'spiral',
      'swarm',
      'spin',
      'pulse',
    ])
  })

  it('registrerer begge nodetypene og standardblokkene', () => {
    expect(registry.has('modifier.motion2D')).toBe(true)
    expect(registry.has('modifier.motion3D')).toBe(true)
    expect(BUILTIN_BLOCKS.some((b) => b.nodes.some((n) => n.type === 'modifier.motion2D'))).toBe(true)
    expect(BUILTIN_BLOCKS.some((b) => b.nodes.some((n) => n.type === 'modifier.motion3D'))).toBe(true)
  })

  it('standardblokkene for bevegelse har et internt standardinnhold', () => {
    for (const name of ['Bevegelig bilde', '3D-animasjon']) {
      const block = BUILTIN_BLOCKS.find((b) => b.name === name)
      expect(block).toBeDefined()
      for (const input of block!.inputs) {
        expect(
          block!.edges.some(
            (edge) => edge.target === input.targetNode && edge.targetPort === input.targetPort,
          ),
        ).toBe(true)
      }
    }
  })
})

describe('modifier.motion2D', () => {
  it('lukker alle 2D-presets eksakt ved fase 0 og 1', () => {
    for (const { value } of MOTION2D_PRESETS) {
      const first = sampleMotion2D(value, 0, 137, 3)
      const last = sampleMotion2D(value, 1, 137, 3)
      expect(last).toEqual(first)
    }
  })

  it('gir de samme bevegelsene som originalformlene', () => {
    expect(sampleMotion2D('float', 0.25, 100, 1).y).toBeCloseTo(100, 6)
    expect(sampleMotion2D('slide', 0.25, 100, 1).x).toBeCloseTo(100, 6)
    expect(sampleMotion2D('orbit', 0, 100, 1)).toMatchObject({ x: 100, y: 0 })
    expect(sampleMotion2D('wobble', 0.25, 100, 1).rotation).toBeCloseTo(Math.PI / 5, 6)
    expect(sampleMotion2D('pulse', 0.25, 100, 1).scale).toBeCloseTo(1.2, 6)
    expect(sampleMotion2D('fade', 0, 100, 1).opacity).toBeCloseTo(1, 6)
    expect(sampleMotion2D('fade', 0.5, 100, 1).opacity).toBeCloseTo(0, 6)
  })

  it('tegner innholdet rundt lerretets midtpunkt med valgt bevegelse', () => {
    const { render, calls } = renderWithCanvas()
    const drawable = {} as CanvasImageSource
    const out = motion2D.evaluate(
      fakeContext(0.25, 15, render),
      { in: drawable },
      motion2DParams({ preset: 'float', amplitude: 100 }),
    ) as { out: HTMLCanvasElement }

    expect(out.out).toBeDefined()
    expect(calls.drawImage).toBe(1)
    expect(calls.translate).toEqual([[100, 150]])
    expect(calls.rotate).toEqual([0])
    expect(calls.scale).toEqual([[1, 1]])
  })

  it('bruker dekkevne fra fade-presetet', () => {
    const { render, calls } = renderWithCanvas()
    motion2D.evaluate(
      fakeContext(0.5, 30, render),
      { in: {} as CanvasImageSource },
      motion2DParams({ preset: 'fade', amplitude: 100 }),
    )
    expect(calls.alphas.at(-1)).toBeCloseTo(0, 6)
  })
})

describe('modifier.motion3D', () => {
  it('lukker alle 3D-presets eksakt ved fase 0 og 1', () => {
    for (const { value } of MOTION3D_PRESETS) {
      const first = sampleMotion3D(value, 0, 137, 3, 2, 8, 0.15)
      const last = sampleMotion3D(value, 1, 137, 3, 2, 8, 0.15)
      expect(last).toEqual(first)
    }
  })

  it('legger bevegelsen oppå objektets egen transform', () => {
    const base = object()
    base.transform.position.x = 1.5
    const out = motion3D.evaluate(
      fakeContext(0, 0, unusedRender()),
      { in: base },
      motion3DParams({ preset: 'orbit', strength: 100 }),
    ) as { out: Object3DValue }

    // Orbit ved fase 0: x += 0.75, z = 0, y = 0.
    expect(out.out.transform.position.x).toBeCloseTo(2.25, 6)
    expect(out.out.transform.position.z).toBeCloseTo(0, 6)
    expect(out.out.transform.position.y).toBeCloseTo(0, 6)
  })

  it('gir hvert toppnivå-barn sin egen fase i en gruppe', () => {
    const group = object(
      [0, 1, 2, 3].map((index) => {
        const child = object()
        child.transform.position.x = index * 0.5
        return child
      }),
    )
    const phase = 0.25
    const out = motion3D.evaluate(
      fakeContext(phase, 15, unusedRender()),
      { in: group },
      motion3DParams({ preset: 'swarm', phaseOffset: 0.15 }),
    ) as { out: Object3DValue }

    const expected1 = sampleMotion3D('swarm', offsetPhase(phase, 0), 100, 1, 1, 4, 0.15)
    const expected3 = sampleMotion3D('swarm', offsetPhase(phase, 0), 100, 1, 3, 4, 0.15)

    expect(out.out.children).toHaveLength(4)
    expect(out.out.children![1].transform.position.x).toBeCloseTo(0.5 + expected1.position.x, 6)
    expect(out.out.children![3].transform.position.x).toBeCloseTo(1.5 + expected3.position.x, 6)
    // Ulike indekser skal ikke ha samme bevegelse.
    expect(out.out.children![1].transform.position).not.toEqual(
      out.out.children![3].transform.position,
    )
  })

  it('fordeler spiralradiusen utover barna', () => {
    const group = object([object(), object(), object(), object()])
    const out = motion3D.evaluate(
      fakeContext(0, 0, unusedRender()),
      { in: group },
      motion3DParams({ preset: 'spiral', phaseOffset: 0 }),
    ) as { out: Object3DValue }

    const first = out.out.children![0].transform.position.x
    const last = out.out.children![3].transform.position.x
    expect(last).toBeGreaterThan(first)
  })

  it('lukker loopen også for en gruppe med faseforskyvning', () => {
    const group = object([object(), object(), object()])
    const first = motion3D.evaluate(
      fakeContext(0, 0, unusedRender()),
      { in: group },
      motion3DParams({ preset: 'swarm', cycles: 3 }),
    ) as { out: Object3DValue }
    const last = motion3D.evaluate(
      fakeContext(1, 60, unusedRender()),
      { in: group },
      motion3DParams({ preset: 'swarm', cycles: 3 }),
    ) as { out: Object3DValue }

    expect(JSON.stringify(last.out.children)).toBe(JSON.stringify(first.out.children))
  })

  it('lar «ingen» være en ren gjennomgang', () => {
    const base = object()
    const out = motion3D.evaluate(
      fakeContext(0.4, 24, unusedRender()),
      { in: base },
      motion3DParams({ preset: 'none' }),
    ) as { out: Object3DValue }

    expect(out.out).toBe(base)
  })
})
