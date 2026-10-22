/**
 * EFFEKTENE (looks) — portet fra src/shaders/fragment.glsl.js
 * i Smudge_animator @ 81cf506.
 *
 * I originalen lå alle 16 effektene i én shader, i en løkke over
 * `uLookOrder`. Nå er hver effekt sin egen GLOW-funksjon, og hver effekt
 * blir en egen node i grafen. Rekkefølgen bestemmes av kantene.
 *
 * Alle effekter følger samme form:
 *
 *   vec3 lookXxx(vec3 col, vec2 uv, vec2 centered) {
 *     float bl = clamp(uAmount, 0.0, 1.0);  // hvor mye den blandes inn
 *     float pw = uAmount;                  // styrken i effekten selv
 *     ...
 *     return mix(col, resultat, bl);
 *   }
 *
 * `sampleImage(uv)` henter fra passens eget input-lerret, så effektene kan
 * kobles i hverandre fritt.
 */

export interface LookDefinition {
  /** Nodetype, f.eks. "modifier.look.chromatic". */
  type: string
  /** Navn i paletten. */
  label: string
  /** Kort forklaring. */
  description: string
  /** GLOW-koden. */
  glsl: string
  /** Støtter effekten animasjon over tid? */
  animated: boolean
}

const CHROMATIC = `
  float off = pw * 0.014 * (0.3 + length(centered));
  vec3 c = col;
  c.r = sampleImage(uv - dir * off).r;
  c.b = sampleImage(uv + dir * off).b;
  return mix(col, c, bl);
`

const RAINBOW = `
  float off = pw * 0.022 * (0.2 + length(centered) * 1.6);
  float ang = atan(centered.y, centered.x);
  vec3 rainbow = hsv2rgb(vec3(fract(ang / TAU + uTime * 0.05), 0.9, 1.0));
  vec3 c = col;
  c.r = sampleImage(uv - dir * off).r;
  c.b = sampleImage(uv + dir * off).b;
  float halo = smoothstep(0.0, 0.6, length(centered));
  vec3 tinted = mix(c, c * rainbow * (1.4 + 0.6 * pw), clamp(0.7 * halo * pw, 0.0, 1.0));
  return mix(col, tinted, bl);
`

const HALFTONE = `
  float dots = mix(24.0, 150.0, sc);
  vec2 grid = uv * dots;
  vec2 cell = fract(grid) - 0.5;
  vec2 iduv = (floor(grid) + 0.5) / dots;
  vec3 c = sampleImage(iduv);
  vec3 radii = sqrt(clamp(1.0 - c, 0.0, 1.0)) * 0.48 * mix(1.0, pw, 0.7);
  vec3 dotMask = smoothstep(radii + 0.03, radii - 0.03, vec3(length(cell)));
  return mix(col, c * dotMask, bl);
`

const PIXELATE = `
  float px = mix(220.0, 18.0, sc) / max(pw, 0.15);
  vec2 cellUv = (floor(uv * px) + 0.5) / px;
  return mix(col, sampleImage(cellUv), bl);
`

const LENS = `
  float R = mix(0.7, 0.2, sc);
  float r = length(centered);
  float bulge = 1.0 - pw * 0.55 * (1.0 - pow(min(r / max(R, 1e-4), 1.0), 2.0));
  vec2 luv = 0.5 + (centered / max(r, 1e-4)) * r * bulge;
  return mix(col, sampleImage(luv), bl);
`

const RIPPLE = `
  float w = mix(6.0, 42.0, sc);
  vec2 off = vec2(
    sin(uv.y * w + uTime * 1.5),
    cos(uv.x * w + uTime * 1.5)
  ) * pw * 0.035;
  return mix(col, sampleImage(uv + off), bl);
`

const GLITCH = `
  float blocks = mix(8.0, 60.0, sc);
  float row = floor(uv.y * blocks);
  float n = hash11(row * 13.7 + floor(uTime * 10.0));
  float dx = (n - 0.5) * pw * 0.30 * step(0.55, n);
  vec2 guv = vec2(uv.x + dx, uv.y);
  vec3 c = col;
  c.r = sampleImage(guv - vec2(pw * 0.012, 0.0)).r;
  c.b = sampleImage(guv + vec2(pw * 0.012, 0.0)).b;
  return mix(col, c, bl);
`

const POSTERIZE = `
  float levels = max(mix(24.0, 3.0, pw), 2.0);
  vec3 c = floor(col * levels + 0.5) / levels;
  return mix(col, c, bl);
`

const VIGNETTE = `
  float v = smoothstep(0.55, 1.0, length(centered) * 1.35);
  return mix(col, col * (1.0 - clamp(0.9 * pw, 0.0, 1.0) * v), bl);
`

const DITHER = `
  int ix = int(mod(floor(gl_FragCoord.x), 4.0));
  int iy = int(mod(floor(gl_FragCoord.y), 4.0));
  float th = (BAYER[iy * 4 + ix] + 0.5) / 16.0 - 0.5;
  float levels = max(mix(6.0, 2.0, pw), 2.0);
  vec3 d = floor(col * levels + th + 0.5) / levels;
  return mix(col, d, bl);
`

const DUOTONE = `
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 shadow = vec3(0.10, 0.05, 0.25);
  vec3 highlight = vec3(1.00, 0.85, 0.55);
  vec3 duo = mix(shadow, highlight, smoothstep(0.0, 1.0, clamp(lum, 0.0, 1.0)));
  return mix(col, duo, bl);
`

const SCANLINES = `
  float freq = mix(240.0, 700.0, sc);
  float s = 0.5 + 0.5 * sin(centered.y * freq * 3.14159);
  float vig = 1.0 - 0.5 * smoothstep(0.5, 1.2, length(centered) * 1.4);
  vec3 c = col * (1.0 - clamp(0.40 * pw, 0.0, 0.95) * s) * vig;
  c.r *= 1.06;
  c.b *= 0.95;
  return mix(col, c, bl);
`

