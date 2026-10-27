import type { NodeDefinition } from '../../engine/types'
import type { GradientStop } from '../../engine/color/gradient'
import { gradientPaintBox } from '../../render/raster/gradientFill'

export interface Text2DParams {
  text: string
  size: number
  scale: number
  font: string
  weight: string
  color: string
  /** Flerfarge-gradient når gradient er slått på. */
  gradient?: boolean
  stops?: GradientStop[]
  gradientAngle?: number
  align: 'left' | 'center' | 'right'
  x: number
  y: number
  lineHeight: number
  opacity: number
}

/**
 * 2D-tekst på lerretet. Bakgrunnen er gjennomsiktig, så noden kan brukes
 * som tittel eller tekstlag oppå bilder og video.
 */
export const text2D: NodeDefinition<Text2DParams> = {
  type: 'source.text2D',
  label: '2D-tekst',
  category: 'source',
  description:
    'Tegner tekst på et gjennomsiktig lerret. Bruk den til titler, undertekster og tekstlag oppå bilder.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'text', label: 'Tekst', type: 'text', default: 'SMUDGE' },
    { key: 'size', label: 'Størrelse', type: 'number', default: 120, min: 8, max: 1000, step: 1, animatable: true },
    { key: 'scale', label: 'Universell skala', type: 'number', default: 1, min: 0.01, max: 10, step: 0.01, animatable: true },
    {
      key: 'font', label: 'Font', type: 'enum', default: 'ui-sans-serif',
      options: [
        { value: 'ui-sans-serif, system-ui, sans-serif', label: 'System' },
        { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
        { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica' },
        { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
        { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
        { value: 'Gill Sans, Gill Sans MT, Calibri, sans-serif', label: 'Gill Sans' },
        { value: 'Georgia, serif', label: 'Georgia' },
        { value: 'Times New Roman, Times, serif', label: 'Times' },
        { value: 'Palatino Linotype, Book Antiqua, Palatino, serif', label: 'Palatino' },
        { value: 'Courier New, monospace', label: 'Courier' },
        { value: 'Impact, sans-serif', label: 'Impact' },
      ],
    },
    {
      key: 'weight', label: 'Vekt', type: 'enum', default: '700',
      options: [
        { value: '400', label: 'Normal' },
        { value: '600', label: 'Halvfet' },
        { value: '700', label: 'Fet' },
        { value: '900', label: 'Ekstra fet' },
      ],
    },
    {
      key: 'color', label: 'Farge', type: 'color', default: '#ffffff',
      showWhen: { key: 'gradient', in: [false] },
    },
    { key: 'gradient', label: 'Gradientfyll', type: 'boolean', default: false },
    {
      key: 'stops', label: 'Fargestopp', type: 'gradient', default: [],
      showWhen: { key: 'gradient', in: [true] },
    },
    {
      key: 'gradientAngle', label: 'Gradientvinkel', type: 'number', default: 0,
      min: -180, max: 180, animatable: true,
      showWhen: { key: 'gradient', in: [true] },
    },
    {
      key: 'align', label: 'Justering', type: 'enum', default: 'center',
      options: [
        { value: 'left', label: 'Venstre' },
        { value: 'center', label: 'Midtstilt' },
        { value: 'right', label: 'Høyre' },
      ],
    },
    { key: 'x', label: 'X', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'y', label: 'Y', type: 'number', default: 0.5, min: -1, max: 2, step: 0.01, animatable: true },
    { key: 'lineHeight', label: 'Linjeavstand', type: 'number', default: 1.1, min: 0.5, max: 3, step: 0.05, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, _inputs, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const size = Math.max(1, Number(p.size) * Math.max(0.01, Number(p.scale)))
    const lines = String(p.text ?? '').split('\n')
    const lineHeight = size * Number(p.lineHeight)

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalAlpha = Math.min(1, Math.max(0, Number(p.opacity)))
    c.globalCompositeOperation = 'source-over'
    c.font = `${p.weight} ${size}px ${p.font}`
    c.textAlign = p.align
    c.textBaseline = 'middle'

    c.save()
    c.translate(target.width * Number(p.x), target.height * Number(p.y))

    const blockHeight = (lines.length - 1) * lineHeight
    if (p.gradient) {
      const maxWidth = Math.max(1, ...lines.map((line) => c.measureText(line).width))
      const left =
        p.align === 'center' ? -maxWidth / 2 : p.align === 'right' ? -maxWidth : 0
      c.fillStyle = gradientPaintBox(
        c,
        {
          x: left,
          y: -blockHeight / 2 - size / 2,
          width: maxWidth,
          height: blockHeight + size,
        },
        {
          fill: 'linear',
          colorA: String(p.color),
          colorB: '#4bdac5',
          stops: p.stops,
          angle: Number(p.gradientAngle ?? 0),
          travel: 0,
          density: 1,
        },
      )
    } else {
      c.fillStyle = String(p.color)
    }

    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], 0, -blockHeight / 2 + i * lineHeight)
    }

    c.restore()
    c.restore()
    return { out: target.canvas }
  },
}
