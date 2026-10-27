import type { NodeDefinition } from '../../engine/types'
import { sourceSize } from '../../render/sourceSize'

export type Scatter2DPattern = 'line' | 'ring' | 'grid' | 'disk' | 'spiral'
export type Scatter2DMotion = 'none' | 'float' | 'drift' | 'orbit' | 'pulse' | 'wobble' | 'fade'

export interface Scatter2DParams {
  pattern: Scatter2DPattern
  count: number
  spacing: number
  radius: number
  columns: number
  motion: Scatter2DMotion
  motionAmount: number
  motionCycles: number
  phaseOffset: number
  spin: number
  rotationSpread: number
  scaleJitter: number
  opacity: number
}

export interface Scatter2DInstance {
  x: number
  y: number
  rotation: number
  scale: number
  opacity: number
}

const GOLDEN_ANGLE = 2.399963229728653
const TAU = Math.PI * 2

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function scatter2DCount(p: Scatter2DParams): number {
  return Math.max(1, Math.min(64, Math.round(Number(p.count ?? 8))))
}

/** Posisjonen til klonen i forhold til inngangens midtpunkt. */
export function scatter2DPoint(
  p: Scatter2DParams,
  index: number,
  count: number,
): { x: number; y: number } {
  const spacing = Number(p.spacing ?? 80)
  const radius = Number(p.radius ?? 220)
  const columns = Math.max(1, Math.min(count, Math.round(Number(p.columns ?? 3))))
  const rows = Math.ceil(count / columns)
  const t = count <= 1 ? 0 : index / (count - 1)
  const angle = (index / Math.max(1, count)) * TAU

  switch (p.pattern) {
    case 'line':
      return { x: (index - (count - 1) / 2) * spacing, y: 0 }
    case 'ring':
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    case 'grid':
      return {
        x: (index % columns - (columns - 1) / 2) * spacing,
        y: (Math.floor(index / columns) - (rows - 1) / 2) * spacing,
      }
    case 'disk': {
      const a = index * GOLDEN_ANGLE
      const r = Math.sqrt(t) * radius
      return { x: Math.cos(a) * r, y: Math.sin(a) * r }
    }
    case 'spiral':
    default: {
      const a = t * TAU * 2
      return { x: Math.cos(a) * t * radius, y: Math.sin(a) * t * radius }
    }
  }
}

/** Transformen til én klone ved en gitt fase. Ren funksjon, brukes også av Lottie. */
export function scatter2DInstance(
  p: Scatter2DParams,
  index: number,
  count: number,
  phase: number,
): Scatter2DInstance {
  const point = scatter2DPoint(p, index, count)
  const t = count <= 1 ? 0 : index / (count - 1)
  const cycles = Math.max(1, Math.round(Number(p.motionCycles ?? 1)))
  const offset = index * Number(p.phaseOffset ?? 0.15)
  const f = ((phase + offset) % 1) * TAU * cycles
  const amount = Number(p.motionAmount ?? 60)
  let x = point.x
  let y = point.y
  let rotation = t * 360 * Number(p.rotationSpread ?? 0) + phase * 360 * Math.round(Number(p.spin ?? 0))
  let scale = 1 - clamp(Number(p.scaleJitter ?? 0), 0, 1) * hash01(index * 5.7) * 0.75
  let opacity = 1

  switch (p.motion) {
    case 'float':
      y += Math.sin(f) * amount
      break
    case 'drift':
      x += Math.sin(f) * amount
      break
    case 'orbit':
      x += Math.cos(f) * amount
      y += Math.sin(f) * amount
      break
    case 'pulse':
      scale *= 1 + Math.sin(f) * (amount / 200)
      break
    case 'wobble':
      rotation += Math.sin(f) * amount
      break
    case 'fade':
      opacity *= 1 - ((1 - Math.cos(f)) / 2) * clamp(amount / 100, 0, 1)
      break
    case 'none':
    default:
      break
  }

  return { x, y, rotation, scale, opacity }
}

interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Finner den synlige delen av inngangen, slik at klonene roterer og skalerer
 * rundt objektets eget midtpunkt og ikke hele lerretet.
 */
