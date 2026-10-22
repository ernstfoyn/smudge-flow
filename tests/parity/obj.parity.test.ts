import { describe, expect, it } from 'vitest'
import { loadLegacy } from './loadLegacy'
import { parseOBJ } from '../../src/render/geometry/obj'

/**
 * Paritet: den nye OBJ-parseren skal gi IDENTISK geometri som
 * public/orbit/obj-import.js.
 */
const legacy = loadLegacy<{
  parseOBJ: (text: string) => {
    vertices: number[][]
    triangles: number[][]
    normals: number[][]
  }
}>('orbit/obj-import.js')

const KUBE = `
# en kube
v -1 -1 -1
v  1 -1 -1
v  1  1 -1
v -1  1 -1
v -1 -1  1
v  1 -1  1
v  1  1  1
v -1  1  1
f 1 3 2 1
f 1 4 3 1
f 5 6 7 5
f 5 7 8 5
f 1 2 6 1
f 1 6 5 1
f 2 3 7 2
f 2 7 6 2
f 3 4 8 3
f 3 8 7 3
f 4 1 5 4
f 4 5 8 4
`

const PYRAMIDE = `
v 0 1 0
v -1 0 -1
v 1 0 -1
v 1 0 1
v -1 0 1
f 1 2 3
f 1 3 4
f 1 4 5
f 1 5 2
f 2 5 4 3
`

describe('paritet: OBJ-parser', () => {
  it('kube gir identiske vertex, trekanter og normaler', () => {
    const a = parseOBJ(KUBE)
    const b = legacy.parseOBJ(KUBE)

    expect(a.vertices).toEqual(b.vertices)
    expect(a.triangles).toEqual(b.triangles)
    expect(a.normals).toEqual(b.normals)
  })

  it('pyramide gir identisk resultat', () => {
    const a = parseOBJ(PYRAMIDE)
    const b = legacy.parseOBJ(PYRAMIDE)

    expect(a.vertices).toEqual(b.vertices)
    expect(a.triangles).toEqual(b.triangles)
    expect(a.normals).toEqual(b.normals)
  })

  it('kvadratiske flater trianguleres med ear clipping', () => {
    const a = parseOBJ(KUBE)
    const b = legacy.parseOBJ(KUBE)
    // Hver firkant blir to trekanter.
    expect(a.triangles).toHaveLength(24)
    expect(a.triangles.length).toBe(b.triangles.length)
  })

  it('avviser ugyldige filer likt som originalen', () => {
    expect(() => parseOBJ('')).toThrow()
    expect(() => parseOBJ('v 0 0 0')).toThrow()
    expect(() => parseOBJ('v 0 0 0\nf 1 2')).toThrow()
    expect(() => parseOBJ('v 0 0 0\nf 1 2 9')).toThrow()
  })

  it('normaliserer modellen til sentrum og enhetsstørrelse', () => {
    const model = parseOBJ(`
v 10 20 30
v 14 20 30
v 10 24 30
f 1 2 3
`)
    const xs = model.vertices.map((v) => v[0])
    const ys = model.vertices.map((v) => v[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 6)
    // Y er vendt, så +Y i OBJ blir -Y hos oss.
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1, 6)
  })
})
