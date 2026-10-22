// ---------------------------------------------------------------------------
// BLOB-MODE — en SDF-raymarcher, inspirert av shubniggurath sitt "Platonics"
// og av materialidéene i shaders.com-samlingen "Shape Effects" (chrome,
// glass, goo, obsidian, hologram).
//
// Ingenting tegnes unntatt piksler: et fullskjerm-kvad marsjerer stråler
// gjennom et avstandsfelt bygget av flere primitiver som er smeltet sammen
// med en "smooth minimum" (metaball). Bildet pakkes på med triplanar mapping.
//
// Port fra src/shaders/blob.glsl.js i Smudge_animator @ 81cf506.
// ---------------------------------------------------------------------------
export const blobVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const blobFragmentShader = /* glsl */ `
uniform vec2  uResolution;
uniform float uTime;
uniform sampler2D uTexture;
uniform float uHue;
uniform float uSaturation;
uniform float uGloss;
uniform float uBlend;
uniform float uSpread;
uniform float uSize;
uniform float uSpin;
uniform float uWobble;
uniform float uRound;
uniform float uTint;
uniform float uScale;
uniform int   uShape;    // 0 sphere, 1 box, 2 tetra, 3 octa, 4 torus, 5 capsule,
                         // 6 hexagon, 7 heart, 8 crescent
uniform int   uCount;
uniform int   uMat;      // 0 matte, 1 chrome, 2 glass, 3 goo, 4 obsidian, 5 hologram
uniform vec3  uBgA;
uniform vec3  uBgB;
uniform int   uBgMode;

varying vec2 vUv;

const float TAU = 6.28318530718;
const int   STEPS = 70;
const float MAX_DIST = 9.0;

// --- colour helpers --------------------------------------------------------
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

// --- the "smooth minimum": melts two shapes together ----------------------
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// --- primitive distance fields --------------------------------------------
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTetrahedron(vec3 p, float s, float r) {
  return (max(max(-p.x - p.y - p.z, p.x + p.y - p.z),
              max(p.x - p.y + p.z, -p.x + p.y + p.z)) - s) / 3.0 - r;
}

float sdOctahedron(vec3 p, float s, float r) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027 - r;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k)) - r;
}

float sdTorus(vec3 p, float big, float small) {
  return length(vec2(length(p.xz) - big, p.y)) - small;
}

float sdCapsule(vec3 p, float h, float r) {
  p.y -= clamp(p.y, -h, h);
  return length(p) - r;
}

// Extrude a 2D distance into a rounded prism: the trick is to take the 2D
// distance and the depth as a 2D "w" vector, then round the corner.
float extrude(float d2, float depth, float r) {
  vec2 w = vec2(d2, depth);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - r;
}

float sdHexPrism(vec3 p, float r, float round) {
  const vec3 k = vec3(-0.866025, 0.5, 0.57735);
  vec2 q = abs(p.xy);
  q -= 2.0 * min(dot(k.xy, q), 0.0) * k.xy;
  q -= vec2(clamp(q.x, 0.0, k.z * r), r);
  float d2 = length(q) * sign(q.y);
  return extrude(d2, abs(p.z) - r * 0.9, round);
}

float sdHeartShape(vec3 p, float s, float round) {
  vec2 q = p.xy / s;
  q.x = abs(q.x);
  float d;
  if (q.y + q.x > 0.0) {
    d = length(q - vec2(0.25, 0.25)) - sqrt(0.125);
  } else {
    float t = 0.5 * max(q.x + q.y, 0.0);
    d = sqrt(min(dot(q, q), dot(q - vec2(t), q - vec2(t)))) * sign(q.x - q.y);
  }
  return extrude(d * s, abs(p.z) - s * 0.5, round);
}

float sdCrescent(vec3 p, float s, float round) {
  float outer = length(p.xy) - s;
  float inner = length(p.xy - vec2(s * 0.55, 0.0)) - s * 0.92;
  float d2 = max(outer, -inner);
  return extrude(d2, abs(p.z) - s * 0.5, round);
}

float sdPrimitive(vec3 p, int type, float size, float round) {
  if (type == 1) return sdRoundBox(p, vec3(size * 0.78), round);
  if (type == 2) return sdTetrahedron(p, size * 1.5, round);
  if (type == 3) return sdOctahedron(p, size * 1.35, round);
  if (type == 4) return sdTorus(p, size * 0.72, size * 0.32 + round);
  if (type == 5) return sdCapsule(p, size * 0.72, size * 0.4 + round);
  if (type == 6) return sdHexPrism(p, size * 1.15, round);
  if (type == 7) return sdHeartShape(p, size * 1.35, round);
  if (type == 8) return sdCrescent(p, size * 1.25, round);
  return sdSphere(p, size);
}

// --- the shape -------------------------------------------------------------
float mapScene(vec3 p, out vec3 blendColour) {
  float d = 1e9;
  blendColour = vec3(1.0);

  float k = mix(0.95, 0.10, uBlend);
  int n = clamp(uCount, 2, 8);

  for (int i = 0; i < 8; i++) {
    if (i >= n) break;

    float fi = float(i);
    float a = fi / float(n) * TAU + uTime * 0.30 * uSpin;

    vec3 centre = vec3(
      cos(a) * uSpread,
      sin(a * 1.7 + uTime * 0.4) * uSpread * 0.5,
      sin(a) * uSpread
    );

    float wob = 1.0 + uWobble * 0.45 * sin(uTime * 1.6 + fi * 2.1);
    float radius = uSize * wob;

    float di = sdPrimitive(p - centre, uShape, radius, uRound);
    vec3 blobCol = hsv2rgb(vec3(fract(fi * 0.17 + uTime * 0.02), 0.8, 1.0));

    if (i == 0) {
      d = di;
      blendColour = blobCol;
    } else {
      float nd = smin(d, di, k);
      float ddiff = (di - d) / max(abs(di), 1e-4);
      float w = smoothstep(0.0, 1.0, ddiff * 0.7);
      blendColour = mix(blobCol, blendColour, w);
      d = nd;
    }
  }

  return d;
}

float mapScene(vec3 p) {
  vec3 c;
  return mapScene(p, c);
}

vec3 calcNormal(vec3 pos) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    mapScene(pos + e.xyy) - mapScene(pos - e.xyy),
    mapScene(pos + e.yxy) - mapScene(pos - e.yxy),
    mapScene(pos + e.yyx) - mapScene(pos - e.yyx)
  ));
}

// --- wrap the image around the blob (triplanar) ---------------------------
vec3 sampleTriplanar(vec3 pos, vec3 nor) {
  vec3 w = abs(nor);
  w = pow(w, vec3(3.0));
  w /= max(w.x + w.y + w.z, 0.0001);

  float s = 0.62;
  vec3 cx = texture2D(uTexture, pos.zy * s + 0.5).rgb;
  vec3 cy = texture2D(uTexture, pos.xz * s + 0.5).rgb;
  vec3 cz = texture2D(uTexture, pos.xy * s + 0.5).rgb;

  return cx * w.x + cy * w.y + cz * w.z;
}

// A procedural studio: softbox, sky gradient and two strip lights, so the shiny
// materials (chrome, glass) have something interesting to reflect.
vec3 environment(vec3 dir) {
  float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(vec3(0.04, 0.05, 0.08), vec3(0.85, 0.90, 1.0), smoothstep(0.30, 1.0, t));

  // big frontal softbox
  float box = smoothstep(0.55, 0.98, dot(dir, normalize(vec3(-0.45, 0.7, 0.55))));
  col += vec3(1.0) * box * 1.6;

  // warm and cool strip lights
  col += vec3(1.0, 0.55, 0.25) * smoothstep(0.85, 1.0, sin(dir.x * 6.0 + dir.y * 2.0)) * 0.35;
  col += vec3(0.35, 0.6, 1.0) * smoothstep(0.85, 1.0, -sin(dir.x * 4.0 - dir.z * 3.0)) * 0.35;

  return col;
}

// --- materials -------------------------------------------------------------
vec3 materialShade(vec3 base, vec3 nor, vec3 rd, vec3 refl, vec3 pos, float fre) {
  vec3 lig = normalize(vec3(-0.6, 0.75, 0.5));
  float dif = clamp(dot(nor, lig), 0.0, 1.0);
  float amb = clamp(0.5 + 0.5 * nor.y, 0.0, 1.0);
  float spec = pow(clamp(dot(refl, lig), 0.0, 1.0), 24.0) * uGloss;
  vec3 env = environment(refl);

  // 1 Chrome: mirror of the studio, barely tinted
  if (uMat == 1) {
    vec3 tint = mix(vec3(1.0), base, 0.20);
    return env * tint * (0.80 + 0.35 * dif) + vec3(1.0) * spec * 0.5;
  }

  // 2 Glass: translucent body with a refracted sample and a hard rim
  if (uMat == 2) {
    vec3 refr = sampleTriplanar(pos + refl * 0.35, nor);
    vec3 body = mix(base, refr, 0.5) * 0.85;
    return body * (0.45 + 0.6 * dif) + env * (0.22 + 0.6 * fre) + vec3(1.0) * spec * 1.2;
  }

  // 3 Goo: wet liquid — saturated, big soft highlight, clearcoat rim
  if (uMat == 3) {
    float wet = pow(clamp(dot(refl, lig), 0.0, 1.0), 60.0) * 1.8 * max(uGloss, 0.2);
    return base * (0.35 + 0.80 * dif) + base * amb * 0.35
         + vec3(1.0) * wet + vec3(1.0) * pow(fre, 2.0) * 0.35;
  }

  // 4 Obsidian: near black faces, iridescent colour only on the oblique walls
  if (uMat == 4) {
    float ang = atan(nor.y, nor.x);
    vec3 rainbow = hsv2rgb(vec3(fract(fre * 1.6 + ang / TAU + uTime * 0.05), 0.85, 1.0));
    return base * 0.10 + rainbow * pow(fre, 1.3) * 1.6 + vec3(1.0) * pow(fre, 4.0) * 0.5;
  }

  // 5 Hologram: emissive translucent projection with scan lines
  if (uMat == 5) {
    float scan = 0.5 + 0.5 * sin(pos.y * 70.0 + uTime * 3.0);
    vec3 tint = mix(vec3(0.30, 0.90, 1.0), vec3(1.0, 0.40, 0.90), fre);
    return base * 0.22 + tint * (0.45 + 0.55 * dif) * (0.6 + 0.4 * scan)
         + tint * pow(fre, 1.5) * 1.3;
  }

  // 6 LiquidMetal: flowing chrome with a prismatic sweep over the folds
  if (uMat == 6) {
    float flow = fract(dot(nor, vec3(0.6, 0.8, 0.4)) * 0.5 + uTime * 0.08);
    vec3 tint = hsv2rgb(vec3(fract(0.55 + flow * 0.35), 0.55, 1.0));
    vec3 m = environment(refl) * tint * (0.90 + 0.40 * dif);
    m += vec3(1.0) * pow(fre, 2.0) * 0.55 * tint;
    m += vec3(1.0) * spec * 0.9;
    return m;
  }

  // 7 Crystal: faceted gem — quantised normals, refraction and hard sparks
  if (uMat == 7) {
    vec3 fn = normalize(floor(nor * 3.0 + 0.5) / 3.0);
    vec3 refr = sampleTriplanar(pos + fn * 0.4, fn);
    vec3 body = mix(base, refr, 0.65);
    float facetSpec = pow(max(dot(reflect(rd, fn), lig), 0.0), 60.0) * 1.6;
    return body * 0.5 + environment(reflect(rd, fn)) * (0.35 + 0.5 * fre)
         + vec3(1.0) * facetSpec;
  }

  // 8 Neon: an emissive glowing tube with a hot rim
  if (uMat == 8) {
    float ang = atan(nor.y, nor.x);
    vec3 glow = hsv2rgb(vec3(fract(uHue + 0.5 + ang / TAU), 0.85, 1.0));
    vec3 c = base * 0.15;
    c += glow * (0.40 + 0.70 * pow(fre, 0.8)) * 1.8;
    c += vec3(1.0) * spec * 0.6;
    return c;
  }

  // 0 Matte (the original look)
  vec3 lit = base * (0.25 + 0.85 * dif);
  lit += base * amb * 0.25;
  lit += vec3(1.0) * fre * 0.45;
  lit += vec3(1.0) * spec * 0.8;
  float reflAmt = mix(0.20, 0.50, clamp(uGloss * 0.5, 0.0, 1.0));
  return lit * (1.0 - reflAmt) + env * reflAmt;
}

void main() {
  vec2 uv = vUv - 0.5;
  uv.x *= uResolution.x / max(uResolution.y, 1.0);
  uv /= max(uScale, 0.001);

  vec3 ro = vec3(0.0, 0.0, 3.1);
  vec3 rd = normalize(vec3(uv * 1.15, -1.5));

  // --- raymarch -------------------------------------------------------------
  float dist = 0.0;
  float hit = -1.0;
  vec3 pos = ro;
  vec3 blendColour = vec3(1.0);

  for (int i = 0; i < STEPS; i++) {
    pos = ro + rd * dist;
    float d = mapScene(pos, blendColour);
    if (d < 0.0012) { hit = dist; break; }
    dist += d * 0.85;
    if (dist > MAX_DIST) break;
  }

  // --- background (chosen in Render Settings) -------------------------------
  vec3 col = uBgA;
  if (uBgMode == 1) {
    col = mix(uBgA, uBgB, clamp(vUv.y * 0.75 + vUv.x * 0.25, 0.0, 1.0));
  }
  col *= 1.0 + 0.30 * smoothstep(1.1, 0.0, length(uv));

  if (hit > 0.0) {
    vec3 nor = calcNormal(pos);
    vec3 refl = reflect(rd, nor);
    float fre = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 3.0);

    vec3 base = sampleTriplanar(pos, nor);

    if (uTint > 0.001) {
      float lum = dot(base, vec3(0.299, 0.587, 0.114));
      base = mix(base, mix(base, blendColour, 0.75) * (0.45 + lum), uTint);
    }

    vec3 hsv = rgb2hsv(base);
    hsv.x = fract(hsv.x + uHue);
    hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
    base = hsv2rgb(hsv);

    col = materialShade(base, nor, rd, refl, pos, fre);
  }

  col *= 1.0 - 0.25 * smoothstep(0.6, 1.3, length(uv));

  gl_FragColor = vec4(col, 1.0);
}
`
