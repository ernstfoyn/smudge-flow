import type { BufferGeometry } from 'three'

/**
 * Verditypen for 3D-objekter i grafen.
 *
 * Dette er den andre "domenen" i systemet: 2D-raster på den ene siden,
 * 3D-objekter på den andre. Begge kan møtes i samme graf, og
 * composite.sceneRender er broen som maler 3D ned på et raster-lerret.
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
  geometry: BufferGeometry
  color: string
  roughness: number
  metalness: number
  opacity: number
  emissive: string
  transform: Transform3D
}

export function identityTransform(): Transform3D {
  return {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }
}

export function cloneObject(value: Object3DValue): Object3DValue {
  return {
    ...value,
    transform: {
      position: { ...value.transform.position },
      rotation: { ...value.transform.rotation },
      scale: { ...value.transform.scale },
    },
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
