import type { NodeDefinition } from '../../engine/types'
import { sourceSize } from '../../render/sourceSize'

export type FitMode = 'cover' | 'contain' | 'stretch'

export interface FitParams {
  mode: FitMode
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Beskjærer og tilpasser et bilde eller en video til grafens format.
 *
 * «Dekk» fyller hele flaten og beskjærer det som stikker ut. «Pass inn» viser
 * hele bildet med gjennomsiktig kant. «Strekk» fyller hele flaten uansett
 * forhold. Crop-parametrene velger hvilken del av kilden som brukes.
 */
export const fitNode: NodeDefinition<FitParams> = {
  type: 'modifier.fit',
  label: 'Beskjær / tilpass',
  category: 'modifier',
  description:
    'Beskjærer og plasserer et bilde eller en video i grafens format. Velg dekk, pass inn eller strekk, og juster utsnitt og forskyvning.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Tilpasning', type: 'enum', default: 'cover',
      options: [
        { value: 'cover', label: 'Dekk hele flaten (beskjær)' },
        { value: 'contain', label: 'Pass inn (vis alt)' },
        { value: 'stretch', label: 'Strekk til flaten' },
      ],
    },
    { key: 'cropX', label: 'Utsnitt X', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'cropY', label: 'Utsnitt Y', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'cropWidth', label: 'Utsnitt bredde', type: 'number', default: 1, min: 0.01, max: 1, step: 0.01, animatable: true },
    { key: 'cropHeight', label: 'Utsnitt høyde', type: 'number', default: 1, min: 0.01, max: 1, step: 0.01, animatable: true },
    { key: 'scale', label: 'Skala', type: 'number', default: 1, min: 0.05, max: 4, step: 0.01, animatable: true },
    { key: 'offsetX', label: 'Forskyvning X', type: 'number', default: 0, min: -1, max: 1, step: 0.01, animatable: true },
    { key: 'offsetY', label: 'Forskyvning Y', type: 'number', default: 0, min: -1, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { in: input }, p) {
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

    const source = input as CanvasImageSource
    const size = sourceSize(source)
    const sw = Math.max(1, size.width * Number(p.cropWidth))
    const sh = Math.max(1, size.height * Number(p.cropHeight))
    const sx = Math.min(Math.max(0, size.width - sw), size.width * Number(p.cropX))
    const sy = Math.min(Math.max(0, size.height - sh), size.height * Number(p.cropY))
    const scale = Math.max(0.01, Number(p.scale))

    let dw = target.width
    let dh = target.height
    if (p.mode !== 'stretch' && sw > 0 && sh > 0) {
      const fit =
        p.mode === 'cover'
          ? Math.max(target.width / sw, target.height / sh)
          : Math.min(target.width / sw, target.height / sh)
      dw = sw * fit * scale
      dh = sh * fit * scale
    } else {
      dw *= scale
      dh *= scale
    }

    const dx = (target.width - dw) / 2 + Number(p.offsetX) * target.width
    const dy = (target.height - dh) / 2 + Number(p.offsetY) * target.height

    c.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
    c.restore()
    return { out: target.canvas }
  },
}
