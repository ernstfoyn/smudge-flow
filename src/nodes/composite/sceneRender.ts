import type { NodeDefinition } from '../../engine/types'
import type { Object3DValue } from '../../render/three/object3d'

export interface SceneRenderParams {
  cameraDistance: number
  cameraHeight: number
  fov: number
  background: string
  ambient: number
  directional: number
  /** Roterer hele scenen automatisk (0 = av). */
  spin: number
}

/**
 * Bro fra 3D-domenet til raster-domenet.
 *
 * Dette er noden som gjør at 2D og 3D kan leve i samme graf: den tar
 * 3D-objekter og maler dem ned på et vanlig lerret, som deretter kan
 * blandes med 2D-lag, rastereffekter og eksporteres som vanlig.
 */
export const sceneRender: NodeDefinition<SceneRenderParams> = {
  type: 'composite.sceneRender',
  label: '3D-scene',
  category: 'composite',
  description:
    'Maler 3D-objekter ned på et lerret. Bruk den for å blande 3D med 2D-lag.',
  inputs: [{ id: 'in', label: 'Objekter', type: 'object3d', multiple: true }],
  outputs: [{ id: 'out', label: 'Raster', type: 'canvas' }],
  params: [
    { key: 'cameraDistance', label: 'Kameraavstand', type: 'number', default: 4, min: 0.5, max: 30, step: 0.1, animatable: true },
    { key: 'cameraHeight', label: 'Kamerahøyde', type: 'number', default: 0, min: -10, max: 10, step: 0.1, animatable: true },
    { key: 'fov', label: 'Synsvinkel', type: 'number', default: 45, min: 10, max: 120, step: 1 },
    { key: 'background', label: 'Bakgrunn', type: 'color', default: '#000000' },
    { key: 'ambient', label: 'Omgivelseslys', type: 'number', default: 1.2, min: 0, max: 4, step: 0.05 },
    { key: 'directional', label: 'Retningslys', type: 'number', default: 2, min: 0, max: 6, step: 0.05 },
    { key: 'spin', label: 'Automatisk rotasjon', type: 'number', default: 0, min: -4, max: 4, step: 0.05, animatable: true },
  ],
  async evaluate(ctx, { in: objects }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const list = (Array.isArray(objects) ? objects : objects ? [objects] : []) as Object3DValue[]

    // Lazy: three.js (og WebGL-konteksten) lastes først når 3D brukes.
    const { SceneRenderer } = await import('../../render/three/sceneRenderer')

    let renderer = ctx.nodeCache.get('renderer') as InstanceType<
      typeof SceneRenderer
    > | undefined
    if (!renderer) {
      renderer = new SceneRenderer(ctx.width, ctx.height)
      ctx.nodeCache.set('renderer', renderer)
    }
    renderer.resize(ctx.width, ctx.height)

    const gl = renderer.render(list, {
      cameraDistance: Number(p.cameraDistance),
      cameraHeight: Number(p.cameraHeight),
      fov: Number(p.fov),
      background: String(p.background),
      ambient: Number(p.ambient),
      directional: Number(p.directional),
      spin: Number(p.spin),
    }, ctx.phase)

    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, target.width, target.height)
    c.drawImage(gl, 0, 0, target.width, target.height)
    c.restore()

    return { out: target.canvas }
  },
}
