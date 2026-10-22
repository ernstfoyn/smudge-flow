import { noiseLibrary } from './noise.glsl'

/**
 * VERTEX SHADER (Smudge)
 *
 * Port av src/shaders/vertex.glsl.js i Smudge_animator @ 81cf506.
 * Uendret bortsett fra importen — uniforms og beregninger er de samme.
 *
 * Ansvar:
 *   1. Bygge fraktal støy -> den organiske væskeboblingen.
 *   2. SKYVE vertexer langs normalen -> «pull / bulge».
 *   3. STREKKE vertexer ut fra sentrum -> «smudge / swell».
 *   4. ROTERE vertexer rundt Y-aksen etter høyde -> «twist».
 *   5. Regne normalen på nytt, slik at lyset følger deformeringen.
 */
export const smudgeVertexShader = /* glsl */ `
uniform float uTime;        // animert tid (allerede ganget med speed)
uniform float uTwist;       // 0..10  hvor hardt vi roterer rundt Y
uniform float uPull;        // 0..10  hvor mye vi forskyver / strekker
uniform float uNoiseScale;  // hvor store støyblobene er
uniform int   uOctaves;     // 1..8  lag med detaljer
uniform int   uNoiseType;   // hvilken støy (se noise.glsl)

varying vec2  vUv;
varying vec3  vNormal;
varying vec3  vViewPosition;
varying float vNoise;

${noiseLibrary}

// --- Fractal Brownian Motion ------------------------------------------------
float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uOctaves) break;

    float n = baseNoise(uNoiseType, p * frequency);

    if (uNoiseType == 4) {               // Ridged: skarpe fjellrygger
      n = (1.0 - abs(n)) * 2.0 - 1.0;
    } else if (uNoiseType == 5) {        // Turbulence: rykende røyk
      n = abs(n) * 2.0 - 1.0;
    }

    value += amplitude * n;
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// --- Vertex-forskyvning -----------------------------------------------------
vec3 displace(vec3 p, vec3 nrm, out float noiseOut) {
  vec3 flow = vec3(0.0, 0.0, uTime * 0.6);
  float n = fbm(p * uNoiseScale + flow);
  noiseOut = n;

  // «PULL»: strekk punktet bort fra sentrum i XY-planet.
  vec2 outward = p.xy;
  outward /= (length(outward) + 0.0001);
  vec3 d = p;
  d.xy += outward * n * uPull * 0.05;

  // «PULL»: skyv punktet ut langs normalen for å lage 3D-bulger.
  d += nrm * n * uPull * 0.10;

  return d;
}

void main() {
  vUv = uv;

  vec3 pos = position;
  vec3 nrm = normal;

  // --- Regn normalene på nytt med endelige differenser ----------------------
  vec3 upRef = vec3(0.0, 1.0, 0.0);
  if (abs(dot(nrm, upRef)) > 0.999) upRef = vec3(1.0, 0.0, 0.0);
  vec3 t1 = normalize(cross(nrm, upRef));
  vec3 t2 = normalize(cross(nrm, t1));

  float eps = 0.015;
  float n0, nA, nB;
  vec3 p0 = displace(pos, nrm, n0);
  vec3 pA = displace(pos + t1 * eps, nrm, nA);
  vec3 pB = displace(pos + t2 * eps, nrm, nB);

  vec3 newNormal = normalize(cross(pA - p0, pB - p0));
  if (dot(newNormal, nrm) < 0.0) newNormal = -newNormal;

  vNoise = n0;

  // --- TWIST ----------------------------------------------------------------
  float angle = pos.y * uTwist * 0.5;
  float sa = sin(angle);
  float ca = cos(angle);

  vec3 rp = vec3(
    p0.x * ca + p0.z * sa,
    p0.y,
    -p0.x * sa + p0.z * ca
  );

  vec3 rn = vec3(
    newNormal.x * ca + newNormal.z * sa,
    newNormal.y,
    -newNormal.x * sa + newNormal.z * ca
  );

  vec4 mvPosition = modelViewMatrix * vec4(rp, 1.0);
  vViewPosition   = -mvPosition.xyz;
  vNormal         = normalize(normalMatrix * rn);
  gl_Position     = projectionMatrix * mvPosition;
}
`
