import * as THREE from 'three'

export type MeshShape =
  | 'box'
  | 'sphere'
  | 'torus'
  | 'plane'
  | 'cylinder'
  | 'icosahedron'

export const MESH_SHAPES: Array<{ id: MeshShape; label: string }> = [
  { id: 'box', label: 'Boks' },
  { id: 'sphere', label: 'Kule' },
  { id: 'torus', label: 'Torus' },
  { id: 'plane', label: 'Plan' },
  { id: 'cylinder', label: 'Sylinder' },
  { id: 'icosahedron', label: 'Ikosaeder' },
]

/** Bygger prosedural geometri. */
export function buildGeometry(
  shape: MeshShape,
  size: number,
  segments: number,
): THREE.BufferGeometry {
  const s = Math.max(0.05, size)
  const seg = Math.max(3, Math.round(segments))
  switch (shape) {
    case 'sphere':
      return new THREE.SphereGeometry(s, seg * 8, seg * 4)
    case 'torus':
      return new THREE.TorusGeometry(s, s * 0.35, seg * 4, seg * 8)
    case 'plane':
      return new THREE.PlaneGeometry(s * 2, s * 2, seg, seg)
    case 'cylinder':
      return new THREE.CylinderGeometry(s, s, s * 2, seg * 4)
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(s, seg)
    case 'box':
    default:
      return new THREE.BoxGeometry(s * 2, s * 2, s * 2, seg, seg, seg)
  }
}
