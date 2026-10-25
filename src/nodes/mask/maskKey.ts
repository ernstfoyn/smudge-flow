import type { NodeDefinition } from '../../engine/types'

export type MaskKeyMode = 'luma' | 'chroma'

export interface MaskKeyParams {
  mode: MaskKeyMode
  threshold: number
  softness: number
  keyColor: string
  tolerance: number
  invert: boolean
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 <= edge0) return value >= edge1 ? 1 : 0
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function hexRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return [0, 255, 0]
  const n = parseInt(match[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Maske fra et bilde: lysstyrke (luma) eller en farge (chroma key).
 * Resultatet er alfa-basert, slik at det kan brukes direkte som matte.
 */
export const maskKey: NodeDefinition<MaskKeyParams> = {
  type: 'mask.key',
  label: 'Bildemaske',
  category: 'mask',
  description:
    'Lager en maske fra lysstyrken i et bilde, eller fjerner en farge med chroma key. Hvitt er synlig og gjennomsiktig er skjult.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Maske', type: 'canvas' }],
  params: [
    {
      key: 'mode', label: 'Type', type: 'enum', default: 'luma',
      options: [
        { value: 'luma', label: 'Lysstyrke' },
        { value: 'chroma', label: 'Farge (chroma key)' },
      ],
    },
    { key: 'threshold', label: 'Terskel', type: 'number', default: 0.5, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'softness', label: 'Myk overgang', type: 'number', default: 0.1, min: 0.001, max: 1, step: 0.005, animatable: true },
    { key: 'keyColor', label: 'Fjern farge', type: 'color', default: '#00ff00' },
    { key: 'tolerance', label: 'Fargetoleranse', type: 'number', default: 0.25, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'invert', label: 'Inverter masken', type: 'boolean', default: false },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const w = target.width
    const h = target.height

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, w, h)
    c.globalCompositeOperation = 'source-over'

    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    c.drawImage(input as CanvasImageSource, 0, 0, w, h)
    const source = c.getImageData(0, 0, w, h)
    const out = c.createImageData(w, h)
    const [keyR, keyG, keyB] = hexRgb(String(p.keyColor))
    const threshold = Number(p.threshold)
    const softness = Number(p.softness)
    const tolerance = Number(p.tolerance)

    for (let i = 0; i < source.data.length; i += 4) {
      const r = source.data[i]
      const g = source.data[i + 1]
      const b = source.data[i + 2]
      const sourceAlpha = source.data[i + 3] / 255

      let alpha: number
      if (p.mode === 'chroma') {
        const distance = Math.sqrt((r - keyR) ** 2 + (g - keyG) ** 2 + (b - keyB) ** 2) / 441.67
        alpha = smoothstep(tolerance, tolerance + softness, distance)
      } else {
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
        alpha = smoothstep(threshold - softness, threshold + softness, luma)
      }
      if (p.invert) alpha = 1 - alpha

      out.data[i] = 255
      out.data[i + 1] = 255
      out.data[i + 2] = 255
      out.data[i + 3] = Math.round(clamp01(alpha * sourceAlpha) * 255)
    }

    c.putImageData(out, 0, 0)
    c.restore()
    return { out: target.canvas }
  },
}
