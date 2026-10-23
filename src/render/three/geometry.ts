import * as THREE from 'three'
import { type MeshShape } from './meshShapes'

export type { MeshShape } from './meshShapes'
export { MESH_SHAPES } from './meshShapes'

/**
 * Bygger prosedural geometri.
 *
 * Polyedrene (oktaeder, dodekaeder, tetraeder) holdes flate — detaljnivået
 * ville gjort dem til kuler. Ikosfæren er den rundede varianten, med
 * segmenttallet som underdelingsnivå.
 */
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
    case 'torusKnot':
      return new THREE.TorusKnotGeometry(s, s * 0.32, seg * 12, seg * 2, 2, 3)
    case 'plane':
      return new THREE.PlaneGeometry(s * 2, s * 2, seg, seg)
    case 'cylinder':
      return new THREE.CylinderGeometry(s, s, s * 2, seg * 4)
    case 'cone':
      return new THREE.ConeGeometry(s, s * 2, seg * 4)
    case 'capsule':
      return new THREE.CapsuleGeometry(s * 0.6, s * 1.2, Math.min(seg, 16), seg * 3)
    case 'ring':
      return new THREE.RingGeometry(s * 0.55, s, seg * 4, 1)
    case 'disk':
      return new THREE.CircleGeometry(s, seg * 4)
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(s, seg)
    case 'icosphere':
      return new THREE.IcosahedronGeometry(s, Math.min(Math.max(1, Math.round(seg / 3)), 5))
    case 'octahedron':
      return new THREE.OctahedronGeometry(s, 0)
    case 'dodecahedron':
      return new THREE.DodecahedronGeometry(s, 0)
    case 'tetrahedron':
      return new THREE.TetrahedronGeometry(s, 0)
    case 'box':
    default:
      return new THREE.BoxGeometry(s * 2, s * 2, s * 2, seg, seg, seg)
  }
}
