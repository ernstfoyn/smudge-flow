import { describe, expect, it } from 'vitest'
import { Evaluator } from '../src/engine/evaluator'
import { NodeRegistry } from '../src/engine/registry'
import type { EvalContext, Graph, InputValues, NodeDefinition } from '../src/engine/types'
import { sceneObject } from '../src/nodes/composite/sceneObject'
import { sceneGroup } from '../src/nodes/composite/sceneGroup'
import { sceneCamera } from '../src/nodes/composite/sceneCamera'
import { sceneLights } from '../src/nodes/composite/sceneLights'
import { identityTransform, type Object3DValue } from '../src/render/three/object3d'
import { fakeRender } from './fakeRender'

const ctx = { nodeCache: new Map() } as unknown as EvalContext

/** Objekt med kjente verdier, slik at komponeringen kan måles. */
function object(overrides: Partial<Object3DValue> = {}): Object3DValue {
  return {
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0.1,
    opacity: 1,
    emissive: '#000000',
    transform: identityTransform(),
    ...overrides,
  }
}

type ParamsOf<D> = D extends NodeDefinition<infer P> ? P : never

/** Alle standardverdier, overskrevet med `patch`. */
function params<D extends NodeDefinition<any>>(
  def: D,
  patch: Partial<ParamsOf<D>> = {},
): ParamsOf<D> {
  const out: Record<string, unknown> = {}
  for (const p of def.params) out[p.key] = p.default
  return { ...out, ...patch } as ParamsOf<D>
}

/** Kjører en node og gir output som et vanlig objekt. */
async function run<D extends NodeDefinition<any>>(
  def: D,
  inputs: InputValues,
  p: ParamsOf<D>,
): Promise<Record<string, unknown>> {
  return (await def.evaluate(ctx, inputs, p)) as Record<string, unknown>
}

describe('scene.object', () => {
  it('legger transformen oppå objektets egen', async () => {
    const input = object({
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 10, y: 20, z: 30 },
        scale: { x: 2, y: 2, z: 2 },
      },
    })

    const out = (await run(
      sceneObject,
      { in: input },
      params(sceneObject, { posX: 0.5, rotY: 5, scaleX: 3 }),
    )).out as Object3DValue

    expect(out.transform.position).toEqual({ x: 1.5, y: 2, z: 3 })
    expect(out.transform.rotation.y).toBe(25)
    // Skala ganges, ikke legges til.
    expect(out.transform.scale.x).toBe(6)
  })

  it('multipliserer dekkevne og respekterer synlighet', async () => {
    const out = (await run(
      sceneObject,
      { in: object({ opacity: 0.5 }) },
      params(sceneObject, { opacity: 0.5, visible: false }),
    )).out as Object3DValue

    expect(out.opacity).toBeCloseTo(0.25)
    expect(out.visible).toBe(false)
  })

  it('lar et skjult objekt forbli skjult', async () => {
    const out = (await run(
      sceneObject,
      { in: object({ visible: false }) },
      params(sceneObject, { visible: true }),
    )).out as Object3DValue

    expect(out.visible).toBe(false)
  })

  it('tåler manglende input', async () => {
    const out = await run(sceneObject, {}, params(sceneObject))
    expect(out.out).toBeUndefined()
  })
})

describe('scene.group', () => {
  it('samler barna i én gruppe med felles dekkevne', async () => {
    const out = (await run(
      sceneGroup,
      { children: [object(), object({ opacity: 0.5 })] },
      params(sceneGroup, { opacity: 0.5 }),
    )).out as Object3DValue

    expect(out.children).toHaveLength(2)
    // Gruppen har ingen egen geometri — den er bare barn og transform.
    expect(out.geometry).toBeUndefined()
    expect(out.children?.[0].opacity).toBeCloseTo(0.5)
    expect(out.children?.[1].opacity).toBeCloseTo(0.25)
  })

  it('er tom når ingen barn er koblet', async () => {
    const out = await run(sceneGroup, { children: [] }, params(sceneGroup))
    expect(out.out).toBeUndefined()
  })
})