function alphaBounds(input: CanvasImageSource, ctx: { render: { versionOf(value: unknown): number }; nodeCache: Map<string, unknown> }): Bounds {
  const size = sourceSize(input)
  const width = Math.max(1, size.width)
  const height = Math.max(1, size.height)

  if (typeof HTMLCanvasElement === 'undefined' || !(input instanceof HTMLCanvasElement)) {
    return { x: 0, y: 0, w: width, h: height }
  }

  const version = ctx.render.versionOf(input)
  const cached = ctx.nodeCache.get('bounds') as { version: number; bounds: Bounds } | undefined
  if (cached && cached.version === version) return cached.bounds

  let bounds: Bounds = { x: 0, y: 0, w: width, h: height }
  try {
    const data = input.getContext('2d')?.getImageData(0, 0, width, height).data
    if (data) {
      let minX = width
      let minY = height
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (data[(y * width + x) * 4 + 3] <= 8) continue
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
      if (maxX >= minX && maxY >= minY) {
        bounds = {
          x: Math.max(0, minX - 1),
          y: Math.max(0, minY - 1),
          w: Math.min(width, maxX - minX + 3),
          h: Math.min(height, maxY - minY + 3),
        }
      } else {
        bounds = { x: 0, y: 0, w: 0, h: 0 }
      }
    }
  } catch {
    // Tainted canvas eller manglende 2D-kontekst: bruk hele flaten.
  }
  ctx.nodeCache.set('bounds', { version, bounds })
  return bounds
}

/**
 * 2D-kloner — den gamle appens cloner, men med friere bevegelse.
 *
 * Den kopierer et 2D-lag i line, ring, grid, disk eller spiral. Hver klone kan
 * få egen fase, rotasjon, skala og opacity, med loop-sikre bevegelser.
 */
export const scatter2D: NodeDefinition<Scatter2DParams> = {
  type: 'modifier.scatter2D',
  label: '2D-kloner',
  category: 'modifier',
  description:
    'Kopierer et 2D-lag i line, ring, grid, disk eller spiral. Hver klone kan animeres med float, drift, orbit, puls, vugging eller fade.',
  timeDependent: (params) =>
    String(params.motion ?? 'none') !== 'none' || Math.round(Number(params.spin ?? 0)) !== 0,
  inputs: [{ id: 'in', label: 'Inn', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Kloner', type: 'canvas' }],
  params: [
    {
      key: 'pattern', label: 'Mønster', type: 'enum', default: 'line',
      options: [
        { value: 'line', label: 'Linje' },
        { value: 'ring', label: 'Ring' },
        { value: 'grid', label: 'Grid' },
        { value: 'disk', label: 'Skive' },
        { value: 'spiral', label: 'Spiral' },
      ],
    },
    { key: 'count', label: 'Antall', type: 'int', default: 8, min: 1, max: 64 },
    { key: 'spacing', label: 'Avstand', type: 'number', default: 90, min: 0, max: 800, step: 1, animatable: true },
    { key: 'radius', label: 'Radius', type: 'number', default: 240, min: 0, max: 2000, step: 1, animatable: true },
    { key: 'columns', label: 'Kolonner', type: 'int', default: 3, min: 1, max: 16 },
    {
      key: 'motion', label: 'Bevegelse', type: 'enum', default: 'none',
      options: [
        { value: 'none', label: 'Ingen' },
        { value: 'float', label: 'Flyt' },
        { value: 'drift', label: 'Drift' },
        { value: 'orbit', label: 'Bane' },
        { value: 'pulse', label: 'Puls' },
        { value: 'wobble', label: 'Vugging' },
        { value: 'fade', label: 'Fade' },
      ],
    },
    { key: 'motionAmount', label: 'Utslag', type: 'number', default: 60, min: 0, max: 400, step: 1, animatable: true },
    { key: 'motionCycles', label: 'Sykluser per loop', type: 'int', default: 1, min: 1, max: 8 },
    { key: 'phaseOffset', label: 'Faseforskyvning', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'spin', label: 'Spinn per loop', type: 'int', default: 0, min: 0, max: 4 },
    { key: 'rotationSpread', label: 'Rotasjonsspredning', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'scaleJitter', label: 'Størrelsesvariasjon', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const w = target.width
    const h = target.height
    const count = scatter2DCount(p)

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.clearRect(0, 0, w, h)

    if (!input) {
      c.restore()
      return { out: target.canvas }
    }

    const source = input as CanvasImageSource
    const bounds = alphaBounds(source, ctx)
    if (bounds.w <= 0 || bounds.h <= 0) {
      c.restore()
      return { out: target.canvas }
    }

    const cx = bounds.x + bounds.w / 2
    const cy = bounds.y + bounds.h / 2
    const alpha = clamp(Number(p.opacity ?? 1), 0, 1)
    const phase = ctx.phase % 1

    for (let i = 0; i < count; i++) {
      const item = scatter2DInstance(p, i, count, phase)
      c.save()
      c.globalAlpha = alpha * clamp(item.opacity, 0, 1)
      c.translate(cx + item.x, cy + item.y)
      c.rotate((item.rotation * Math.PI) / 180)
      c.scale(item.scale, item.scale)
      c.drawImage(
        source,
        bounds.x,
        bounds.y,
        bounds.w,
        bounds.h,
        -bounds.w / 2,
        -bounds.h / 2,
        bounds.w,
        bounds.h,
      )
      c.restore()
    }

    c.restore()
    return { out: target.canvas }
  },
}
