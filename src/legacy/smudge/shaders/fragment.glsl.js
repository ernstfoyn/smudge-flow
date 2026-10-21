// ---------------------------------------------------------------------------
// FRAGMENT SHADER
// Runs once per pixel. Responsibilities:
//   1. REPEAT the image many times (tiling, mirror symmetry, kaleidoscope).
//   2. Blend several offset "echo" copies into a spiral TRAIL of colour.
//   3. Shift the Hue / Saturation of the result.
//   4. Add a FRESNEL rim glow  -> the "glass" silhouette.
//   5. Add a SPECULAR highlight -> a glossy wet/refractive sheen.
//
// Note: Three.js compiles this as GLSL ES 3.00 (wrapping GLSL1 names like
// texture2D and gl_FragColor through #defines), so we can use textureGrad.
// ---------------------------------------------------------------------------
export const fragmentShader = /* glsl */ `
uniform sampler2D uTexture;    // the uploaded image
uniform float uTime;           // animated time (shared with the vertex shader)

uniform float uRepeat;         // 1..16  how many times the image tiles
uniform int   uMirror;         // 0/1    mirror neighbouring tiles
uniform float uKaleido;        // 0 = off, else number of wedges (2..16)

uniform int   uTrailCount;     // 0..8   how many echo copies to blend
uniform float uTrailSpread;    // 0..1   how far echoes scale away from centre
uniform float uTrailSwirl;     // 0..1   how far echoes rotate (spiral)
uniform float uTrailFade;      // 0..1   how fast the echoes fade out

uniform float uHue;            // -0.5 .. 0.5   hue rotation
uniform float uSaturation;     // 0 .. 2        saturation multiplier
uniform float uGloss;          // 0 .. 2        specular strength
uniform vec3  uRimColor;       // tint colour for the Fresnel rim

uniform float uLookAmounts[17]; // per-look strength, index = look id (0 = off)
uniform int   uLookOrder[17];   // the order the enabled looks are applied in
uniform float uLookScale;      // 0 .. 1  shared size / frequency for all looks

varying vec2  vUv;
varying vec3  vNormal;
varying vec3  vViewPosition;
varying float vNoise;

const float TAU = 6.28318530718;

// 4x4 ordered dither threshold (Bayer).
const float BAYER[16] = float[16](
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0
);

// Small hash, used by the glitch look.
float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

// --- Colour helpers: convert between RGB and HSV ---------------------------
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

// --- Repeat / tile the image -----------------------------------------------
// Multiplies the coordinates so the image repeats. When Mirror is on, every
// other tile is flipped, so the copies join seamlessly into new shapes.
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

// --- Kaleidoscope + screen-space gradients ---------------------------------
// Fold the polar angle into N mirrored wedges (mandala symmetry). Folding the
// angle makes a crease, which normally confuses the texture filter and shows
// up as a thin stripe. To stop that we also work out how fast the coordinate
// changes across the screen (its gradient). We deliberately use the SMOOTH
// unfolded angle for the gradient, so the crease cannot fool the mip level.
void kaleidoCoordAndGrad(
  vec2 uv, vec2 uvDx, vec2 uvDy,
  out vec2 coord, out vec2 gradX, out vec2 gradY
) {
  // No kaleidoscope -> the coordinate is just the plain uv.
  if (uKaleido < 2.0) {
    coord = uv;
    gradX = uvDx;
    gradY = uvDy;
    return;
  }

  vec2 p = uv - 0.5;
  float r = max(length(p), 0.0001);
  float a = atan(p.y, p.x);

  // Fold the angle into one wedge.
  float seg = TAU / uKaleido;
  float f = abs(mod(a, seg) - seg * 0.5);
  vec2 c = vec2(cos(f), sin(f));
  vec2 s = vec2(-sin(f), cos(f));

  vec2 unfolded = 0.5 + vec2(cos(a), sin(a)) * r;
  vec2 folded = 0.5 + c * r;

  // Fade the fold out near the centre (hides the converging spokes).
  float centreFade = smoothstep(0.0, 0.12, r);
  coord = mix(unfolded, folded, centreFade);

  // Analytic gradient of the fold, using the smooth angle derivative.
  vec2 drdp = p / r;                       // d radius / d p
  vec2 dadp = vec2(-p.y, p.x) / (r * r);   // d angle  / d p
  vec2 foldGx = c * dot(drdp, uvDx) + r * s * dot(dadp, uvDx);
  vec2 foldGy = c * dot(drdp, uvDy) + r * s * dot(dadp, uvDy);

  gradX = mix(uvDx, foldGx, centreFade);
  gradY = mix(uvDy, foldGy, centreFade);
}

// --- Sample the image with repetition / symmetry ---------------------------
// textureGrad is the key: by handing it correct gradients, the GPU always
// picks the right mip level, even right on the mirror creases. That is what
// makes the thin "stripe" seams disappear.
vec3 sampleImage(vec2 uv) {
  vec2 uvDx = dFdx(uv);
  vec2 uvDy = dFdy(uv);

  // Fast path: one image, no repetition, no fold -> let the GPU do its thing.
  if (uKaleido < 2.0 && uRepeat <= 1.001 && uMirror == 0) {
    return texture2D(uTexture, uv).rgb;
  }

  vec2 coord, gx, gy;
  kaleidoCoordAndGrad(uv, uvDx, uvDy, coord, gx, gy);

  // Scale the gradients to match the up-scaled (repeated) coordinate.
  vec2 gxr = gx * uRepeat;
  vec2 gyr = gy * uRepeat;

  return textureGrad(uTexture, applyRepeat(coord), gxr, gyr).rgb;
}

// --- Extra "shader looks" ---------------------------------------------------
// Optional stylisation effects. Each has its own strength (0 = off) and they are
// applied one after another, so you can STACK as many as you like.
//
//  1 Chromatic   2 Rainbow   3 Halftone   4 Pixelate    5 Lens      6 Ripple
//  7 Glitch      8 Posterize 9 Vignette  10 Dither     11 Duotone  12 Scanlines
// 13 Zoom blur  14 VHS      15 Spherize  16 Fluted glass
//
// The strength goes up to 2.0: everything past 1.0 keeps amplifying instead of
// blending, which is what gives the slider real punch.
vec3 applyLook(vec3 base, vec2 uv, vec2 centered) {
  vec3 col = base;
  float sc = uLookScale;
  vec2 dir = normalize(centered + 1e-5);

  for (int i = 1; i <= 16; i++) {
    int id = uLookOrder[i];
    float a = uLookAmounts[id];
    if (a <= 0.001) continue;

    float bl = clamp(a, 0.0, 1.0);   // how much it blends in
    float pw = a;                   // strength of the effect itself

    // 1. Chromatic split (RGB shift)
    if (id == 1) {
      float off = pw * 0.014 * (0.3 + length(centered));
      vec3 c = col;
      c.r = sampleImage(uv - dir * off).r;
      c.b = sampleImage(uv + dir * off).b;
      col = mix(col, c, bl);
    }

    // 2. Rainbow aura
    else if (id == 2) {
      float off = pw * 0.022 * (0.2 + length(centered) * 1.6);
      float ang = atan(centered.y, centered.x);
      vec3 rainbow = hsv2rgb(vec3(fract(ang / TAU + uTime * 0.05), 0.9, 1.0));
      vec3 c = col;
      c.r = sampleImage(uv - dir * off).r;
      c.b = sampleImage(uv + dir * off).b;
      float halo = smoothstep(0.0, 0.6, length(centered));
      vec3 tinted = mix(c, c * rainbow * (1.4 + 0.6 * pw), clamp(0.7 * halo * pw, 0.0, 1.0));
      col = mix(col, tinted, bl);
    }

    // 3. Halftone dots
    else if (id == 3) {
      float dots = mix(24.0, 150.0, sc);
      vec2 grid = uv * dots;
      vec2 cell = fract(grid) - 0.5;
      vec2 iduv = (floor(grid) + 0.5) / dots;
      vec3 c = sampleImage(iduv);
      vec3 radii = sqrt(clamp(1.0 - c, 0.0, 1.0)) * 0.48 * mix(1.0, pw, 0.7);
      vec3 dotMask = smoothstep(radii + 0.03, radii - 0.03, vec3(length(cell)));
      col = mix(col, c * dotMask, bl);
    }

    // 4. Pixelate / mosaic
    else if (id == 4) {
      float px = mix(220.0, 18.0, sc) / max(pw, 0.15);
      vec2 cellUv = (floor(uv * px) + 0.5) / px;
      col = mix(col, sampleImage(cellUv), bl);
    }

    // 5. Magnify lens (fisheye bulge; past 1.0 it pinches inward)
    else if (id == 5) {
      float R = mix(0.7, 0.2, sc);
      float r = length(centered);
      float bulge = 1.0 - pw * 0.55 * (1.0 - pow(min(r / max(R, 1e-4), 1.0), 2.0));
      vec2 luv = 0.5 + (centered / max(r, 1e-4)) * r * bulge;
      col = mix(col, sampleImage(luv), bl);
    }

    // 6. Ripple / wave
    else if (id == 6) {
      float w = mix(6.0, 42.0, sc);
      vec2 off = vec2(
        sin(uv.y * w + uTime * 1.5),
        cos(uv.x * w + uTime * 1.5)
      ) * pw * 0.035;
      col = mix(col, sampleImage(uv + off), bl);
    }

    // 7. Glitch slices
    else if (id == 7) {
      float blocks = mix(8.0, 60.0, sc);
      float row = floor(uv.y * blocks);
      float n = hash11(row * 13.7 + floor(uTime * 10.0));
      float dx = (n - 0.5) * pw * 0.30 * step(0.55, n);
      vec2 guv = vec2(uv.x + dx, uv.y);
      vec3 c = col;
      c.r = sampleImage(guv - vec2(pw * 0.012, 0.0)).r;
      c.b = sampleImage(guv + vec2(pw * 0.012, 0.0)).b;
      col = mix(col, c, bl);
    }

    // 8. Posterize (colour banding)
    else if (id == 8) {
      float levels = max(mix(24.0, 3.0, pw), 2.0);
      vec3 c = floor(col * levels + 0.5) / levels;
      col = mix(col, c, bl);
    }

    // 9. Vignette
    else if (id == 9) {
      float v = smoothstep(0.55, 1.0, length(centered) * 1.35);
      col = mix(col, col * (1.0 - clamp(0.9 * pw, 0.0, 1.0) * v), bl);
    }

    // 10. Dither (ordered, 4x4 Bayer)
    else if (id == 10) {
      int ix = int(mod(floor(gl_FragCoord.x), 4.0));
      int iy = int(mod(floor(gl_FragCoord.y), 4.0));
      float th = (BAYER[iy * 4 + ix] + 0.5) / 16.0 - 0.5;
      float levels = max(mix(6.0, 2.0, pw), 2.0);
      vec3 d = floor(col * levels + th + 0.5) / levels;
      col = mix(col, d, bl);
    }

    // 11. Duotone (gradient map shadows -> highlights)
    else if (id == 11) {
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadow = vec3(0.10, 0.05, 0.25);
      vec3 highlight = vec3(1.00, 0.85, 0.55);
      vec3 duo = mix(shadow, highlight, smoothstep(0.0, 1.0, clamp(lum, 0.0, 1.0)));
      col = mix(col, duo, bl);
    }

    // 12. Scanlines (CRT)
    else if (id == 12) {
      float freq = mix(240.0, 700.0, sc);
      float s = 0.5 + 0.5 * sin(centered.y * freq * 3.14159);
      float vig = 1.0 - 0.5 * smoothstep(0.5, 1.2, length(centered) * 1.4);
      vec3 c = col * (1.0 - clamp(0.40 * pw, 0.0, 0.95) * s) * vig;
      c.r *= 1.06;
      c.b *= 0.95;
      col = mix(col, c, bl);
    }

    // 13. Zoom blur (radial smear)
    else if (id == 13) {
      vec3 acc = vec3(0.0);
      for (int k = 0; k < 12; k++) {
        float t = float(k) / 11.0;
        acc += sampleImage(uv + centered * t * pw * 0.35);
      }
      col = mix(col, acc / 12.0, bl);
    }

    // 14. VHS (chroma bleed + per-line jitter + noise)
    else if (id == 14) {
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
      col = mix(col, c, bl);
    }

    // 15. Spherize
    else if (id == 15) {
      vec2 p = centered * 2.0;
      vec2 s = p / (1.0 + dot(p, p) * 0.30 * pw);
      col = mix(col, sampleImage(0.5 + s * 0.5), bl);
    }

    // 16. Fluted glass (vertical bars)
    else if (id == 16) {
      float bars = mix(8.0, 40.0, sc);
      float d = fract(uv.x * bars) - 0.5;
      col = mix(col, sampleImage(uv + vec2(d * 0.08 * pw, 0.0)), bl);
    }
  }

  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;

  // --- Build the trail of colour -------------------------------------------
  // We lay down one normal copy plus uTrailCount echo copies. Each echo is
  // rotated a little and scaled a little around the centre, so the copies fan
  // out into a spiral. Their colours blend together to form a brand new shape.
  int count = uTrailCount;
  vec3 accum = vec3(0.0);
  float wsum = 0.0;

  for (int i = 0; i < 9; i++) {
    if (i > count) break;

    float t = (count > 0) ? float(i) / float(count) : 0.0;

    // Rotate + scale this echo around the centre of the image.
    float ang = t * uTrailSwirl * TAU;
    float sc = 1.0 - t * uTrailSpread;
    float ca = cos(ang);
    float sa = sin(ang);
    vec2 rc = vec2(
      centered.x * ca - centered.y * sa,
      centered.x * sa + centered.y * ca
    );
    vec2 echoUv = 0.5 + rc * sc;

    // Fade each successive echo so the first copy stays sharpest.
    float w = pow(max(1.0 - t * uTrailFade, 0.0), 2.0);

    accum += sampleImage(echoUv) * w;
    wsum += w;
  }

  vec3 color = accum / max(wsum, 0.0001);

  // --- Optional extra "shader look" ----------------------------------------
  color = applyLook(color, uv, centered);

  // --- Hue / saturation shift ----------------------------------------------
  vec3 hsv = rgb2hsv(color);
  hsv.x = fract(hsv.x + uHue);                    // rotate around the colour wheel
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);   // boost or drain colour
  color = hsv2rgb(hsv);

  // --- Fresnel: bright where the surface faces away from the camera --------
  vec3 normal  = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);

  // --- Specular highlight (Blinn-Phong half-vector) ------------------------
  vec3 lightDir = normalize(vec3(0.6, 0.9, 0.8));
  vec3 halfDir  = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 80.0) * uGloss;

  // --- Combine everything into a glossy, glassy look -----------------------
  vec3 glass = color * 0.88;
  glass += vec3(1.0) * fresnel * 0.45;       // white rim light
  glass += uRimColor * fresnel * 0.30;       // tinted rim light
  glass += vec3(1.0) * spec;                 // shiny highlight
  glass += vNoise * 0.06;                    // micro shading on the bulges

  gl_FragColor = vec4(glass, 1.0);
}
`
