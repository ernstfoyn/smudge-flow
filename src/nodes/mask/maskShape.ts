import type { NodeDefinition } from '../../engine/types'

export type MaskShape = 'rectangle' | 'ellipse' | 'triangle' | 'linear' | 'radial'

export interface MaskShapeParams {
  shape: MaskShape
  x: number
  y: number
  width: number
  height: number
  rotation: number
  feather: number
  invert: boolean
}

function shapePath(
  c: CanvasRenderingContext2D,
  shape: MaskShape,
  w: number,
  h: number,
) {
  const hw = w / 2
  const hh = h / 2
  if (shape === 'rectangle') {
    c.rect(-hw, -hh, w, h)
    return
  }
  if (shape === 'ellipse') {
    c.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)
    return
  }
  if (shape === 'triangle') {
    c.moveTo(0, -hh)
    c.lineTo(hw, hh)
    c.lineTo(-hw, hh)
    c.closePath()
    return
  }
  // Gradientene bruker hele flaten, ikke en geometrisk path.
  c.rect(-hw, -hh, w, h)
}

/**
 * Fasongmaske. Hvitt = synlig, gjennomsiktig = skjult.
 *
 * Maskeformatet er alfa, ikke svart/hvitt. Da kan den brukes direkte med
 * `destination-in` i maskebrukeren, og myke kanter virker naturlig.
 */
export const maskShape: NodeDefinition<MaskShapeParams> = {
  type: 'mask.shape',
  label: 'Fasongmaske',
  category: 'mask',
  description:
    'Lager en maske fra rektangel, ellipse, trekant eller en gradient. Hvitt er synlig, gjennomsiktig er skjult.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Maske', type: 'canvas' }],
  params: [
    {
      key: 'shape', label: 'Fasong', type: 'enum', default: 'ellipse',
      options: [
        { value: 'ellipse', label: 'Ellipse' },
        { value: 'rectangle', label: 'Rektangel' },
        { value: 'triangle', label: 'Trekant' },
        { value: 'linear', label: 'Lineær gradient' },
        { value: 'radial', label: 'Radial gradient' },
      ],
    },
    { key: 'x', label: 'X', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'y', label: 'Y', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'width', label: 'Bredde', type: 'number', default: 0.6, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'height', label: 'Høyde', type: 'number', default: 0.6, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'rotation', label: 'Rotasjon', type: 'number', default: 0, min: -360, max: 360, step: 1, animatable: true },
    { key: 'feather', label: 'Myk kant', type: 'number', default: 0, min: 0, max: 100, step: 1, animatable: true },
    { key: 'invert', label: 'Inverter masken', type: 'boolean', default: false },
  ],
  evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const work = ctx.render.canvas(`${ctx.scopeKey}:shape`)
    const w = work.width
    const h = work.height
    const c = work.ctx
    const cx = w * Number(p.x)
    const cy = h * Number(p.y)
    const width = w * Number(p.width)
    const height = h * Number(p.height)

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, w, h)
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = '#ffffff'
    c.filter = Number(p.feather) > 0 ? `blur(${Number(p.feather)}px)` : 'none'
    c.translate(cx, cy)
    c.rotate((Number(p.rotation) * Math.PI) / 180)

    if (p.shape === 'linear') {
      const gradient = c.createLinearGradient(-width / 2, 0, width / 2, 0)
      gradient.addColorStop(0, 'rgba(255,255,255,0)')
      gradient.addColorStop(1, '#ffffff')
      c.fillStyle = gradient
      c.fillRect(-width / 2, -height / 2, width, height)
    } else if (p.shape === 'radial') {
      const radius = Math.max(1, Math.min(width, height) / 2)
      const gradient = c.createRadialGradient(0, 0, 0, 0, 0, radius)
      gradient.addColorStop(0, '#ffffff')
      gradient.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = gradient
      c.beginPath()
      c.ellipse(0, 0, width / 2, height / 2, 0, 0, Math.PI * 2)
      c.fill()
    } else {
      c.beginPath()
      shapePath(c, p.shape, width, height)
      c.fill()
    }

    c.filter = 'none'
    c.restore()

    const out = target.ctx
    out.save()
    out.setTransform(1, 0, 0, 1, 0, 0)
    out.clearRect(0, 0, target.width, target.height)
    if (p.invert) {
      out.fillStyle = '#ffffff'
      out.fillRect(0, 0, target.width, target.height)
      out.globalCompositeOperation = 'destination-out'
    }
    out.drawImage(work.canvas, 0, 0)
    out.restore()
    return { out: target.canvas }
  },
}
