/**
 * FRAGMENT SHADER (Smudge — grunnmateriale)
 *
 * Port av src/shaders/fragment.glsl.js i Smudge_animator @ 81cf506.
 *
 * Endringer i forhold til originalen:
 *   - `applyLook` er fjernet. Effektene ligger nå i egne noder
 *     (src/render/shaders/looks.ts), og rekkefølgen bestemmes av kantene
 *     i grafen. Se src/nodes/modifier/lookNodes.ts.
 *   - `uLookAmounts`, `uLookOrder` og `uLookScale` er borte.
 *
 * Det som står igjen er det som trenger vertex-normalene:
 *   1. Bygge en «trail» av flere ekko-kopier.
 *   2. Hue/saturasjon.
 *   3. Fresnel-rand (glass-silhuett).
 *   4. Spekulær glans.
 */
export const smudgeFragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uTime;

uniform float uRepeat;         // 1..16  hvor mange ganger bildet fliser
uniform int   uMirror;         // 0/1    speilvend naboer
uniform float uKaleido;        // 0 = av, ellers antall kiler (2..16)

uniform int   uTrailCount;     // 0..8   antall ekko-kopier
uniform float uTrailSpread;    // 0..1   hvor langt ekkoene skalerer bort
uniform float uTrailSwirl;     // 0..1   hvor mye ekkoene roterer
uniform float uTrailFade;      // 0..1   hvor raskt ekkoene falmer

uniform float uHue;            // -0.5 .. 0.5   fargehjul
uniform float uSaturation;     // 0 .. 2        metningsmultiplikator
uniform float uGloss;          // 0 .. 2        spekulær styrke
uniform vec3  uRimColor;

varying vec2  vUv;
varying vec3  vNormal;
varying vec3  vViewPosition;
varying float vNoise;

const float TAU = 6.28318530718;

// --- Fargehjelpere ----------------------------------------------------------
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

// --- Repeat / flis ----------------------------------------------------------
vec2 applyRepeat(vec2 uv) {
  vec2 t = uv * uRepeat;
  if (uMirror == 1) {
    vec2 k = floor(t);
    vec2 f = fract(t);
    f = mix(f, 1.0 - f, mod(k, 2.0));
    t = f;
  } else {
    t = fract(t);
  }
  return t;
}

// --- Kaleidoskop ------------------------------------------------------------
void kaleidoCoordAndGrad(
  vec2 uv, vec2 uvDx, vec2 uvDy,
  out vec2 coord, out vec2 gradX, out vec2 gradY
) {
  if (uKaleido < 2.0) {
    coord = uv;
    gradX = uvDx;
    gradY = uvDy;
    return;
  }

  vec2 p = uv - 0.5;
  float r = max(length(p), 0.0001);
  float a = atan(p.y, p.x);

  float seg = TAU / uKaleido;
  float f = abs(mod(a, seg) - seg * 0.5);
  vec2 c = vec2(cos(f), sin(f));
  vec2 s = vec2(-sin(f), cos(f));

  vec2 unfolded = 0.5 + vec2(cos(a), sin(a)) * r;
  vec2 folded = 0.5 + c * r;

  float centreFade = smoothstep(0.0, 0.12, r);
  coord = mix(unfolded, folded, centreFade);

  vec2 drdp = p / r;
  vec2 dadp = vec2(-p.y, p.x) / (r * r);
  vec2 foldGx = c * dot(drdp, uvDx) + r * s * dot(dadp, uvDx);
  vec2 foldGy = c * dot(drdp, uvDy) + r * s * dot(dadp, uvDy);

  gradX = mix(uvDx, foldGx, centreFade);
  gradY = mix(uvDy, foldGy, centreFade);
}

// --- Hent bildet ------------------------------------------------------------
vec3 sampleImage(vec2 uv) {
  vec2 uvDx = dFdx(uv);
  vec2 uvDy = dFdy(uv);

  if (uKaleido < 2.0 && uRepeat <= 1.001 && uMirror == 0) {
    return texture2D(uTexture, uv).rgb;
  }

  vec2 coord, gx, gy;
  kaleidoCoordAndGrad(uv, uvDx, uvDy, coord, gx, gy);

  vec2 gxr = gx * uRepeat;
  vec2 gyr = gy * uRepeat;

  return textureGrad(uTexture, applyRepeat(coord), gxr, gyr).rgb;
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;

  // --- Bygg trailen av farger ----------------------------------------------
  int count = uTrailCount;
  vec3 accum = vec3(0.0);
  float wsum = 0.0;

  for (int i = 0; i < 9; i++) {
    if (i > count) break;

    float t = (count > 0) ? float(i) / float(count) : 0.0;

    float ang = t * uTrailSwirl * TAU;
    float sc = 1.0 - t * uTrailSpread;
    float ca = cos(ang);
    float sa = sin(ang);
    vec2 rc = vec2(
      centered.x * ca - centered.y * sa,
      centered.x * sa + centered.y * ca
    );
    vec2 echoUv = 0.5 + rc * sc;

    float w = pow(max(1.0 - t * uTrailFade, 0.0), 2.0);

    accum += sampleImage(echoUv) * w;
    wsum += w;
  }

  vec3 color = accum / max(wsum, 0.0001);

  // --- Hue / metning --------------------------------------------------------
  vec3 hsv = rgb2hsv(color);
  hsv.x = fract(hsv.x + uHue);
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
  color = hsv2rgb(hsv);

  // --- Fresnel: lys der overflaten vender bort fra kameraet ----------------
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);

  // --- Spekulær glans ------------------------------------------------------
  vec3 lightDir = normalize(vec3(0.6, 0.9, 0.8));
  vec3 halfDir  = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 80.0) * uGloss;

  // --- Sett sammen et glatt, glassakt uttrykk ------------------------------
  vec3 glass = color * 0.88;
  glass += vec3(1.0) * fresnel * 0.45;
  glass += uRimColor * fresnel * 0.30;
  glass += vec3(1.0) * spec;
  glass += vNoise * 0.06;

  gl_FragColor = vec4(glass, 1.0);
}
`
