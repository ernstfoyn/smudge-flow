/* Model import adapters produce normalized triangle meshes and portable OBJ.
 * Preview and Processing consume the same geometry. New formats can register
 * another adapter; the scene and animation system do not know the file format.
 */
(function (root) {
  'use strict';
  function parseOBJ(text) {
    const vertices = [], faces = [];
    for (const raw of text.split(/\r?\n/)) {
      const parts = raw.split('#')[0].trim().split(/\s+/), token = parts.shift();
      if (token === 'v') {
        const v = parts.slice(0, 3).map(Number);
        if (v.length !== 3 || v.some(n => !Number.isFinite(n))) throw new Error('Ugyldig vertex i OBJ-filen.');
        vertices.push(v);
      } else if (token === 'f') {
        if (parts.length < 3) throw new Error('En OBJ-flate må ha minst tre hjørner.');
        const face = parts.map(part => {
          const index = Number(part.split('/')[0]);
          if (!Number.isInteger(index) || !index) throw new Error('Ugyldig OBJ-indeks.');
          const resolved = index < 0 ? vertices.length + index : index - 1;
          if (resolved < 0 || resolved >= vertices.length) throw new Error('OBJ-indeksen peker utenfor modellen.');
          return resolved;
        });
        faces.push(face);
      }
      if (vertices.length > 100000 || faces.length > 100000) throw new Error('Modellen er for stor. Maks 100 000 vertices/flater.');
    }
    if (!vertices.length || !faces.length) throw new Error('OBJ-filen må inneholde vertices og flater.');
    const min = [0, 1, 2].map(a => Math.min(...vertices.slice(0, 1).map(v => v[a])));
    const max = [...min];
    vertices.forEach(v => v.forEach((n, a) => { min[a] = Math.min(min[a], n); max[a] = Math.max(max[a], n); }));
    const extent = Math.max(...max.map((n, a) => n - min[a]));
    if (!(extent > 0)) throw new Error('Modellen har ingen utstrekning.');
    // Processing/p5 share +Y downward. OBJ convention +Y upward is converted once.
    const normalized = vertices.map(v => v.map((n, a) => (n - (min[a] + max[a]) / 2) / extent * (a === 1 ? -1 : 1)));
    const triangles = [];
    faces.forEach(face => {
      // Ear clipping handles concave planar polygons, unlike triangle fans.
      const polygon = face.map(index => ({ index, point: normalized[index] }));
      const normal = [0, 0, 0];
      polygon.forEach((v, i) => {
        const a = v.point, b = polygon[(i + 1) % polygon.length].point;
        normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
        normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
        normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
      });
      const drop = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
      const axes = [0, 1, 2].filter(a => a !== drop);
      const p = index => normalized[index].filter((_, a) => axes.includes(a));
      const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const area = face.reduce((sum, index, i) => { const a = p(index), b = p(face[(i + 1) % face.length]); return sum + a[0] * b[1] - b[0] * a[1]; }, 0);
      const sign = area >= 0 ? 1 : -1;
      const remaining = [...face];
      let guard = 0;
      while (remaining.length > 3) {
        let clipped = false;
        for (let i = 0; i < remaining.length; i++) {
          const ids = [remaining[(i + remaining.length - 1) % remaining.length], remaining[i], remaining[(i + 1) % remaining.length]];
          const [a, b, c] = ids.map(p);
          if (cross(a, b, c) * sign <= 1e-12) continue;
          const contains = remaining.some(index => !ids.includes(index) && [cross(a, b, p(index)), cross(b, c, p(index)), cross(c, a, p(index))].every(n => n * sign >= -1e-12));
          if (contains) continue;
          triangles.push(ids); remaining.splice(i, 1); clipped = true; break;
        }
        if (!clipped || ++guard > face.length) throw new Error('OBJ inneholder en degenerert eller selvkryssende flate.');
      }
      triangles.push(remaining);
    });
    if (triangles.length > 150000) throw new Error('Modellen har for mange trekanter (maks 150 000).');
    // Flip winding after flipping Y, preserving outward-facing surface normals.
    triangles.forEach(t => [t[1], t[2]] = [t[2], t[1]]);
    const normals = triangles.map(t => {
      const [a, b, c] = t.map(i => normalized[i]);
      const u = b.map((n, i) => n - a[i]), v = c.map((n, i) => n - a[i]);
      const n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
      const length = Math.hypot(...n) || 1; return n.map(n => n / length);
    });
    const portableOBJ = normalized.map(v => `v ${v.join(' ')}`).join('\n') + '\n' + triangles.map((t, i) => `vn ${normals[i].join(' ')}\nf ${t.map(index => `${index + 1}//${i + 1}`).join(' ')}`).join('\n');
    return { format: 'obj', vertices: normalized, triangles, normals, portableOBJ };
  }
  const adapters = { obj: parseOBJ };
  const api = { adapters, parseOBJ, parse(filename, text) {
    const ext = filename.split('.').pop().toLowerCase();
    if (!adapters[ext]) throw new Error('Dette modellformatet støttes ikke ennå.');
    return adapters[ext](text);
  } };
  root.ModelImport = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
