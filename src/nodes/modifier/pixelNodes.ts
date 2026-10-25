import type { EvalContext, NodeDefinition } from '../../engine/types'
import { blur, pixelate, warp } from '../../render/raster/effects'

/**
 * Pikseloperasjoner leser bildet, endrer rådata og skriver det tilbake.
 * Alle tre deler samme kontrakt: canvas inn → canvas ut.
 */
/**
 * Tegner inputen inn på mållerretet og leser pikslene derfra. Da virker
 * effektene også når kilden er et bilde eller et video-element, ikke bare
 * et lerret.
 */
function readPixels(
  source: CanvasImageSource,
  target: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
) {
  const w = target.canvas.width
  const h = target.canvas.height
  target.ctx.clearRect(0, 0, w, h)
  target.ctx.drawImage(source, 0, 0, w, h)
  const image = target.ctx.getImageData(0, 0, w, h)
  return { image, w, h }
}

function writePixels(
  target: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D },
  image: ImageData,
) {
  target.ctx.clearRect(0, 0, image.width, image.height)
  target.ctx.putImageData(image, 0, 0)
}

export const blurNode: NodeDefinition = {
  type: 'modifier.blur',
  label: 'Blur',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'radius', label: 'Radius', type: 'number', default: 6, min: 0, max: 30, step: 1, animatable: true },
  ],
  evaluate(ctx: EvalContext, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as CanvasImageSource | undefined
    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }
    const { image, w, h } = readPixels(source, target)
    image.data.set(blur(image.data, w, h, Number(p.radius ?? 6)))
    writePixels(target, image)
    return { out: target.canvas }
  },
}

export const pixelateNode: NodeDefinition = {
  type: 'modifier.pixelate',
  label: 'Pikselering',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    { key: 'pixelSize', label: 'Pikselstørrelse', type: 'int', default: 12, min: 1, max: 120, animatable: true },
  ],
  evaluate(ctx: EvalContext, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as CanvasImageSource | undefined
    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }
    const { image, w, h } = readPixels(source, target)
    image.data.set(pixelate(image.data, w, h, Number(p.pixelSize ?? 12)))
    writePixels(target, image)
    return { out: target.canvas }
  },
}

export const warpNode: NodeDefinition = {
  type: 'modifier.warp',
  label: 'Forvrengning',
  category: 'modifier',
  inputs: [{ id: 'in', label: 'Inn', type: 'canvas' }],
  outputs: [{ id: 'out', label: 'Ut', type: 'canvas' }],
  params: [
    {
      key: 'type', label: 'Type', type: 'enum', default: 'warp-lines',
      options: [
        { value: 'warp-lines', label: 'Linjer' },
        { value: 'warp-dots', label: 'Prikker' },
      ],
    },
    { key: 'amount', label: 'Forvrengning', type: 'number', default: 12, min: 0, max: 100, animatable: true },
    { key: 'spacing', label: 'Mønsteravstand', type: 'number', default: 48, min: 8, max: 200, animatable: true },
    { key: 'cycles', label: 'Sykluser', type: 'number', default: 1, min: 1, max: 8, animatable: true },
  ],
  evaluate(ctx: EvalContext, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const source = input as CanvasImageSource | undefined
    if (!source) {
      target.ctx.clearRect(0, 0, target.width, target.height)
      return { out: target.canvas }
    }
    const { image, w, h } = readPixels(source, target)
    image.data.set(
      warp(
        image.data,
        w,
        h,
        {
          type: p.type as string,
          amount: Number(p.amount ?? 12),
          spacing: Number(p.spacing ?? 48),
          cycles: Number(p.cycles ?? 1),
        },
        ctx.phase,
      ),
    )
    writePixels(target, image)
    return { out: target.canvas }
  },
}
