import type { NodeDefinition } from '../../engine/types'

export interface Transform2DParams {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

/**
 * 2D-transform. Opererer på 'drawable' (bilde/video) og produserer 'canvas',
 * slik at alle etterfølgende raster-noder har ett felles format.
 */
export const transform2D: NodeDefinition<Transform2DParams> = {
  type: 'modifier.transform2D',
  label: 'Transform 2D',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'x', label: 'Posisjon X', type: 'number', default: 0, min: -2000, max: 2000, animatable: true },
    { key: 'y', label: 'Posisjon Y', type: 'number', default: 0, min: -2000, max: 2000, animatable: true },
    { key: 'rotation', label: 'Rotasjon', type: 'number', default: 0, min: -180, max: 180, animatable: true },
    { key: 'scale', label: 'Skala', type: 'number', default: 1, min: 0.05, max: 10, step: 0.01, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const { ctx: c, width: w, height: h } = target

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, w, h)

    if (input) {
      c.globalAlpha = p.opacity
      c.translate(w / 2 + p.x, h / 2 + p.y)
      c.rotate((p.rotation * Math.PI) / 180)
      c.scale(p.scale, p.scale)
      c.drawImage(input as CanvasImageSource, -w / 2, -h / 2, w, h)
    }

    c.restore()
    return { out: target.canvas }
  },
}
