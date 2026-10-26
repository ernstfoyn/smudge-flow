import type { BufferGeometry } from 'three'
import type { NodeDefinition } from '../../engine/types'
import { identityTransform, type Object3DValue, type ShadingMode } from '../../render/three/object3d'
import { TEXT3D_FONTS } from '../../render/three/textFonts'

export type KineticMode =
  | 'cylinder'
  | 'field'
  | 'stripes'
  | 'coil'
  | 'flag'
  | 'morisawa'
  | 'cascade'
  | 'ribbon'
  | 'layers'
  | 'danger'
  | 'string'
  | 'badge'
  | 'clutter'
  | 'construct'
  | 'snap'
  | 'flash'
  | 'pow'
  | 'crash'
  | 'crashclock'
  | 'vessel'
  | 'shine'
  | 'boost'
  | 'boxsquad'

export const KINETIC_MODES: Array<{ value: KineticMode; label: string }> = [
  { value: 'cylinder', label: 'Cylinder' },
  { value: 'field', label: 'Field' },
  { value: 'stripes', label: 'Stripes' },
  { value: 'coil', label: 'Coil' },
  { value: 'flag', label: 'Flag' },
  { value: 'morisawa', label: 'Morisawa' },
  { value: 'cascade', label: 'Cascade' },
  { value: 'ribbon', label: 'Ribbon' },
  { value: 'layers', label: 'Layers' },
  { value: 'danger', label: 'Danger' },
  { value: 'string', label: 'String' },
  { value: 'badge', label: 'Badge' },
  { value: 'clutter', label: 'Clutter' },
  { value: 'construct', label: 'Construct' },
  { value: 'snap', label: 'Snap' },
  { value: 'flash', label: 'Flash' },
  { value: 'pow', label: 'Pow' },
  { value: 'crash', label: 'Crash' },
  { value: 'crashclock', label: 'Crash Clock' },
  { value: 'vessel', label: 'Vessel' },
  { value: 'shine', label: 'Shine' },
  { value: 'boost', label: 'Boost' },
  { value: 'boxsquad', label: 'BoxSquad' },
]

export interface KineticTextParams {
  text: string
  mode: KineticMode
  font: string
  size: number
  depth: number
  segments: number
  stacks: number
  radius: number
  stackSpacing: number
  spin: number
  offset: number
  waveCycles: number
  waveAmplitude: number
  stretchY: number
  color: string
  shading: string
  roughness: number
  metalness: number
  opacity: number
  emissive: string
}

interface LetterTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

const DEG = Math.PI / 180
const TAU = Math.PI * 2

function deg(radians: number): number {
  return (((radians / DEG) % 360) + 360) % 360
}

function hash(x: number, y: number, seed = 1): number {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7) * 1.13) * 43758.5453
  return value - Math.floor(value)
}

