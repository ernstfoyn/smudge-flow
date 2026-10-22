/**
 * OBJ-import.
 *
 * Port av public/orbit/obj-import.js i Smudge_animator @ 81cf506.
 * Parseren er uendret; det nye er at resultatet blir en three.js-geometri
 * i stedet for en bærbar OBJ-tekst.
 *
 * Vikling skjer med ear clipping, som håndterer konkave flater —
 * en triangulær «vifte» gjør ikke det.
 */

export interface ParsedModel {
  /** Normaliserte vertex-posisjoner. */
  vertices: number[][]
  /** Trekanter som indekser inn i vertices. */
  triangles: number[][]
  /** Normalen per trekant. */
  normals: number[][]
}

const MAX_VERTICES = 100_000
const MAX_TRIANGLES = 150_000

export function parseOBJ(text: string): ParsedModel {
  const vertices: number[][] = []
  const faces: number[][] = []

  for (const raw of text.split(/\r?\n/)) {
    const parts = raw.split('#')[0].trim().split(/\s+/)
    const token = parts.shift()
    if (token === 'v') {
      const v = parts.slice(0, 3).map(Number)
      if (v.length !== 3 || v.some((n) => !Number.isFinite(n))) {
        throw new Error('Ugyldig vertex i OBJ-filen.')
      }
      vertices.push(v)
    } else if (token === 'f') {
      if (parts.length < 3) throw new Error('En OBJ-flate må ha minst tre hjørner.')
      const face = parts.map((part) => {
        const index = Number(part.split('/')[0])
        if (!Number.isInteger(index) || !index) throw new Error('Ugyldig OBJ-indeks.')
        const resolved = index < 0 ? vertices.length + index : index - 1
        if (resolved < 0 || resolved >= vertices.length) {
          throw new Error('OBJ-indeksen peker utenfor modellen.')
        }
        return resolved
      })
      faces.push(face)
    }
    if (vertices.length > MAX_VERTICES || faces.length > MAX_VERTICES) {
      throw new Error('Modellen er for stor. Maks 100 000 vertex/flater.')
    }
  }

  if (!vertices.length || !faces.length) {
    throw new Error('OBJ-filen må inneholde vertex og flater.')
  }

  // Normaliser til sentrum, og sentrer størrelsen.
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  vertices.forEach((v) => {
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], v[a])
      max[a] = Math.max(max[a], v[a])
    }
  })
  const extent = Math.max(...max.map((m, a) => m - min[a]))
  if (!(extent > 0)) throw new Error('Modellen har ingen utstrekning.')

  // OBJ bruker +Y opp, p5 og three bruker +Y ned. Vend Y én gang.
  const normalized = vertices.map((v) =>
    v.map((n, a) => ((n - (min[a] + max[a]) / 2) / extent) * (a === 1 ? -1 : 1)),
  )

  const triangles: number[][] = []
  for (const face of faces) {
    const polygon = face.map((index) => ({ index, point: normalized[index] }))

    // Finn normalen, og projeksjonen vi triangulerer i.
    const normal = [0, 0, 0]
    polygon.forEach((v, i) => {
      const a = v.point
      const b = polygon[(i + 1) % polygon.length].point
      normal[0] += (a[1] - b[1]) * (a[2] + b[2])
      normal[1] += (a[2] - b[2]) * (a[0] + b[0])
      normal[2] += (a[0] - b[0]) * (a[1] + b[1])
    })
    const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)))
    const axes = [0, 1, 2].filter((a) => a !== drop)
    const p = (index: number) => normalized[index].filter((_, a) => axes.includes(a))
    const cross = (a: number[], b: number[], c: number[]) =>
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    const area = face.reduce((sum, index, i) => {
      const a = p(index)
      const b = p(face[(i + 1) % face.length])
      return sum + a[0] * b[1] - b[0] * a[1]
    }, 0)
    const sign = area >= 0 ? 1 : -1

    const remaining = [...face]
    let guard = 0
    while (remaining.length > 3) {
      let clipped = false
      for (let i = 0; i < remaining.length; i++) {
        const ids = [
          remaining[(i + remaining.length - 1) % remaining.length],
          remaining[i],
          remaining[(i + 1) % remaining.length],
        ]
        const [a, b, c] = ids.map(p)
        if (cross(a, b, c) * sign <= 1e-12) continue
        const contains = remaining.some(
          (index) =>
            !ids.includes(index) &&
            [cross(a, b, p(index)), cross(b, c, p(index)), cross(c, a, p(index))].every(
              (n) => n * sign >= -1e-12,
            ),
        )
        if (contains) continue
        triangles.push(ids)
        remaining.splice(i, 1)
        clipped = true
        break
      }
      if (!clipped || ++guard > face.length) {
        throw new Error('OBJ inneholder en degenerert eller selvkryssende flate.')
      }
    }
    triangles.push(remaining)
  }

  if (triangles.length > MAX_TRIANGLES) {
    throw new Error('Modellen har for mange trekanter (maks 150 000).')
  }

  // Vend viklingen etter at Y er vendt, slik at normalene peker utover.
  triangles.forEach((t) => ([t[1], t[2]] = [t[2], t[1]]))

  const normals = triangles.map((t) => {
    const [a, b, c] = t.map((i) => normalized[i])
    const u = b.map((n, i) => n - a[i])
    const v = c.map((n, i) => n - a[i])
    const n = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ]
    const length = Math.hypot(...n) || 1
    return n.map((value) => value / length)
  })

  return { vertices: normalized, triangles, normals }
}
