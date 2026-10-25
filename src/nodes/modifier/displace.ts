import type { NodeDefinition } from '../../engine/types'

export interface DisplaceParams {
  amount: number
  angle: number
  invert: boolean
}

/**
 * Forskyver et bilde med et annet bilde som kart.
 *
 * Rød kanal styrer X og grønn kanal styrer Y. 0,5 i kartet betyr ingen
 * forskyvning. Implementert på CPU, slik at den virker uten egen GPU-shader
 * og er lik i preview og eksport.
 */
export const displaceNode: NodeDefinition<DisplaceParams> = {
  type: 'modifier.displace',
  label: 'Displace',
  category: 'modifier',
  description:
    'Forskyver bildet med et kart. Rød kanal styrer X og grønn kanal styrer Y. 0,5 i kartet betyr ingen forskyvning.',
  inputs: [
    { id: 'in', label: 'Bilde', type: 'drawable' },
    { id: 'map', label: 'Kart', type: 'drawable', optional: true },
  ],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'amount', label: 'Styrke', type: 'number', default: 0.06, min: 0, max: 0.5, step: 0.005, animatable: true },
    { key: 'angle', label: 'Retning', type: 'number', default: 0, min: -360, max: 360, step: 1, animatable: true },
    { key: 'invert', label: 'Inverter kartet', type: 'boolean', default: false },
  ],
  evaluate(ctx, { in: input, map }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1

    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    const w = target.width
    const h = target.height
    c.drawImage(input as CanvasImageSource, 0, 0, w, h)

    if (!map) {
      c.restore()
      return { out: target.canvas }
    }

    const source = c.getImageData(0, 0, w, h)
    const mapTarget = ctx.render.canvas(`${ctx.scopeKey}:map`)
    mapTarget.ctx.setTransform(1, 0, 0, 1, 0, 0)
    mapTarget.ctx.clearRect(0, 0, w, h)
    mapTarget.ctx.drawImage(map as CanvasImageSource, 0, 0, w, h)
    const mapData = mapTarget.ctx.getImageData(0, 0, w, h).data
    const out = c.createImageData(w, h)

    const amount = Math.max(0, Number(p.amount)) * Math.max(w, h)
    const radians = (Number(p.angle) * Math.PI) / 180
    const cos = Math.cos(radians)
    const sin = Math.sin(radians)
    const invert = p.invert ? -1 : 1

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const mx = (mapData[i] / 255 - 0.5) * 2 * amount * invert
        const my = (mapData[i + 1] / 255 - 0.5) * 2 * amount * invert
        const sx = Math.min(w - 1, Math.max(0, Math.round(x + mx * cos - my * sin)))
        const sy = Math.min(h - 1, Math.max(0, Math.round(y + mx * sin + my * cos)))
        const j = (sy * w + sx) * 4
        out.data[i] = source.data[j]
        out.data[i + 1] = source.data[j + 1]
        out.data[i + 2] = source.data[j + 2]
        out.data[i + 3] = source.data[j + 3]
      }
    }

    c.putImageData(out, 0, 0)
    c.restore()
    return { out: target.canvas }
  },
}
