/**
 * Formlisten for 3D-kilden.
 *
 * Ligger i en egen fil uten three-import, slik at node-definisjonen kan
 * bruke listen statisk uten å dra inn 3D-biblioteket ved oppstart.
 *
 * Utvalget følger vgpu/scene sine geometrier (box, sphere, cone, capsule,
 * cylinder, disk, ring, plane, torus, oktaeder, dodekaeder, tetraeder,
 * ikosaeder, ikosfære) — se https://github.com/vercel-labs/vgpu.
 */
export type MeshShape =
  | 'box'
  | 'sphere'
  | 'torus'
  | 'torusKnot'
  | 'plane'
  | 'cylinder'
  | 'cone'
  | 'capsule'
  | 'ring'
  | 'disk'
  | 'icosahedron'
  | 'icosphere'
  | 'octahedron'
  | 'dodecahedron'
  | 'tetrahedron'

export const MESH_SHAPES: ReadonlyArray<{ id: MeshShape; label: string }> = [
  { id: 'box', label: 'Boks' },
  { id: 'sphere', label: 'Kule' },
  { id: 'torus', label: 'Torus' },
  { id: 'torusKnot', label: 'Torusknute' },
  { id: 'plane', label: 'Plan' },
  { id: 'cylinder', label: 'Sylinder' },
  { id: 'cone', label: 'Kjegle' },
  { id: 'capsule', label: 'Kapsel' },
  { id: 'ring', label: 'Ring' },
  { id: 'disk', label: 'Skive' },
  { id: 'icosahedron', label: 'Ikosaeder' },
  { id: 'icosphere', label: 'Ikosfære' },
  { id: 'octahedron', label: 'Oktaeder' },
  { id: 'dodecahedron', label: 'Dodekaeder' },
  { id: 'tetrahedron', label: 'Tetraeder' },
]
