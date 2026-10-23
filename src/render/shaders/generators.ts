/**
 * Generative shadere — støy og celler.
 *
 * Hentet fra vgpu sitt `@vgpu/wgsl-std/noise` (Perlin/simplex-fBm og
 * Voronoi med f1/f2/celle-ID), skrevet om til GLSL for vårt postpass.
 *
 * Loop-sikkerhet: begge animeres på to måter som lukker seg eksakt.
 *   1. Drift: uv flyttes i en sirkel, cos/sin av fasen. Ved fase 0 og 1
 *      er forskyvningen identisk.
 *   2. Morfing (bare støy): to z-snitt av støyfeltet blandes med
 *      sin²(π·fase), som er 0 i begge ender. Feltet «utvikler seg» uten
 *      at frame 0 og frame N blir ulike.
 *
 * Ingen Math.random, ingen tilstand: samme frame gir samme bilde.
 */

const noiseHelpers = /* glsl */ `
const float PI = 3.14159265359;
const float TAU = 6.28318530718;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Simplex 3D (Ashima/Gustavson).
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm3(vec3 p, int octaves, float gain, float lacunarity) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    sum += snoise(p) * amp;
    norm += amp;
    p *= lacunarity;
    amp *= gain;
  }
  return norm > 0.0 ? sum / norm : 0.0;
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Voronoi med ni celler. Returnerer (f1, f2, celle-ID).
vec3 voronoi2(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  float id = 0.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g) * 0.85 + 0.075;
      vec2 r = g + o - f;
      float d = dot(r, r);

      if (d < f1) {
        f2 = f1;
        f1 = d;
        id = hash21(n + g);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }

  return vec3(sqrt(f1), sqrt(f2), id);
}
`

export const noiseFragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uScale;
uniform float uOctaves;
uniform float uWarp;
uniform float uDrift;
uniform float uContrast;
uniform float uSeed;
uniform float uTime;
uniform float uAspect;

varying vec2 vUv;

${noiseHelpers}

void main() {
  // fract() gjør fase 1 eksakt lik fase 0 (ikke 2π med flyttallsmargin).
  float phase = fract(uTime);
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * uScale + uSeed * 17.3;

  // Sirkulær drift: lukker seg fordi cos/sin er periodiske.
  float a = phase * TAU;
  p += uDrift * uScale * (vec2(cos(a), sin(a)) - vec2(1.0, 0.0));

  vec3 p3 = vec3(p, uSeed);

  // Domene-warp gir organiske, «flytende» former.
  if (uWarp > 0.0) {
    float w1 = fbm3(p3 * 0.5 + vec3(11.3), 2, 0.5, 2.0);
    float w2 = fbm3(p3 * 0.5 + vec3(31.7), 2, 0.5, 2.0);
    p3.xy += vec2(w1, w2) * uWarp * 3.0;
  }

  // To z-snitt, blandet med sin²(π·fase): 0 i begge ender av loopen.
  float mixW = sin(phase * PI);
  mixW *= mixW;

  float n = mix(
    fbm3(p3, int(uOctaves), 0.5, 2.0),
    fbm3(p3 + vec3(0.0, 0.0, 17.3), int(uOctaves), 0.5, 2.0),
    mixW
  );

  n = n * 0.5 + 0.5;
  n = clamp((n - 0.5) * uContrast + 0.5, 0.0, 1.0);

  gl_FragColor = vec4(mix(uColorA, uColorB, n), 1.0);
}
`

export const voronoiFragmentShader = /* glsl */ `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uScale;
uniform float uMode;
uniform float uEdge;
uniform float uDrift;
uniform float uContrast;
uniform float uSeed;
uniform float uTime;
uniform float uAspect;

varying vec2 vUv;

${noiseHelpers}

void main() {
  float phase = fract(uTime);
  vec2 p = vec2(vUv.x * uAspect, vUv.y) * uScale + uSeed * 11.7;

  float a = phase * TAU;
  p += uDrift * uScale * (vec2(cos(a), sin(a)) - vec2(1.0, 0.0));

  vec3 v = voronoi2(p);
  float f1 = v.x;
  float f2 = v.y;
  float cell = v.z;

  float value;
  if (uMode < 0.5) {
    // Avstand til nærmeste frøpunkt.
    value = smoothstep(0.0, 1.0, f1);
  } else if (uMode < 1.5) {
    // Cellekantene: f2 - f1 er nær 0 på grensen.
    value = 1.0 - smoothstep(0.0, max(uEdge, 0.001), f2 - f1);
  } else {
    // Én fast farge per celle.
    value = cell;
  }

  value = clamp((value - 0.5) * uContrast + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(mix(uColorA, uColorB, value), 1.0);
}
`