function transformFor(
  mode: KineticMode,
  index: number,
  stack: number,
  count: number,
  stacks: number,
  params: KineticTextParams,
  spinAngle: number,
  wavePhase: number,
  pie: number,
): LetterTransform {
  const size = Math.max(0.01, Number(params.size))
  const radius = Math.max(0.01, Number(params.radius))
  const stackSpacing = Math.max(0.01, Number(params.stackSpacing))
  const amplitude = Math.max(0, Number(params.waveAmplitude))
  const stretch = Math.max(0, Number(params.stretchY))
  const wave = Math.sin(wavePhase + index * pie * Math.max(0, Number(params.waveCycles)) + stack * 0.7)
  const gridX = (index - (count - 1) / 2) * size * 2.2
  const gridY = (stack - (stacks - 1) / 2) * stackSpacing
  const base: LetterTransform = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1 + wave * stretch, z: 1 },
  }

  switch (mode) {
    case 'cylinder':
    case 'construct': {
      const angle = spinAngle + stack * Number(params.offset) * DEG + index * pie
      const radial = radius + wave * amplitude
      return {
        ...base,
        position: {
          x: Math.sin(angle) * radial,
          y: gridY + Math.cos(wavePhase + index * pie) * amplitude * 0.35,
          z: Math.cos(angle) * radial,
        },
        rotation: { x: 0, y: deg(angle), z: 0 },
      }
    }

    case 'coil': {
      const total = stacks * count
      const global = stack * count + index
      const angle = spinAngle + global * pie + stack * Number(params.offset) * DEG
      const radial = radius + wave * amplitude
      return {
        ...base,
        position: {
          x: Math.sin(angle) * radial,
          y: (global - (total - 1) / 2) * stackSpacing * 0.35,
          z: Math.cos(angle) * radial,
        },
        rotation: { x: 0, y: deg(angle), z: 0 },
      }
    }

    case 'ribbon': {
      const angle = spinAngle + index * pie + stack * Number(params.offset) * DEG
      const radial = radius + wave * amplitude
      return {
        ...base,
        position: {
          x: Math.sin(angle) * radial,
          y: gridY + wave * amplitude,
          z: Math.cos(angle) * radial,
        },
        rotation: { x: 0, y: deg(angle), z: wave * 25 },
      }
    }

    case 'field':
    case 'boxsquad':
    case 'shine':
    case 'boost':
    case 'morisawa':
    case 'snap':
    case 'stripes': {
      let x = gridX
      let y = gridY
      let z = wave * amplitude
      let rz = 0
      let sx = 1
      let sy = base.scale.y
      if (mode === 'morisawa') {
        x += (stack % 2) * size * 1.1
      } else if (mode === 'stripes') {
        rz = stack % 2 === 0 ? 0 : 180
      } else if (mode === 'snap') {
        x = Math.round(x / (size * 1.1)) * size * 1.1
        y = Math.round(y / (size * 1.1)) * size * 1.1
        rz = index % 2 === 0 ? 0 : 90
      } else if (mode === 'shine') {
        z = wave * amplitude * 1.5
        sx = sy = 1 + (wave + 1) * 0.3 * stretch
      } else if (mode === 'boost') {
        sx = sy = 1 + (stack + 1) / stacks * 0.8 + Math.abs(wave) * 0.4
      } else if (mode === 'boxsquad') {
        sx = sy = 0.86
      }
      return {
        ...base,
        position: { x, y, z },
        rotation: { x: wave * 12, y: 0, z: rz },
        scale: { x: sx, y: sy, z: 1 },
      }
    }

    case 'flag': {
      return {
        ...base,
        position: { x: gridX, y: gridY, z: wave * amplitude * 2 },
        rotation: { x: wave * 30, y: 0, z: 0 },
      }
    }

    case 'layers': {
      return {
        ...base,
        position: {
          x: gridX,
          y: 0,
          z: (stack - (stacks - 1) / 2) * stackSpacing * 3,
        },
        rotation: { x: 0, y: 0, z: stack * 10 + wave * stretch * 20 },
      }
    }

    case 'cascade': {
      return {
        ...base,
        position: {
          x: gridX + stack * size * 1.4,
          y: gridY - index * size * 1.4,
          z: wave * amplitude,
        },
        rotation: { x: 0, y: 0, z: -15 },
      }
    }

    case 'danger': {
      return {
        ...base,
        position: { x: gridX, y: gridY, z: 0 },
        rotation: { x: 0, y: 0, z: 90 },
      }
    }

    case 'string': {
      return {
        ...base,
        position: { x: gridX, y: wave * amplitude * 2, z: 0 },
        rotation: { x: 0, y: 0, z: wave * 8 },
      }
    }

    case 'badge':
    case 'vessel':
    case 'crashclock': {
      const angle = spinAngle + index * pie
      const ring = radius + stack * stackSpacing * (mode === 'badge' ? 0.3 : 0.7)
      return {
        ...base,
        position: {
          x: Math.cos(angle) * ring,
          y: Math.sin(angle) * ring,
          z: wave * amplitude,
        },
        rotation: {
          x: 0,
          y: 0,
          z: mode === 'crashclock' ? deg(angle) : deg(angle + Math.PI / 2),
        },
      }
    }

    case 'clutter': {
      return {
        ...base,
        position: {
          x: gridX + (hash(index, stack, 1) - 0.5) * size * 2,
          y: gridY + (hash(index, stack, 2) - 0.5) * size * 2,
          z: (hash(index, stack, 3) - 0.5) * amplitude * 2,
        },
        rotation: { x: 0, y: 0, z: hash(index, stack, 4) * 360 },
      }
    }

    case 'flash':
    case 'pow': {
      const angle = spinAngle + index * pie
      const distance = radius * (0.25 + ((stack + 1) / stacks) * 0.9)
      return {
        ...base,
        position: {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          z: wave * amplitude,
        },
        rotation: { x: 0, y: 0, z: deg(angle) },
        scale: {
          x: 0.6 + (stack + 1) / stacks * 0.8,
          y: 0.6 + (stack + 1) / stacks * 0.8,
          z: 1,
        },
      }
    }

    case 'crash': {
      return {
        ...base,
        position: {
          x: (hash(index, stack, 5) - 0.5) * radius * 2,
          y: (hash(index, stack, 6) - 0.5) * radius * 2,
          z: (hash(index, stack, 7) - 0.5) * radius,
        },
        rotation: {
          x: hash(index, stack, 8) * 180,
          y: hash(index, stack, 9) * 180,
          z: hash(index, stack, 10) * 360,
        },
      }
    }
  }
}

/**
 * Kinetic type, inspirert av Space Type Generator.
 *
 * Alle variantene deler samme bokstavgeometri og animasjonsklokke. `spin` og
 * `waveCycles` er heltall, så fase 0 og 1 gir samme transform og loopen lukker
 * seg eksakt.
 */
