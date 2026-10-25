import type { NodeDefinition } from '../../engine/types'

export interface Text2DParams {
  text: string
  size: number
  font: string
  weight: string
  color: string
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
    {
      key: 'font', label: 'Font', type: 'enum', default: 'ui-sans-serif',
      options: [
        { value: 'ui-sans-serif', label: 'System' },
        { value: 'Georgia, serif', label: 'Georgia' },
        { value: 'Courier New, monospace', label: 'Courier' },
        { value: 'Impact, sans-serif', label: 'Impact' },
        { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet' },
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
    { key: 'color', label: 'Farge', type: 'color', default: '#ffffff' },
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
    const size = Math.max(1, Number(p.size))
    const lines = String(p.text ?? '').split('\n')

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, target.width, target.height)
    c.globalAlpha = Math.min(1, Math.max(0, Number(p.opacity)))
    c.globalCompositeOperation = 'source-over'
    c.font = `${p.weight} ${size}px ${p.font}`
    c.fillStyle = String(p.color)
    c.textAlign = p.align
    c.textBaseline = 'middle'

    const lineHeight = size * Number(p.lineHeight)
    const start = target.height * Number(p.y) - ((lines.length - 1) * lineHeight) / 2
    for (let i = 0; i < lines.length; i++) {
      c.fillText(lines[i], target.width * Number(p.x), start + i * lineHeight)
    }

    c.restore()
    return { out: target.canvas }
  },
}
