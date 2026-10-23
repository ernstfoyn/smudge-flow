import { describe, expect, it } from 'vitest'
import type { EvalContext, NodeDefinition } from '../src/engine/types'
import { scatter3D } from '../src/nodes/modifier/scatter3D'
import { identityTransform, type Object3DValue } from '../src/render/three/object3d'

type ParamsOf<D> = D extends NodeDefinition<infer P> ? P : never

function context(phase: number, frame: number): EvalContext {
  return {
    nodeId: 'scatter',
    scopeKey: 'root/scatter',
    frame,
    fps: 60,
    totalFrames: 60,
    time: frame / 60,
    phase,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: new Map(),
  }
}

function params(patch: Partial<ParamsOf<typeof scatter3D>> = {}): ParamsOf<typeof scatter3D> {
  const out: Record<string, unknown> = {}
  for (const p of scatter3D.params) out[p.key] = p.default
  return { ...out, ...patch } as ParamsOf<typeof scatter3D>
}

function object(): Object3DValue {
  return {
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    opacity: 1,
    emissive: '#000000',
    transform: identityTransform(),
  }
}

function run(phase: number, patch: Partial<ParamsOf<typeof scatter3D>> = {}) {
  return scatter3D.evaluate(context(phase, Math.round(phase * 60)), { in: object() }, params(patch)) as {
    out: Object3DValue
  }
}

describe('modifier.scatter3D', () => {
  it('lager like mange kopier som antallet', () => {
    const out = run(0.25, { count: 9 })
    expect(out.out.children).toHaveLength(9)
  })

  it('plasserer ringen på radius', () => {
    const out = run(0, { pattern: 'ring', count: 4, radius: 2, wave: 0, spin: 0 })
    const positions = out.out.children!.map((c) => c.transform.position)
    for (const p of positions) {
      expect(Math.hypot(p.x, p.z)).toBeCloseTo(2, 5)
      expect(p.y).toBeCloseTo(0, 6)
    }
    // Fire punkter i ringen skal ha ulik vinkel.
    expect(new Set(positions.map((p) => p.x.toFixed(3))).size).toBeGreaterThan(1)
  })

  it('er deterministisk: samme fase gir samme plassering', () => {
    const a = run(0.4, { pattern: 'sphere', count: 12, jitter: 0.5, sizeJitter: 0.6 })
    const b = run(0.4, { pattern: 'sphere', count: 12, jitter: 0.5, sizeJitter: 0.6 })
    expect(JSON.stringify(a.out.children)).toBe(JSON.stringify(b.out.children))
  })

  it('lukker bølgen eksakt når loopen går fra fase 0 til 1', () => {
    const first = run(0, { pattern: 'ring', count: 10, wave: 0.6, waveTurns: 2, spin: 1 })
    const last = run(1, { pattern: 'ring', count: 10, wave: 0.6, waveTurns: 2, spin: 1 })
    expect(JSON.stringify(last.out.children)).toBe(JSON.stringify(first.out.children))
  })

  it('gir en tom gruppe når inngangen mangler', () => {
    const out = scatter3D.evaluate(context(0, 0), {}, params()) as { out: Object3DValue }
    expect(out.out.children).toEqual([])
    expect(out.out.geometry).toBeUndefined()
  })
})