export const kineticText: NodeDefinition<KineticTextParams> = {
  type: 'source.kineticText',
  label: 'Kinetic type',
  category: 'source',
  description:
    'Kinetic typografi inspirert av Space Type Generator: cylinder, field, stripes, coil, flag, cascade, ribbon, layers, badge, crash og flere.',
  inputs: [],
  outputs: [{ id: 'out', label: 'Objekt', type: 'object3d' }],
  params: [
    { key: 'text', label: 'Tekst', type: 'text', default: 'SPACE TYPE' },
    { key: 'mode', label: 'Variant', type: 'enum', default: 'cylinder', options: KINETIC_MODES },
    {
      key: 'font', label: 'Font', type: 'enum', default: 'droid-sans-regular',
      options: TEXT3D_FONTS.map((font) => ({ value: font.value, label: font.label })),
    },
    { key: 'size', label: 'Bokstavstørrelse', type: 'number', default: 0.22, min: 0.02, max: 1, step: 0.01, animatable: true },
    { key: 'depth', label: 'Tykkelse', type: 'number', default: 0.02, min: 0, max: 0.5, step: 0.005, animatable: true },
    { key: 'segments', label: 'Kurver', type: 'int', default: 6, min: 1, max: 24 },
    { key: 'stacks', label: 'Ringer / rader', type: 'int', default: 3, min: 1, max: 12, animatable: false },
    { key: 'radius', label: 'Ringradius / spredning', type: 'number', default: 1.1, min: 0.1, max: 5, step: 0.01, animatable: true },
    { key: 'stackSpacing', label: 'Radavstand', type: 'number', default: 0.34, min: 0.02, max: 2, step: 0.01, animatable: true },
    { key: 'spin', label: 'Rotasjon per loop', type: 'int', default: 1, min: -4, max: 4, animatable: true },
    { key: 'offset', label: 'Forskyvning per rad', type: 'number', default: 0, min: -180, max: 180, step: 1, animatable: true },
    { key: 'waveCycles', label: 'Bølger per loop', type: 'int', default: 1, min: 0, max: 8, animatable: false },
    { key: 'waveAmplitude', label: 'Bølgeutslag', type: 'number', default: 0.12, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'stretchY', label: 'Vertikal strekk', type: 'number', default: 0.15, min: 0, max: 1, step: 0.01, animatable: true },
    {
      key: 'shading', label: 'Materialmodus', type: 'enum', default: 'standard',
      options: [
        { value: 'standard', label: 'Standard' },
        { value: 'wireframe', label: 'Wireframe' },
        { value: 'normals', label: 'Normaler' },
      ],
    },
    { key: 'color', label: 'Farge', type: 'color', default: '#b9ff66' },
    { key: 'roughness', label: 'Ruhet', type: 'number', default: 0.35, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'metalness', label: 'Metallhet', type: 'number', default: 0.25, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'emissive', label: 'Selvlys', type: 'color', default: '#000000' },
  ],
  async evaluate(ctx, _inputs, p) {
    const { buildTextGeometry } = await import('../../render/three/textGeometry')
    const text = String(p.text ?? '')
    const chars = Array.from(text).filter((char) => char.trim() !== '')
    const size = Math.max(0.01, Number(p.size))
    const depth = Math.max(0, Number(p.depth))
    const font = String(p.font ?? 'droid-sans-regular')
    const segments = Math.max(1, Math.round(Number(p.segments)))
    const stacks = Math.max(1, Math.round(Number(p.stacks)))
    const spinAngle = ctx.phase * TAU * Math.round(Number(p.spin))
    const waveCycles = Math.max(0, Math.round(Number(p.waveCycles)))
    const wavePhase = ctx.phase * TAU * waveCycles
    const pie = chars.length ? TAU / chars.length : TAU

    let geometries = ctx.nodeCache.get('letterGeometries') as Map<string, BufferGeometry> | undefined
    if (!geometries) {
      geometries = new Map()
      ctx.nodeCache.set('letterGeometries', geometries)
    }

    const children: Object3DValue[] = []
    if (!chars.length) return { out: { ...material(p), children, transform: identityTransform() } }

    for (let stack = 0; stack < stacks; stack++) {
      for (let index = 0; index < chars.length; index++) {
        const char = chars[index]
        const key = `${char}|${font}|${size}|${depth}|${segments}`
        let geometry = geometries.get(key)
        if (!geometry) {
          geometry = await buildTextGeometry({ text: char, font, size, depth, segments })
          geometries.set(key, geometry)
        }
        const transform = transformFor(
          p.mode,
          index,
          stack,
          chars.length,
          stacks,
          p,
          spinAngle,
          wavePhase,
          pie,
        )
        children.push({ ...material(p), geometry, transform })
      }
    }

    return { out: { ...material(p), children, transform: identityTransform() } }
  },
}

function material(p: KineticTextParams): Object3DValue {
  return {
    color: String(p.color),
    roughness: Number(p.roughness),
    metalness: Number(p.metalness),
    opacity: Number(p.opacity),
    emissive: String(p.emissive),
    shading: String(p.shading ?? 'standard') as ShadingMode,
    transform: identityTransform(),
  }
}
