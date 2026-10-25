import type { NodeDefinition } from '../../engine/types'

export interface MaskApplyParams {
  invert: boolean
  opacity: number
}

/**
 * Legger en maske på et bilde. Masken bruker alfa, så kanter og myke
 * overganger beholdes. Uten maske går bildet rett gjennom.
 */
export const maskApply: NodeDefinition<MaskApplyParams> = {
  type: 'modifier.mask',
  label: 'Bruk maske',
  category: 'mask',
  description:
    'Klipper et bilde med en maske. Hvitt i masken er synlig, gjennomsiktig er skjult. Uten maske går bildet uendret gjennom.',
  inputs: [
    { id: 'in', label: 'Bilde', type: 'drawable' },
    { id: 'mask', label: 'Maske', type: 'canvas', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'invert', label: 'Inverter masken', type: 'boolean', default: false },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { in: input, mask }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = Math.min(1, Math.max(0, Number(p.opacity)))

    if (input) c.drawImage(input as CanvasImageSource, 0, 0, target.width, target.height)
    if (!mask) {
      c.restore()
      return { out: target.canvas }
    }

    if (p.invert) {
      const inverse = ctx.render.canvas(`${ctx.scopeKey}:inverse`)
      const ic = inverse.ctx
      ic.save()
      ic.setTransform(1, 0, 0, 1, 0, 0)
      ic.clearRect(0, 0, inverse.width, inverse.height)
      ic.fillStyle = '#ffffff'
      ic.fillRect(0, 0, inverse.width, inverse.height)
      ic.globalCompositeOperation = 'destination-out'
      ic.drawImage(mask as CanvasImageSource, 0, 0, inverse.width, inverse.height)
      ic.restore()
      c.globalCompositeOperation = 'destination-in'
      c.drawImage(inverse.canvas, 0, 0, target.width, target.height)
    } else {
      c.globalCompositeOperation = 'destination-in'
      c.drawImage(mask as CanvasImageSource, 0, 0, target.width, target.height)
    }

    c.restore()
    return { out: target.canvas }
  },
}
