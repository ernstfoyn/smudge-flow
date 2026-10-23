/**
 * Animasjonspresets fra den opprinnelige Smudge/Orbit-appen.
 *
 * Dette er rene samplere: de får bare en fase (0..1), aldri klokketid.
 * Alle bevegelser bruker sin/cos med et heltall sykluser per loop, slik
 * at verdien ved fase 1 er identisk med verdien ved fase 0.
 *
 * 2D-presetene er «Objektbevegelse» fra tekst/2D-objekter. 3D-presetene
 * er «Animasjonspreset» fra Orbit, inkludert faseforskyvning per kopi.
 */

const TAU = Math.PI * 2

export type Motion2DPreset =
  | 'none'
  | 'float'
  | 'slide'
  | 'orbit'
  | 'wobble'
  | 'pulse'
  | 'fade'

export const MOTION2D_PRESETS: Array<{ value: Motion2DPreset; label: string }> = [
  { value: 'none', label: 'Ingen' },
  { value: 'float', label: 'Svev' },
  { value: 'slide', label: 'Gli' },
  { value: 'orbit', label: 'Sirkelbane' },
  { value: 'wobble', label: 'Vugging' },
  { value: 'pulse', label: 'Puls' },
  { value: 'fade', label: 'Fade' },
]

export type Motion3DPreset =
  | 'none'
  | 'orbit'
  | 'wave'
  | 'grid'
  | 'spiral'
  | 'swarm'
  | 'spin'
  | 'pulse'

export const MOTION3D_PRESETS: Array<{ value: Motion3DPreset; label: string }> = [
  { value: 'none', label: 'Ingen · kun keyframes' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'wave', label: 'Bølge' },
  { value: 'grid', label: 'Rutenett / dybdebølge' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'swarm', label: 'Sverm' },
  { value: 'spin', label: 'Vuggende rotasjon' },
  { value: 'pulse', label: 'Puls' },
]

export interface Motion2DState {
  x: number
  y: number
  /** Rotasjon i grader. */
  rotation: number
  scale: number
  opacity: number
}

export interface Motion3DDelta {
  position: { x: number; y: number; z: number }
  /** Rotasjon i grader. */
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

const GOLDEN_ANGLE = 2.399963229728653

/**
 * Pakker fasen slik at 1 og 0 gir nøyaktig samme resultat.
 * Vi pakker bare grunnfasen, ikke faseforskyvningen, slik at en
 * per-kopi-forskyvning heller ikke driver ved loop-slutt.
 */
export function wrapPhase(phase: number): number {
  const p = Number.isFinite(phase) ? phase : 0
  return p - Math.floor(p)
}

/** Legger en fast startfase oppå loopen, fortsatt innenfor 0..1. */
export function offsetPhase(phase: number, offset: number): number {
  const p = wrapPhase(phase) + (Number.isFinite(offset) ? offset : 0)
  return p - Math.floor(p)
}

/** Felles vinkelfaktor: hele sykluser per loop. */
function motionAngle(phase: number, cycles: number): number {
  return wrapPhase(phase) * TAU * Math.max(1, Math.round(cycles))
}

/**
 * 2D-bevegelse. `amplitude` er i piksler, som i den opprinnelige appen.
 * Fade og puls tolker likevel utslaget som en andel (0..500), slik at
 * standardverdien 80 gir en myk, men tydelig effekt.
 */
export function sampleMotion2D(
  preset: string,
  phase: number,
  amplitude: number,
  cycles: number,
): Motion2DState {
  const f = motionAngle(phase, cycles)
  const state: Motion2DState = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }

  switch (preset) {
    case 'float':
      state.y = Math.sin(f) * amplitude
      break
    case 'slide':
      state.x = Math.sin(f) * amplitude
      break
    case 'orbit':
      state.x = Math.cos(f) * amplitude
      state.y = Math.sin(f) * amplitude
      break
    case 'wobble':
      state.rotation = (Math.sin(f) * amplitude) / 500 * Math.PI
      break
    case 'pulse': {
      const amount = Math.min(0.9, amplitude / 500)
      state.scale = 1 + Math.sin(f) * amount
      break
    }
    case 'fade': {
      const amount = Math.min(1, amplitude / 100)
      state.opacity = 1 - ((1 - Math.cos(f)) / 2) * amount
      break
    }
    case 'none':
    default:
      break
  }

  return state
}

/**
 * 3D-bevegelse. Utslaget er i scenens enheter, tilpasset
 * standardkameraet i `composite.sceneRender`. `strength` er en
 * prosentfaktor (100 = normal), som i den opprinnelige appen.
 *
 * `index`/`count` gjør at spiral og sverm fordeler seg utover, og
 * `phaseOffset` gir hver kopi sin egen fase når noden brukes etter
 * `modifier.scatter3D`.
 */
export function sampleMotion3D(
  preset: string,
  phase: number,
  strength: number,
  cycles: number,
  index = 0,
  count = 1,
  phaseOffset = 0,
): Motion3DDelta {
  const amount = strength / 100
  const f = motionAngle(phase, cycles) + index * phaseOffset * TAU
  const delta: Motion3DDelta = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }

  switch (preset) {
    case 'orbit':
      delta.position.x = Math.cos(f) * 0.75 * amount
      delta.position.z = Math.sin(f) * 0.75 * amount
      delta.position.y = Math.sin(f * 2) * 0.2 * amount
      break
    case 'wave':
      delta.position.y = Math.sin(f) * 0.7 * amount
      delta.position.z = Math.cos(f) * 0.3 * amount
      break
    case 'grid':
      delta.position.z = Math.sin(f) * 0.6 * amount
      delta.rotation.x = Math.sin(f) * 30 * amount
      break
    case 'spiral': {
      const radius = (0.3 + 0.5 * ((index + 0.5) / Math.max(1, count))) * amount
      delta.position.x = Math.cos(f) * radius
      delta.position.z = Math.sin(f) * radius
      delta.position.y = Math.sin(f * 2) * 0.4 * amount
      break
    }
    case 'swarm': {
      const seed = index * GOLDEN_ANGLE
      delta.position.x = Math.sin(f + seed) * 0.75 * amount
      delta.position.y = Math.cos(f * 2 + seed) * 0.5 * amount
      delta.position.z = Math.sin(f * 3 + seed) * 0.75 * amount
      break
    }
    case 'spin':
      delta.rotation.y = Math.sin(f) * 180 * amount
      delta.rotation.x = Math.cos(f) * 30 * amount
      break
    case 'pulse': {
      const scale = 1 + Math.sin(f) * 0.45 * amount
      delta.scale = { x: scale, y: scale, z: scale }
      break
    }
    case 'none':
    default:
      break
  }

  return delta
}
