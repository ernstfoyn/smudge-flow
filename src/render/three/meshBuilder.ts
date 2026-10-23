import * as THREE from 'three'
import type { Object3DValue } from './object3d'

/**
 * Bygger en three.js-mesh fra verdien.
 * Ligger i en egen modul, slik at three.js lastes kun når 3D faktisk brukes.
 */
export function toMesh(value: Object3DValue): THREE.Mesh {
  const mesh = new THREE.Mesh(value.geometry, materialFor(value))
  applyToObject(mesh, value)
  return mesh
}

/**
 * Bygger et three.js-objekt — mesh eller gruppe, rekursivt.
 *
 * Gruppenes transform gjelder hele treet under, slik at en samling
 * objekter kan flyttes, roteres og skaleres som én enhet.
 */
export function toObject3D(value: Object3DValue): THREE.Object3D {
  const object: THREE.Object3D = value.geometry
    ? new THREE.Mesh(value.geometry, materialFor(value))
    : new THREE.Group()

  applyToObject(object, value)

  if (value.children?.length) {
    const container = object as THREE.Group
    for (const child of value.children) container.add(toObject3D(child))
  }

  return object
}

function materialFor(value: Object3DValue): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(value.color),
    roughness: value.roughness,
    metalness: value.metalness,
    transparent: value.opacity < 1,
    opacity: value.opacity,
    emissive: new THREE.Color(value.emissive),
  })
}

function applyToObject(object: THREE.Object3D, value: Object3DValue): void {
  const { position, rotation, scale } = value.transform
  object.position.set(position.x, position.y, position.z)
  object.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  )
  object.scale.set(scale.x, scale.y, scale.z)
  object.visible = value.visible !== false
  object.userData.opacity = value.opacity
}
