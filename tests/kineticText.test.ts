import { describe, expect, it } from 'vitest'
import { KINETIC_MODES, kineticText, type KineticTextParams } from '../src/nodes/source/kineticText'
import { registry } from '../src/nodes'
import type { Object3DValue } from '../src/render/three/object3d'
import type { EvalContext } from '../src/engine/types'

function params(patch: Partial<KineticTextParams> = {}): KineticTextParams {
  const out: Record<string, unknown> = {}
  for (const p of kineticText.params) out[p.key] = p.default
  return { ...out, ...patch } as KineticTextParams
}

function context(phase: number, cache = new Map<string, unknown>()): EvalContext {
  return {
    nodeId: 'kinetic', scopeKey: 'root/kinetic', frame: Math.round(phase * 60), fps: 60,
    totalFrames: 60, time: phase, phase, width: 100, height: 100,
    render: {} as EvalContext['render'], nodeCache: cache,
  }
}

describe('Kinetic type', () => {
  it('lager én bokstav per tegn og ring', async () => {
    const out = (await kineticText.evaluate(context(0), {}, params({ text: 'AB', stacks: 3 }))) as {
      out: Object3DValue
    }
    expect(out.out.children).toHaveLength(6)
    expect(out.out.children?.[0].geometry?.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('hopper over mellomrom', async () => {
    const out = (await kineticText.evaluate(context(0), {}, params({ text: 'A B', stacks: 1 }))) as {
      out: Object3DValue
    }
    expect(out.out.children).toHaveLength(2)
  })

  it('lukker loopen: fase 0 og 1 gir samme transform', async () => {
    const cache = new Map<string, unknown>()
    const first = (await kineticText.evaluate(context(0, cache), {}, params({ text: 'ABC', stacks: 2 }))) as { out: Object3DValue }
    const last = (await kineticText.evaluate(context(1, cache), {}, params({ text: 'ABC', stacks: 2 }))) as { out: Object3DValue }
    expect(last.out.children).toHaveLength(first.out.children?.length ?? 0)
    for (let i = 0; i < (first.out.children?.length ?? 0); i++) {
      const a = first.out.children![i].transform
      const b = last.out.children![i].transform
      expect(b.position.x).toBeCloseTo(a.position.x, 6)
      expect(b.position.y).toBeCloseTo(a.position.y, 6)
      expect(b.position.z).toBeCloseTo(a.position.z, 6)
      expect(b.rotation.y).toBeCloseTo(a.rotation.y, 6)
    }
  })

  it('beveger seg gjennom loopen', async () => {
    const cache = new Map<string, unknown>()
    const first = (await kineticText.evaluate(context(0, cache), {}, params({ text: 'AB' }))) as { out: Object3DValue }
    const mid = (await kineticText.evaluate(context(0.25, cache), {}, params({ text: 'AB' }))) as { out: Object3DValue }
    expect(mid.out.children?.[0].transform.position.x).not.toBeCloseTo(
      first.out.children?.[0].transform.position.x ?? 0,
      6,
    )
  })

  it('gjenbruker bokstavgeometri mellom frames', async () => {
    const cache = new Map<string, unknown>()
    const first = (await kineticText.evaluate(context(0, cache), {}, params({ text: 'A' }))) as { out: Object3DValue }
    const second = (await kineticText.evaluate(context(0.2, cache), {}, params({ text: 'A' }))) as { out: Object3DValue }
    expect(second.out.children?.[0].geometry).toBe(first.out.children?.[0].geometry)
  })

  it('gir en tom gruppe uten tekst', async () => {
    const out = (await kineticText.evaluate(context(0), {}, params({ text: '' }))) as { out: Object3DValue }
    expect(out.out.children).toHaveLength(0)
  })

  it('har alle variantene og lukker loopen for hver av dem', async () => {
    for (const { value: mode } of KINETIC_MODES) {
      const cache = new Map<string, unknown>()
      const p = params({ text: 'ABC', stacks: 2, mode })
      const first = (await kineticText.evaluate(context(0, cache), {}, p)) as { out: Object3DValue }
      const last = (await kineticText.evaluate(context(1, cache), {}, p)) as { out: Object3DValue }
      expect(first.out.children, mode).toHaveLength(6)
      expect(last.out.children, mode).toHaveLength(6)
      for (let i = 0; i < 6; i++) {
        const a = first.out.children![i].transform
        const b = last.out.children![i].transform
        expect(b.position.x, `${mode} x`).toBeCloseTo(a.position.x, 6)
        expect(b.position.y, `${mode} y`).toBeCloseTo(a.position.y, 6)
        expect(b.position.z, `${mode} z`).toBeCloseTo(a.position.z, 6)
        expect(b.rotation.y, `${mode} ry`).toBeCloseTo(a.rotation.y, 6)
        expect(b.rotation.z, `${mode} rz`).toBeCloseTo(a.rotation.z, 6)
      }
    }
  })

  it('er registrert i paletten', () => {
    expect(registry.has('source.kineticText')).toBe(true)
    expect(registry.listed().some((def) => def.type === 'source.kineticText')).toBe(true)
  })
})
