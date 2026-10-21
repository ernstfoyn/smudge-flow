/**
 * Port av public/orbit/motion-graphics.js (Smudge_animator @ 81cf506).
 *
 * Deterministisk lokal geometri for grafiske looper: prikkefelt, fliser,
 * vifte, striper og ovaler. Samme inngang gir alltid samme utdata, så
 * preview og eksport blir bit-identiske.
 */

export type MotionMode = 'dotfield' | 'tiles' | 'fan' | 'stripes' | 'lozenges'

export interface MotionProperties {
  motion: MotionMode
  count: number
  columns: number
  spacing: number
  phaseOffset: number
  lineWidth: number
  size: number
  spread: number
  amplitude: number
  centerX: number
  centerY: number
  opacity: number
  scale: number
  rotation: number
  speed: number
  colorA: string
  colorB: string
}

export interface MotionItem {
  x: number
  y: number
  size: number
  rotation: number
  sx: number
  sy: number
  shape: 'circle' | 'rectangle'
}

export const MOTION_MODES: Array<{ id: MotionMode; label: string }> = [
  { id: 'dotfield', label: 'Prikkefelt' },
  { id: 'tiles', label: 'Fliser' },
  { id: 'fan', label: 'Vifte' },
  { id: 'stripes', label: 'Striper' },
  { id: 'lozenges', label: 'Ovaler' },
]

export function sample(
  p: MotionProperties,
  phase: number,
  w: number,
  h: number,
): MotionItem[] {
  const count = Math.max(1, Math.min(100, Math.round(p.count)))
  const cols = Math.max(1, Math.round(p.columns || 8))
  const rows = Math.ceil(count / cols)
  const unit = Math.min(w, h) / 960
  const spacing = (p.spacing || 70) * unit * (p.spread / 100)
  const amplitude = p.amplitude / 100
  const theta = phase * Math.PI * 2 * p.speed

  return Array.from({ length: count }, (_, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const f = theta + (col + row) * (p.phaseOffset ?? 0.12) * Math.PI * 2
    const pulse = 1 + (p.scale / 100) * Math.sin(f)

    const item: MotionItem = {
      x: (w * p.centerX) / 100 + (col - (cols - 1) / 2) * spacing,
      y: (h * p.centerY) / 100 + (row - (rows - 1) / 2) * spacing,
      size: p.size * unit,
      rotation: 0,
      sx: 1,
      sy: 1,
      shape: 'circle',
    }

    if (p.motion === 'dotfield') {
      item.size *= pulse * (0.35 + (0.65 * (1 + Math.sin(f))) / 2)
      item.y += Math.sin(f) * spacing * 0.3 * amplitude
    } else if (p.motion === 'tiles') {
      item.shape = 'rectangle'
      item.size *= pulse
      item.x += Math.sin(f) * spacing * 0.4 * amplitude
      item.y += Math.cos(f) * spacing * 0.2 * amplitude
      item.rotation = (Math.sin(f) * p.rotation) / 100 * (Math.PI / 2)
    } else if (p.motion === 'fan') {
      const angle = (i / (Math.max(1, count - 1)) - 0.5) * Math.PI * (0.1 + (0.8 * (1 + Math.sin(theta))) / 2) * amplitude
      const length = p.size * unit * 4
      item.shape = 'rectangle'
      item.size = length
      item.sx = Math.max(0.006, (p.lineWidth || 3) / Math.max(1, p.size * 4))
      item.sy = 1
      item.rotation = angle
      item.x = (w * p.centerX) / 100 + Math.sin(angle) * (length / 2)
      item.y = (h * p.centerY) / 100 - Math.cos(angle) * (length / 2)
    } else if (p.motion === 'stripes') {
      item.shape = 'rectangle'
      item.x = (w * p.centerX) / 100 + Math.sin(theta + i * 0.25) * spacing * 0.35 * amplitude
      item.y = (h * p.centerY) / 100 + (i - (count - 1) / 2) * (p.lineWidth || 3) * unit * 3
      item.size *= 3 * pulse
      item.sy = Math.max(0.008, (p.lineWidth || 3) / Math.max(1, p.size * 3))
    } else if (p.motion === 'lozenges') {
      item.shape = 'circle'
      item.sx = pulse
      item.sy = 0.15 + (0.85 * (1 + Math.sin(f))) / 2
      item.y += Math.sin(f) * spacing * 0.25 * amplitude
      item.rotation = (Math.sin(f) * p.rotation) / 100 * (Math.PI / 2)
    }

    return item
  })
}
