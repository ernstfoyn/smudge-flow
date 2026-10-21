import { noiseLibrary } from './noise.glsl.js'

// ---------------------------------------------------------------------------
// VERTEX SHADER
// Runs once per vertex (our plane has ~180x180 = ~32,000 of them).
// Responsibilities:
//   1. Build a layered ("fractal") noise value -> the organic liquid wobble.
//   2. PUSH vertices along their normal   -> the "pull / bulge" effect.
//   3. STRETCH vertices outward from centre -> the "smudge / swell" effect.
//   4. ROTATE vertices around the Y axis based on height -> the "TWIST".
//   5. Recompute the normal so lighting stays correct on the deformed mesh.
//
// `position`, `normal`, `uv`, `modelViewMatrix`, `projectionMatrix` and
// `normalMatrix` are injected automatically by Three.js for any ShaderMaterial,
// so we never re-declare them here.
// ---------------------------------------------------------------------------
export const vertexShader = /* glsl */ `
uniform float uTime;        // animated time (already multiplied by speed)
uniform float uTwist;       // 0..10  how hard we rotate around Y
uniform float uPull;        // 0..10  how much we displace / stretch
uniform float uNoiseScale;  // how large the noise "blobs" are
uniform int   uOctaves;     // 1..8  layers of detail (noise complexity)
uniform int   uNoiseType;   // which noise algorithm to use (see noise.glsl.js)

varying vec2  vUv;          // texture coords -> fragment shader
varying vec3  vNormal;      // deformed + rotated normal -> fragment shader
varying vec3  vViewPosition;// vector to camera, used for the Fresnel rim
varying float vNoise;       // raw noise value, used for subtle shading

${noiseLibrary}

// --- Fractal Brownian Motion -----------------------------------------------
// Add several octaves of the chosen noise together. Each octave is twice as
// detailed but half as strong, which is what makes real fluids look rich.
// Types 4 (Ridged) and 5 (Turbulence) reshape Simplex here: Ridged folds the
// value to make sharp crests, Turbulence takes the absolute value for wisps.
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uOctaves) break;            // stop once we hit the chosen detail

    float n = baseNoise(uNoiseType, p * frequency);

    if (uNoiseType == 4) {               // Ridged: sharp mountain ridges
      n = (1.0 - abs(n)) * 2.0 - 1.0;
    } else if (uNoiseType == 5) {        // Turbulence: wispy chaotic smoke
      n = abs(n) * 2.0 - 1.0;
    }

    value += amplitude * n;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// --- Vertex displacement ---------------------------------------------------
// Given a point and its base normal, move it according to the noise field.
// The noiseOut parameter hands the sampled noise value back to the caller.
vec3 displace(vec3 p, vec3 nrm, out float noiseOut) {
  // Scrolling the noise through time is what animates the smudge.
  vec3 flow = vec3(0.0, 0.0, uTime * 0.6);
  float n = fbm(p * uNoiseScale + flow);
  noiseOut = n;

  // "PULL": stretch the point away from the centre in the XY plane.
  vec2 outward = p.xy;
  outward /= (length(outward) + 0.0001);   // normalise, guarded against 0
  vec3 d = p;
  d.xy += outward * n * uPull * 0.05;

  // "PULL": push the point out along its normal to create 3D bulges.
  d += nrm * n * uPull * 0.10;

  return d;
}

void main() {
  vUv = uv;

  vec3 pos = position;
  vec3 nrm = normal;

  // --- Recompute normals with finite differences ---------------------------
  // We sample the displacement at the vertex and at two tiny neighbours, then
  // use the cross product to get the new surface normal. This keeps the glass
  // highlights sliding correctly over the bulges.
  vec3 upRef = vec3(0.0, 1.0, 0.0);
  if (abs(dot(nrm, upRef)) > 0.999) upRef = vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(nrm, upRef));   // first tangent along the surface
  vec3 t2 = normalize(cross(nrm, t1));      // second tangent (perpendicular)

  float eps = 0.015;                        // sampling distance
  float n0, nA, nB;
  vec3 p0 = displace(pos, nrm, n0);
  vec3 pA = displace(pos + t1 * eps, nrm, nA);
  vec3 pB = displace(pos + t2 * eps, nrm, nB);

  vec3 newNormal = normalize(cross(pA - p0, pB - p0));
  // Make sure the normal still points the same way as the original surface.
  if (dot(newNormal, nrm) < 0.0) newNormal = -newNormal;

  vNoise = n0;

  // --- TWIST ---------------------------------------------------------------
  // Rotate every vertex around the Y (vertical) axis. The angle depends on how
  // high the vertex is, so the top twists one way and the bottom the other,
  // forming a helix.
  float angle = pos.y * uTwist * 0.5;   // radians
  float sa = sin(angle);
  float ca = cos(angle);

  // Standard rotation of (x, z) around the Y axis.
  vec3 rp = vec3(
    p0.x * ca + p0.z * sa,
    p0.y,
    -p0.x * sa + p0.z * ca
  );

  // Rotate the normal by the same angle so the lighting follows the twist.
  vec3 rn = vec3(
    newNormal.x * ca + newNormal.z * sa,
    newNormal.y,
    -newNormal.x * sa + newNormal.z * ca
  );

  // --- Standard Three.js transforms ---------------------------------------
  vec4 mvPosition = modelViewMatrix * vec4(rp, 1.0);
  vViewPosition   = -mvPosition.xyz;            // points from surface -> camera
  vNormal         = normalize(normalMatrix * rn);
  gl_Position     = projectionMatrix * mvPosition;
}
`
