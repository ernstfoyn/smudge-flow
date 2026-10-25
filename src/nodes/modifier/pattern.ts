import type { NodeDefinition } from '../../engine/types'
import { sourceSize } from '../../render/sourceSize'

export type PatternMode = 'grid' | 'echo'

export interface PatternParams {
  size: number
  cell: number
  shiftX: number
  shiftY: number
  squeeze: number
  compression: number
  rotation: number
  randomMotion: number
  speed: number
  mode: PatternMode
  mono: boolean
  background: string
  transparent: boolean
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

/**
 * Fragmentert prisme, portet fra patternable.
 *
 * Ett bilde bygges som ett glyph-lag og tegnes på nytt inn i hvert rutenett.
 * Hver rute klippes og forskyves etter kolonne og rad, med valgfri squeeze,
 * kompresjon, rotasjon og per-rute jitter.
 */
export const patternNode: NodeDefinition<PatternParams> = {
  type: 'modifier.pattern',
  label: 'Fragmentprisme',
  category: 'modifier',
  description:
    'Deler bildet inn i et rutenett der hver rute viser et forskjøvet utsnitt. Gir patternable-effekten med squeeze, kompresjon, rotasjon og animert jitter.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Bilde', type: 'canvas' }],
  params: [
    { key: 'size', label: 'Glyphstørrelse', type: 'number', default: 400, min: 10, max: 1500, step: 10, animatable: true },
    { key: 'cell', label: 'Rutestørrelse', type: 'number', default: 80, min: 8, max: 240, step: 2, animatable: true },
    { key: 'shiftX', label: 'Gridforskyvning X', type: 'number', default: 40, min: 0, max: 160, step: 1, animatable: true },
    { key: 'shiftY', label: 'Gridforskyvning Y', type: 'number', default: 30, min: 0, max: 160, step: 1, animatable: true },
    { key: 'squeeze', label: 'Squeeze', type: 'number', default: 0, min: -50, max: 50, step: 1, animatable: true },
    { key: 'compression', label: 'Kompresjon Y', type: 'number', default: 0, min: 0, max: 100, step: 1, animatable: true },
    { key: 'rotation', label: 'Rotasjon per rute', type: 'number', default: 0, min: 0, max: 50, step: 1, animatable: true },
    { key: 'randomMotion', label: 'Tilfeldig bevegelse', type: 'number', default: 15, min: 0, max: 100, step: 1, animatable: true },
    { key: 'speed', label: 'Bevegelsesfart', type: 'number', default: 0.6, min: 0, max: 5, step: 0.1, animatable: true },
    {
      key: 'mode', label: 'Mønster', type: 'enum', default: 'grid',
      options: [
        { value: 'grid', label: 'Word (tett rutenett)' },
        { value: 'echo', label: 'Sentence (midtrad + diagonaler)' },
      ],
    },
    { key: 'mono', label: 'Svart/hvitt', type: 'boolean', default: false },
    { key: 'background', label: 'Bakgrunn', type: 'color', default: '#ffffff' },
    { key: 'transparent', label: 'Gjennomsiktig bakgrunn', type: 'boolean', default: false },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const w = target.width
    const h = target.height

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.clearRect(0, 0, w, h)
    if (!p.transparent) {
      c.fillStyle = String(p.background)
      c.fillRect(0, 0, w, h)
    }
    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    // Bygg glyph-laget på nytt hver frame. Det gjør at video og animerte
    // bilder virker, og at animert glyphstørrelse følger med.
    const size = clamp(Number(p.size), 10, 1500)
    const source = input as CanvasImageSource
    const sourceDimensions = sourceSize(source)
    const pad = 20
    const imageW = size * 0.8
    const aspect =
      sourceDimensions.width > 0 && sourceDimensions.height > 0
        ? sourceDimensions.height / sourceDimensions.width
        : 1
    const imageH = imageW * aspect
    const cssW = Math.ceil(imageW) + pad
    const cssH = Math.ceil(imageH) + pad

    let glyph = ctx.nodeCache.get('glyph') as HTMLCanvasElement | undefined
    if (!glyph) {
      glyph = document.createElement('canvas')
      ctx.nodeCache.set('glyph', glyph)
    }
    if (glyph.width !== cssW || glyph.height !== cssH) {
      glyph.width = cssW
      glyph.height = cssH
    }
    const g = glyph.getContext('2d')!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, cssW, cssH)
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
    if (p.mono) g.filter = 'grayscale(1) contrast(1.13)'
    g.drawImage(source, pad / 2, pad / 2, imageW, imageH)
    g.filter = 'none'

    const boxRaw = clamp(Number(p.cell), 8, 240)
    const box = Math.max(8, Math.round(boxRaw))
    const centerX = w / 2
    const centerY = h / 2
    const time = ctx.phase * ctx.totalFrames * Number(p.speed)
    const shiftX = Number(p.shiftX)
    const shiftY = Number(p.shiftY)
    const squeeze = Number(p.squeeze)
    const compression = Number(p.compression)
    const rotation = Number(p.rotation)
    const randomMotion = Number(p.randomMotion)

    const drawCell = (col: number, row: number) => {
      const cx = centerX + col * box
      const cy = centerY + row * box
      const left = cx - box / 2
      const top = cy - box / 2
      if (cx + box < 0 || cx - box > w || cy + box < 0 || cy - box > h) return

      const dx = -col * shiftX
      const dy = -row * shiftY
      const distance = Math.sqrt(col * col + row * row)

      let motionX = 0
      let motionY = 0
      if (randomMotion > 0) {
        const boxId = left * 0.01 + top * 0.01
        const m = randomMotion
        const p1x = Math.sin(time * 0.005 + boxId * 2.3) * (m * 1.2)
        const p1y = Math.cos(time * 0.007 + boxId * 1.7) * (m * 0.9)
        const p2x = Math.sin(time * 0.012 + boxId * 4.1) * (m * 0.8)
        const p2y = Math.cos(time * 0.009 + boxId * 3.5) * (m * 0.7)
        const p3x = Math.sin(time * 0.003 + boxId * 1.1) * (m * 0.6)
        const p3y = Math.cos(time * 0.004 + boxId * 0.9) * (m * 0.5)
        const p4x = Math.sin(time * 0.018 + boxId * 6.7) * (m * 0.6)
        const p4y = Math.cos(time * 0.015 + boxId * 5.2) * (m * 0.5)
        const p5x = Math.sin(time * 0.008 + boxId * 3.9) * (m * 0.7)
        const p5y = Math.cos(time * 0.011 + boxId * 4.8) * (m * 0.6)
        const p6x = Math.sin(time * 0.025 + boxId * 8.3) * (m * 0.3)
        const p6y = Math.cos(time * 0.022 + boxId * 7.1) * (m * 0.4)
        const bigX = Math.sin(time * 0.002 + boxId * 1.5) * (m * 1.5)
        const bigY = Math.cos(time * 0.0015 + boxId * 1.2) * (m * 1.0)
        motionX = p1x + p2x + p3x + p4x + p5x + p6x + bigX
        motionY = p1y + p2y + p3y + p4y + p5y + p6y + bigY
      }

      const maxStretch = Math.abs(squeeze) * 0.02
      let scaleY = 1
      if (row === 0) {
        scaleY = 1 + (squeeze > 0 ? maxStretch : -maxStretch)
      } else {
        const stretchFactor = Math.max(0, (maxStretch * (6 - Math.abs(row))) / 6)
        scaleY = 1 + (squeeze > 0 ? stretchFactor : -stretchFactor)
      }
      if (compression > 0) {
        scaleY *= Math.max(0.1, 1 - distance * compression * 0.015)
      }

      const rotationAngle = rotation > 0 && distance > 0 ? distance * rotation * 0.8 : 0
      const gx = cx + dx + motionX - cssW / 2
      const gy = cy + dy + motionY - cssH / 2

      c.save()
      c.beginPath()
      c.rect(left, top, box, box)
      c.clip()
      c.translate(cx, cy)
      if (rotationAngle !== 0) c.rotate((rotationAngle * Math.PI) / 180)
      c.scale(1, scaleY)
      c.translate(-cx, -cy)
      c.drawImage(glyph, 0, 0, cssW, cssH, gx, gy, cssW, cssH)
      c.restore()
    }

    const colMin = Math.floor((0 - centerX) / box) - 1
    const colMax = Math.ceil((w - centerX) / box) + 1
    const rowMin = Math.floor((0 - centerY) / box) - 1
    const rowMax = Math.ceil((h - centerY) / box) + 1

    if (p.mode === 'grid') {
      for (let row = rowMin; row <= rowMax; row++) {
        for (let col = colMin; col <= colMax; col++) drawCell(col, row)
      }
    } else {
      for (let col = colMin; col <= colMax; col++) drawCell(col, 0)
      for (let row = rowMin; row <= rowMax; row++) {
        if (row !== 0) drawCell(0, row)
      }
      const side = Math.max(Math.abs(colMin), Math.abs(colMax))
      const diagMax = Math.max(Math.abs(rowMin), Math.abs(rowMax))
      for (let diag = 1; diag <= diagMax; diag++) {
        for (let i = 1; i <= side; i++) {
          const right = i + diag
          const left = -i - diag
          drawCell(right, -diag)
          drawCell(right, diag)
          drawCell(left, -diag)
          drawCell(left, diag)
        }
      }
    }

    c.restore()
    return { out: target.canvas }
  },
}