describe('scene.camera', () => {
  it('gir et kamera med posisjon, mål og synsvinkel', async () => {
    const out = (await run(
      sceneCamera,
      {},
      params(sceneCamera, { posX: 1, posZ: 6, targetY: 0.5, fov: 30 }),
    )).out as {
      position: { x: number; y: number; z: number }
      target: { y: number }
      fov: number
    }

    expect(out.position).toEqual({ x: 1, y: 0, z: 6 })
    expect(out.target.y).toBe(0.5)
    expect(out.fov).toBe(30)
  })

  it('har animerbare parametere', () => {
    const animatable = sceneCamera.params.filter((p) => p.animatable).map((p) => p.key)
    expect(animatable).toContain('posX')
    expect(animatable).toContain('targetZ')
    expect(animatable).toContain('fov')
  })
})

describe('scene.lights', () => {
  it('gir omgivelses-, hoved- og kantlys', async () => {
    const out = (await run(
      sceneLights,
      {},
      params(sceneLights, { ambient: 0.5, keyIntensity: 3, rimOn: true }),
    )).out as {
      ambient: { intensity: number }
      key: { intensity: number }
      rim?: unknown
    }

    expect(out.ambient.intensity).toBe(0.5)
    expect(out.key.intensity).toBe(3)
    expect(out.rim).toBeDefined()
  })

  it('slår av kantlyset', async () => {
    const out = (await run(sceneLights, {}, params(sceneLights, { rimOn: false }))).out as {
      rim?: unknown
    }
    expect(out.rim).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Motoren: proveniens og memoisering
// ---------------------------------------------------------------------------

const numberSource: NodeDefinition = {
  type: 'test.number',
  label: 'Tall',
  category: 'source',
  timeDependent: false,
  inputs: [],
  outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
  params: [{ key: 'value', label: 'Verdi', type: 'number', default: 0 }],
  evaluate(_ctx, _inputs, p) {
    return { out: Number(p.value) }
  },
}

const passThrough: NodeDefinition = {
  type: 'test.pass',
  label: 'Videre',
  category: 'modifier',
  timeDependent: false,
  inputs: [{ id: 'in', label: 'Inn', type: 'number' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'number' }],
  params: [{ key: 'bias', label: 'Tillegg', type: 'number', default: 0 }],
  evaluate(_ctx, inputs, p) {
    return { out: Number(inputs.in) + Number(p.bias) }
  },
}

const collector: NodeDefinition = {
  type: 'test.collect',
  label: 'Samler',
  category: 'composite',
  inputs: [{ id: 'in', label: 'Inn', type: 'number', multiple: true }],
  outputs: [{ id: 'out', label: 'Kanter', type: 'string' }],
  params: [],
  evaluate(ctx, _inputs) {
    // Bevis at noden ser hvilke kanter verdiene kom fra.
    return { out: (ctx.inputEdges?.in ?? []).map((e) => e.id).join(',') }
  },
}

const registry = new NodeRegistry().registerAll([numberSource, passThrough, collector])

function graph(): Graph {
  return {
    version: 1,
    settings: { width: 10, height: 10, fps: 30, frames: 60, loop: true, background: '#000' },
    nodes: [
      { id: 'src', type: 'test.number', title: 'Kilde', params: { value: 1 }, position: { x: 0, y: 0 } },
      { id: 'pass', type: 'test.pass', title: 'Videre', params: { bias: 10 }, position: { x: 0, y: 0 } },
      { id: 'col', type: 'test.collect', title: 'Samler', params: {}, position: { x: 0, y: 0 } },
    ],
    edges: [
      { id: 'e1', source: 'src', sourcePort: 'out', target: 'pass', targetPort: 'in' },
      { id: 'e2', source: 'pass', sourcePort: 'out', target: 'col', targetPort: 'in' },
    ],
  }
}

describe('motoren', () => {
  it('regner på nytt når en inngang endrer seg i en tidsuavhengig node', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const g = graph()

    const first = await evaluator.evaluateFrame(g, 0, ['pass'])
    expect(first.get('pass')?.out).toBe(11)

    // Endre kilden. Uten at memo-signaturen ser kildens versjon, ville
    // «pass» blitt stående på 11 for alltid.
    g.nodes[0].params.value = 5
    const second = await evaluator.evaluateFrame(g, 0, ['pass'])
    expect(second.get('pass')?.out).toBe(15)
  })

  it('gir hver multiple-port kantene i samme rekkefølge som verdiene', async () => {
    const evaluator = new Evaluator(registry, fakeRender())
    const out = await evaluator.evaluateFrame(graph(), 0, ['col'])
    expect(out.get('col')?.out).toBe('e2')
  })
})