const ZOOM_BLUR = `
  vec3 acc = vec3(0.0);
  for (int k = 0; k < 12; k++) {
    float t = float(k) / 11.0;
    acc += sampleImage(uv + centered * t * pw * 0.35);
  }
  return mix(col, acc / 12.0, bl);
`

const VHS = `
  float line = floor(uv.y * 240.0);
  float jitter = hash11(line * 3.1 + floor(uTime * 12.0)) - 0.5;
  vec2 suv = vec2(uv.x + jitter * 0.012 * pw, uv.y);
  vec3 c;
  c.r = sampleImage(suv + vec2(0.007 * pw, 0.0)).r;
  c.g = sampleImage(suv).g;
  c.b = sampleImage(suv - vec2(0.007 * pw, 0.0)).b;
  float noise = hash11(line * 7.7 + uTime * 30.0);
  c += (noise - 0.5) * 0.14 * pw;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(lum), clamp(0.12 * pw, 0.0, 0.6));
  return mix(col, c, bl);
`

const SPHERIZE = `
  vec2 p = centered * 2.0;
  vec2 s = p / (1.0 + dot(p, p) * 0.30 * pw);
  return mix(col, sampleImage(0.5 + s * 0.5), bl);
`

const FLUTED_GLASS = `
  float bars = mix(8.0, 40.0, sc);
  float d = fract(uv.x * bars) - 0.5;
  return mix(col, sampleImage(uv + vec2(d * 0.08 * pw, 0.0)), bl);
`

export const LOOKS: LookDefinition[] = [
  {
    type: 'modifier.look.chromatic',
    label: 'Kromatisk',
    description: 'Deler RGB-kanalene i hverandre.',
    animated: false,
    glsl: CHROMATIC,
  },
  {
    type: 'modifier.look.rainbow',
    label: 'Regnbue',
    description: 'Fargelapp rundt sentrum som roterer.',
    animated: true,
    glsl: RAINBOW,
  },
  {
    type: 'modifier.look.halftone',
    label: 'Halftone',
    description: 'Trykkprikker basert på lysstyrke.',
    animated: false,
    glsl: HALFTONE,
  },
  {
    type: 'modifier.look.pixelate',
    label: 'Mosaikk',
    description: 'Gjør bildet til en mosaikk.',
    animated: false,
    glsl: PIXELATE,
  },
  {
    type: 'modifier.look.lens',
    label: 'Linse',
    description: 'Fisheye-linse som forstørrer sentrum.',
    animated: false,
    glsl: LENS,
  },
  {
    type: 'modifier.look.ripple',
    label: 'Bølge',
    description: 'Vannbølger gjennom bildet.',
    animated: true,
    glsl: RIPPLE,
  },
  {
    type: 'modifier.look.glitch',
    label: 'Glitch',
    description: 'Linjebasert digital forvrengning.',
    animated: true,
    glsl: GLITCH,
  },
  {
    type: 'modifier.look.posterize',
    label: 'Posterisering',
    description: 'Begrenser antall fargetrinn.',
    animated: false,
    glsl: POSTERIZE,
  },
  {
    type: 'modifier.look.vignette',
    label: 'Vignett',
    description: 'Mørkner kantene.',
    animated: false,
    glsl: VIGNETTE,
  },
  {
    type: 'modifier.look.dither',
    label: 'Dither',
    description: 'Ordnet 4×4 Bayer-dither.',
    animated: false,
    glsl: DITHER,
  },
  {
    type: 'modifier.look.duotone',
    label: 'Dutone',
    description: 'Skygger til høylys i to farger.',
    animated: false,
    glsl: DUOTONE,
  },
  {
    type: 'modifier.look.scanlines',
    label: 'Skannlinjer',
    description: 'CRT-skannlinjer med fargebias.',
    animated: false,
    glsl: SCANLINES,
  },
  {
    type: 'modifier.look.zoomBlur',
    label: 'Zoom-blur',
    description: 'Radial smøring fra sentrum.',
    animated: false,
    glsl: ZOOM_BLUR,
  },
  {
    type: 'modifier.look.vhs',
    label: 'VHS',
    description: 'Kromablød, linjeforskyvning og støy.',
    animated: true,
    glsl: VHS,
  },
  {
    type: 'modifier.look.spherize',
    label: 'Kule',
    description: 'Buler bildet ut som på en kule.',
    animated: false,
    glsl: SPHERIZE,
  },
  {
    type: 'modifier.look.fletedGlass',
    label: 'Riflert glass',
    description: 'Vertikale glassriller.',
    animated: false,
    glsl: FLUTED_GLASS,
  },
]

/**
 * Felles preamble for alle effektene.
 *
 * Inneholder det effektene trenger: input-teksturen, styrke, skala, tid og
 * fargehjelpere. Den eneste forskjellen mellom effektene er GLOW-koden.
 */
export const lookPreamble = /* glsl */ `
uniform sampler2D uTexture;
uniform float uAmount;   // 0..2  styrke
uniform float uScale;    // 0..1  skala / frekvens
uniform float uTime;     // animert tid

varying vec2 vUv;

const float TAU = 6.28318530718;

// 4x4 ordnet dither (Bayer).
const float BAYER[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

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

// Henter fra passens eget input-lerret.
vec3 sampleImage(vec2 uv) {
  return texture2D(uTexture, uv).rgb;
}

// Effekten selv legges inn som funksjonskroppen i applyLook().
`

/** Vertex-shader for et fullskjerm-pass. */
export const postVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`
