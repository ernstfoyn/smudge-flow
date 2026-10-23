import type { NodeDefinition } from '../../engine/types'
import {
  composeTransform,
  identityTransform,
  type Object3DValue,
  type Transform3D,
} from '../../render/three/object3d'

export interface Scatter3DParams {
  pattern: 'ring' | 'disk' | 'sphere' | 'grid' | 'line' | 'spiral'
  count: number
  radius: number
  jitter: number
  sizeJitter: number
  rotationSpread: number
  wave: number
  waveTurns: number
  spin: number
}

const GOLDEN_ANGLE = 2.399963229728653
const TAU = Math.PI * 2

/**
 * Deterministisk 0..1-hash.
 *
 * Vi bruker ikke Math.random: samme frø må gi samme plassering i hver
 * frame, ellers ville eksporten og forhåndsvisningen sprike.
 */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

interface Point {
  x: number
  y: number
  z: number
}

/** Posisjon i mønsteret, før radius og jitter. */
function patternPoint(pattern: Scatter3DParams['pattern'], i: number, count: number): Point {
  const t = count <= 1 ? 0 : i / (count - 1)
  const angle = i * GOLDEN_ANGLE

  switch (pattern) {
    case 'disk':
      return {
        x: Math.cos(angle) * Math.sqrt(t),
        y: 0,
        z: Math.sin(angle) * Math.sqrt(t),
      }
    case 'sphere': {
      // Fibonacci-kule: jevn fordeling uten klynger ved polene.
      const y = count <= 1 ? 0 : 1 - (2 * (i + 0.5)) / count
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      return { x: Math.cos(angle) * r, y, z: Math.sin(angle) * r }
    }
    case 'grid': {
      const n = Math.max(1, Math.ceil(Math.sqrt(count)))
      const col = i % n
      const row = Math.floor(i / n)
      const fx = n <= 1 ? 0 : col / (n - 1) - 0.5
      const fz = n <= 1 ? 0 : row / (n - 1) - 0.5
      return { x: fx * 2, y: 0, z: fz * 2 }
    }
    case 'line':
      return { x: (t - 0.5) * 2, y: 0, z: 0 }
    case 'spiral':
      return {
        x: Math.cos(t * TAU * 2) * t,
        y: (t - 0.5) * 1.5,
        z: Math.sin(t * TAU * 2) * t,
      }
    case 'ring':
    default:
      return { x: Math.cos(angle), y: 0, z: Math.sin(angle) }
  }
}

/**
 * Sprer kopier av et 3D-objekt ut i et mønster.
 *
 * Dette er «instanser» i vår modell: en gruppe med like barn, hver med
 * sin egen transform. Fordelen fremfor ekte GPU-instancing er at hver
 * kopi kan arve hele hierarkiet (grupper, materialer, animasjon) og
 * fortsatt behandles som ett objekt av scenen.
 *
 * Bølgen er fasebasert og lukker seg når `waveTurns` er et heltall.
 */
export const scatter3D: NodeDefinition<Scatter3DParams> = {
  type: 'modifier.scatter3D',
  label: 'Spredning',
  category: 'modifier',
  description:
    'Kopierer et 3D-objekt i ring, skive, kule, grid, linje eller spiral — med jitter og loop-sikker bølge.',
  inputs: [{ id: 'in', label: 'Objekt', type: 'object3d' }],
  outputs: [{ id: 'out', label: 'Gruppe', type: 'object3d' }],
  params: [
    {
      key: 'pattern', label: 'Mønster', type: 'enum', default: 'ring',
      options: [
        { value: 'ring', label: 'Ring' },
        { value: 'disk', label: 'Skive' },
        { value: 'sphere', label: 'Kule' },
        { value: 'grid', label: 'Grid' },
        { value: 'line', label: 'Linje' },
        { value: 'spiral', label: 'Spiral' },
      ],
    },
    { key: 'count', label: 'Antall', type: 'int', default: 6, min: 1, max: 128 },
    { key: 'radius', label: 'Radius', type: 'number', default: 1.2, min: 0, max: 5, step: 0.01, animatable: true },
    { key: 'jitter', label: 'Jitter', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'sizeJitter', label: 'Størrelsesvariasjon', type: 'number', default: 0, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'rotationSpread', label: 'Rotasjonsspredning', type: 'number', default: 0.1, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'wave', label: 'Bølge', type: 'number', default: 0.2, min: 0, max: 1, step: 0.01, animatable: true },
    { key: 'waveTurns', label: 'Bølger per loop', type: 'int', default: 1, min: 0, max: 4 },
    { key: 'spin', label: 'Spinn per loop', type: 'int', default: 0, min: 0, max: 4 },
  ],
  evaluate(ctx, { in: input }, p) {
    const base = input as Object3DValue | undefined
    const count = Math.max(1, Math.round(Number(p.count)))
    const radius = Number(p.radius)
    const jitter = Number(p.jitter)
    const sizeJitter = Number(p.sizeJitter)
    const spread = Number(p.rotationSpread)
    const wave = Number(p.wave)
    const waveTurns = Math.round(Number(p.waveTurns))
    const spin = Math.round(Number(p.spin))
    // Wrap fasen: ved fase 1 er vi eksakt tilbake på starten, ikke 360,0000°.
    const phase = ctx.phase % 1

    if (!base) {
      return {
        out: {
          color: '#ffffff',
          roughness: 1,
          metalness: 0,
          opacity: 1,
          emissive: '#000000',
          transform: identityTransform(),
          children: [],
        } satisfies Object3DValue,
      }
    }

    const children: Object3DValue[] = []

    for (let i = 0; i < count; i++) {
      const t = count <= 1 ? 0 : i / (count - 1)
      const point = patternPoint(p.pattern ?? 'ring', i, count)

      // Bølgen bruker fase, ikke sekunder, så den lukker seg eksakt.
      const pulse =
        Math.sin((phase * waveTurns + t * 0.5) * TAU) * wave * radius * 0.5

      const offset: Transform3D = {
        position: {
          x: point.x * radius + (hash01(i * 3.1 + 1) - 0.5) * jitter * radius * 0.4,
          y: point.y * radius + pulse + (hash01(i * 3.1 + 2) - 0.5) * jitter * radius * 0.4,
          z: point.z * radius + (hash01(i * 3.1 + 3) - 0.5) * jitter * radius * 0.4,
        },
        rotation: {
          x: 0,
          // Fast spredning per kopi + felles spinn som går opp i hele omdreininger.
          y: t * spread * 360 + ((phase * 360 * spin) % 360),
          z: 0,
        },
        scale: (() => {
          const s = 1 - sizeJitter * hash01(i * 5.7)
          return { x: s, y: s, z: s }
        })(),
      }

      children.push({
        ...base,
        transform: composeTransform(base.transform, offset),
      })
    }

    return {
      out: {
        color: '#ffffff',
        roughness: 1,
        metalness: 0,
        opacity: 1,
        emissive: '#000000',
        transform: identityTransform(),
        children,
      } satisfies Object3DValue,
    }
  },
}
