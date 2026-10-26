import type { NodeDefinition } from '../../engine/types'
import { color, stops, type GradientStop } from '../../engine/color/gradient'
import { gradientPaint } from '../../render/raster/gradientFill'

export type GradientMapMode = 'alpha' | 'luminance'

export interface GradientMapParams {
  mode: GradientMapMode
  stops: GradientStop[]
  angle: number
  travel: number
  density: number
  opacity: number
  invert: boolean
}

const DEFAULT_STOPS: GradientStop[] = [
  { position: 0, color: '#05050a', softness: 1 },
  { position: 1, color: '#b9ff66', softness: 1 },
]

/**
 * Legger en flerfarge-gradient på et objekt eller en gruppe.
 *
 * «Fyll formen» bruker bildets alfa som maske og fyller silhuetten med
 * gradienten. «Lysstyrke» mapper hver piksel gjennom gradientskalaen, nyttig
 * for å fargelegge gråtonebilder og 3D-scener.
 */
export const gradientMap: NodeDefinition<GradientMapParams> = {
  type: 'modifier.gradientMap',
  label: 'Gradient map',
  category: 'modifier',
  description:
    'Fargelegger et bilde eller en gruppe med en gradient. Velg fyll formen etter alfa, eller map lysstyrke gjennom gradientskalaen. Legg til flere fargestopp for unike gradienter.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Metode', type: 'enum', default: 'alpha',
      options: [
        { value: 'alpha', label: 'Fyll formen (alfa)' },
        { value: 'luminance', label: 'Map lysstyrke' },
      ],
    },
    { key: 'stops', label: 'Fargestopp', type: 'gradient', default: DEFAULT_STOPS },
    { key: 'angle', label: 'Vinkel', type: 'number', default: 45, min: -180, max: 180, animatable: true },
    { key: 'travel', label: 'Fargevandring', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'density', label: 'Tetthet', type: 'number', default: 2, min: 0.5, max: 8, step: 0.5, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'invert', label: 'Inverter lysstyrke', type: 'boolean', default: false },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const w = target.width
    const h = target.height
    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
    c.clearRect(0, 0, w, h)

    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    const list = stops({
      colorA: p.stops[0]?.color ?? '#000000',
      colorB: p.stops[p.stops.length - 1]?.color ?? '#ffffff',
      gradient: { stops: p.stops },
    })

    if (p.mode === 'luminance') {
      c.drawImage(input as CanvasImageSource, 0, 0, w, h)
      const image = c.getImageData(0, 0, w, h)
      const lut = Array.from({ length: 256 }, (_, i) => {
        const hex = color(list, i / 255)
        return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
      })
      const opacity = Math.min(1, Math.max(0, Number(p.opacity)))
      for (let i = 0; i < image.data.length; i += 4) {
        let lum =
          (0.2126 * image.data[i] + 0.7152 * image.data[i + 1] + 0.0722 * image.data[i + 2]) /
          255
        if (p.invert) lum = 1 - lum
        const [r, g, b] = lut[Math.min(255, Math.max(0, Math.round(lum * 255)))]
        image.data[i] = r
        image.data[i + 1] = g
        image.data[i + 2] = b
        image.data[i + 3] = Math.round(image.data[i + 3] * opacity)
      }
      c.putImageData(image, 0, 0)
      c.restore()
      return { out: target.canvas }
    }

    c.drawImage(input as CanvasImageSource, 0, 0, w, h)
    c.globalCompositeOperation = 'source-in'
    c.globalAlpha = Math.min(1, Math.max(0, Number(p.opacity)))
    c.translate(w / 2, h / 2)
    c.fillStyle = gradientPaint(
      c,
      Math.max(w, h),
      {
        fill: 'linear',
        colorA: list[0]?.color ?? '#000000',
        colorB: list[list.length - 1]?.color ?? '#ffffff',
        stops: p.stops,
        angle: Number(p.angle),
        travel: Number(p.travel),
        density: Number(p.density),
      },
      ctx.phase,
    )
    c.fillRect(-w / 2, -h / 2, w, h)
    c.restore()
    return { out: target.canvas }
  },
}
