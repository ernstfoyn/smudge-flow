import type { BufferGeometry } from 'three'

/**
 * Verditypen for 3D-objekter i grafen.
 *
 * Dette er den andre "domenen" i systemet: 2D-raster på den ene siden,
 * 3D-objekter på den andre. Begge kan møtes i samme graf, og
 * composite.sceneRender er broen som maler 3D ned på et raster-lerret.
 *
 * Et objekt kan være en *gruppe*: da er `geometry` tom og `children`
 * inneholder barna. Gruppen har sin egen transform, som gjelder hele
 * treet under — det er det som gjør at en samling objekter kan flyttes
 * som én.
 *
 * Merk: fila bruker bare *type*-import av three, slik at ingen av
 * 3D-biblioteket lastes før det faktisk trengs.
 */
export interface Transform3D {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: { x: number; y: number; z: number }
}

export interface Object3DValue {
  /** Tom for grupper (som bare har barn). */
  geometry?: BufferGeometry
  color: string
  roughness: number
  metalness: number
  opacity: number
  emissive: string
  transform: Transform3D
  /** Skjult uten å fjerne objektet (kan animeres). */
  visible?: boolean
  /** Barn — gjør objektet til en gruppe. */
  children?: Object3DValue[]
}

export function identityTransform(): Transform3D {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
}

export function applyTransform(value: Object3DValue, transform: Transform3D): Object3DValue {
  return {
    ...value,
    transform: {
      position: { ...transform.position },
      rotation: { ...transform.rotation },
      scale: { ...transform.scale },
    },
  }
}

/**
 * Legger en transform *oppå* objektets egen.
 *
 * Dette er motsatt av applyTransform, som erstatter. Å legge oppå er det
 * som gjør kjeder meningsfulle: en transform først, en «håndtak»-node
 * etterpå, og begge bidrar.
 */
export function composeTransform(
  base: Transform3D,
  delta: Transform3D,
): Transform3D {
  return {
    position: {
      x: base.position.x + delta.position.x,
      y: base.position.y + delta.position.y,
      z: base.position.z + delta.position.z,
    },
    rotation: {
      x: base.rotation.x + delta.rotation.x,
      y: base.rotation.y + delta.rotation.y,
      z: base.rotation.z + delta.rotation.z,
    },
    scale: {
      x: base.scale.x * delta.scale.x,
      y: base.scale.y * delta.scale.y,
      z: base.scale.z * delta.scale.z,
    },
  }
}
