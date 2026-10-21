import * as THREE from 'three'
import type { Object3DValue } from './object3d'

/**
 * Bygger en three.js-mesh fra verdien.
 * Ligger i en egen modul, slik at three.js lastes kun når 3D faktisk brukes.
 */
export function toMesh(value: Object3DValue): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(value.color),
    roughness: value.roughness,
    metalness: value.metalness,
    transparent: value.opacity < 1,
    opacity: value.opacity,
    emissive: new THREE.Color(value.emissive),
  })

  const mesh = new THREE.Mesh(value.geometry, material)
  const { position, rotation, scale } = value.transform
  mesh.position.set(position.x, position.y, position.z)
  mesh.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  )
  mesh.scale.set(scale.x, scale.y, scale.z)
  return mesh
}
