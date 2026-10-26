import type { NodeDefinition } from '../../engine/types'

export type Shape2DKind = 'rectangle' | 'ellipse' | 'triangle' | 'diamond' | 'star' | 'polygon'

export interface Shape2DParams {
  shape: Shape2DKind
  width: number
  height: number
  scale: number
  x: number
  y: number
  rotation: number
  sides: number
  innerRadius: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
}

function pathFor(
  c: CanvasRenderingContext2D,
  shape: Shape2DKind,
  w: number,
  h: number,
  p: Shape2DParams,
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
  if (shape === 'diamond') {
    c.moveTo(0, -hh)
    c.lineTo(hw, 0)
    c.lineTo(0, hh)
    c.lineTo(-hw, 0)
    c.closePath()
    return
  }
  if (shape === 'star') {
    const points = 5
    const inner = Math.min(hw, hh) * Math.min(1, Math.max(0.05, Number(p.innerRadius)))
    const outer = Math.min(hw, hh)
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outer : inner
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.closePath()
    return
  }

  const sides = Math.max(3, Math.round(Number(p.sides)))
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(angle) * hw
    const y = Math.sin(angle) * hh
    if (i === 0) c.moveTo(x, y)
    else c.lineTo(x, y)
  }
  c.closePath()
}

/**
 * 2D-fasong på et gjennomsiktig lerret. Størrelse og posisjon er relativ til
 * grafen, så formen følger outputformatet.
 */
export const shape2D: NodeDefinition<Shape2DParams> = {
  type: 'source.shape2D',
  label: '2D-fasong',
  category: 'source',
  description:
    'Tegner rektangel, ellipse, trekant, diamant, stjerne eller polygon på et gjennomsiktig lerret.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    {
      key: 'shape', label: 'Fasong', type: 'enum', default: 'ellipse',
      options: [
        { value: 'rectangle', label: 'Rektangel' },
        { value: 'ellipse', label: 'Ellipse' },
        { value: 'triangle', label: 'Trekant' },
        { value: 'diamond', label: 'Diamant' },
        { value: 'star', label: 'Stjerne' },
        { value: 'polygon', label: 'Polygon' },
      ],
    },
    { key: 'width', label: 'Bredde', type: 'number', default: 0.4, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'height', label: 'Høyde', type: 'number', default: 0.4, min: 0, max: 2, step: 0.01, animatable: true },
    { key: 'scale', label: 'Universell skala', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01, animatable: true },
    { key: 'x', label: 'X', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'y', label: 'Y', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'rotation', label: 'Rotasjon', type: 'number', default: 0, min: -360, max: 360, step: 1, animatable: true },
    { key: 'sides', label: 'Kanter', type: 'int', default: 6, min: 3, max: 24, animatable: false },
    { key: 'innerRadius', label: 'Indre radius', type: 'number', default: 0.45, min: 0.05, max: 1, step: 0.01, animatable: true },
    { key: 'fill', label: 'Fyll', type: 'color', default: '#b9ff66' },
    { key: 'stroke', label: 'Kant', type: 'color', default: '#ffffff' },
    { key: 'strokeWidth', label: 'Kantbredde', type: 'number', default: 0, min: 0, max: 50, step: 0.5, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const scale = Math.max(0.01, Number(p.scale))
    const w = target.width * Number(p.width) * scale
    const h = target.height * Number(p.height) * scale

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalAlpha = Math.min(1, Math.max(0, Number(p.opacity)))
    c.globalCompositeOperation = 'source-over'
    c.translate(target.width * Number(p.x), target.height * Number(p.y))
    c.rotate((Number(p.rotation) * Math.PI) / 180)

    c.beginPath()
    pathFor(c, p.shape, w, h, p)
    c.fillStyle = String(p.fill)
    c.fill()
    if (Number(p.strokeWidth) > 0) {
      c.lineWidth = Number(p.strokeWidth)
      c.strokeStyle = String(p.stroke)
      c.stroke()
    }

    c.restore()
    return { out: target.canvas }
  },
}
