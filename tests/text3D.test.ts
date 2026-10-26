import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EvalContext, NodeDefinition } from '../src/engine/types'
import { text3D } from '../src/nodes/source/text3D'
import type { Object3DValue } from '../src/render/three/object3d'
import { buildTextGeometry } from '../src/render/three/textGeometry'

type ParamsOf<D> = D extends NodeDefinition<infer P> ? P : never

function params(patch: Partial<ParamsOf<typeof text3D>> = {}): ParamsOf<typeof text3D> {
  const out: Record<string, unknown> = {}
  for (const p of text3D.params) out[p.key] = p.default
  return { ...out, ...patch } as ParamsOf<typeof text3D>
}

function context(cache = new Map<string, unknown>()): EvalContext {
  return {
    nodeId: 'text',
    scopeKey: 'root/text',
    frame: 0,
    fps: 60,
    totalFrames: 60,
    time: 0,
    phase: 0,
    width: 100,
    height: 100,
    render: {} as EvalContext['render'],
    nodeCache: cache,
  }
}

describe('source.text3D', () => {
  it('bygger ekstrudert geometri som er sentrert rundt origo', async () => {
    const geometry = await buildTextGeometry({ text: 'SMUDGE', font: 'droid-sans-regular', size: 1, depth: 0.2, segments: 4 })
    geometry.computeBoundingBox()
    const box = geometry.boundingBox!
    const center = {
      x: (box.max.x + box.min.x) / 2,
      y: (box.max.y + box.min.y) / 2,
      z: (box.max.z + box.min.z) / 2,
    }

    expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
    expect(center.x).toBeCloseTo(0, 4)
    expect(center.y).toBeCloseTo(0, 4)
    expect(center.z).toBeCloseTo(0, 4)
    // Tykkelsen skal være omtrent lik depth.
    expect(box.max.z - box.min.z).toBeCloseTo(0.2, 4)
  })

  it('gir en tom geometri uten å kaste når teksten er tom', async () => {
    const geometry = await buildTextGeometry({ text: '', font: 'droid-sans-regular', size: 1, depth: 0.2, segments: 4 })
    expect(geometry.getAttribute('position')).toBeDefined()
    expect(geometry.getAttribute('position').count).toBe(0)
  })

  it('alle 3D-fontene dekker nordiske tegn', () => {
    const files = [
      'droid_sans_regular',
      'droid_sans_bold',
      'droid_sans_mono_regular',
      'droid_serif_regular',
      'droid_serif_bold',
      'gentilis_regular',
      'gentilis_bold',
    ]
    for (const file of files) {
      const data = JSON.parse(
        readFileSync(new URL(`../src/assets/${file}.typeface.json`, import.meta.url), 'utf8'),
      ) as { glyphs: Record<string, unknown> }
      for (const char of 'ÆØÅæøå') expect(data.glyphs[char], `${file}: ${char}`).toBeDefined()
    }
  })

  it('gjenbruker geometrien mellom frames med samme parametere', async () => {
    const cache = new Map<string, unknown>()
    const first = (await text3D.evaluate(context(cache), {}, params())) as { out: Object3DValue }
    const second = (await text3D.evaluate(context(cache), {}, params())) as { out: Object3DValue }

    expect(second.out.geometry).toBe(first.out.geometry)
    expect(second.out.shading).toBe('standard')
  })

  it('bygger ny geometri når fonten endres', async () => {
    const cache = new Map<string, unknown>()
    const first = (await text3D.evaluate(context(cache), {}, params({ font: 'droid-sans-regular' }))) as { out: Object3DValue }
    const second = (await text3D.evaluate(context(cache), {}, params({ font: 'gentilis-bold' }))) as { out: Object3DValue }

    expect(second.out.geometry).not.toBe(first.out.geometry)
    expect(second.out.geometry!.getAttribute('position').count).toBeGreaterThan(0)
  })

  it('bygger ny geometri når teksten endres', async () => {
    const cache = new Map<string, unknown>()
    const first = (await text3D.evaluate(context(cache), {}, params({ text: 'A' }))) as { out: Object3DValue }
    const second = (await text3D.evaluate(context(cache), {}, params({ text: 'AB' }))) as { out: Object3DValue }

    expect(second.out.geometry).not.toBe(first.out.geometry)
    expect(second.out.geometry!.getAttribute('position').count).toBeGreaterThan(
      first.out.geometry!.getAttribute('position').count,
    )
  })
})
