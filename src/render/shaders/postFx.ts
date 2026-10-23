/**
 * Fargekorrigering og gløding.
 *
 * Hentet fra vgpu sitt `@vgpu/wgsl-std/color` (ACES, Reinhard, eksponering,
 * luminansterskel) og `@vgpu/wgsl-std/sampling` (Vogel-skiven med
 * gylden vinkel). Skrevet om til GLSL for vår eksisterende postprosess.
 *
 * Begge er komplette shadere (`custom: true`) fordi de trenger flere
 * uniformer enn de vanlige look-nodene.
 */

export const gradeFragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uAmount;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uTone;

varying vec2 vUv;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

// Narkowicz-approksimasjonen av ACES, samme som vgpu bruker.
vec3 tonemapAces(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 src = texture2D(uTexture, vUv).rgb;

  // Eksponering i stopp, regnet i lineært rom.
  vec3 lin = srgbToLinear(src) * exp2(uExposure);

  float l = dot(lin, vec3(0.2126, 0.7152, 0.0722));
  if (uTone > 1.5) {
    lin = tonemapAces(lin);
  } else if (uTone > 0.5) {
    lin = lin / (1.0 + l);
  }

  vec3 col = linearToSrgb(clamp(lin, 0.0, 1.0));

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;

  gl_FragColor = vec4(clamp(mix(src, col, uAmount), 0.0, 1.0), 1.0);
}
`

export const bloomFragmentShader = /* glsl */ `
uniform sampler2D uTexture;
uniform float uAmount;
uniform float uThreshold;
uniform float uRadius;
uniform float uSoft;

varying vec2 vUv;

const float GOLDEN_ANGLE = 2.39996323;
const int TAPS = 24;

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec3 base = texture2D(uTexture, vUv).rgb;

  // Vogel-skive: jevn dekning uten støy, uavhengig av radius.
  float radius = 0.004 + uRadius * 0.10;
  float knee = max(uSoft * 0.5, 0.000001);

  vec3 acc = vec3(0.0);
  float total = 0.0;

  for (int i = 0; i < TAPS; i++) {
    float t = (float(i) + 0.5) / float(TAPS);
    float angle = float(i) * GOLDEN_ANGLE;
    vec2 offset = vec2(cos(angle), sin(angle)) * sqrt(t) * radius;

    vec3 s = texture2D(uTexture, vUv + offset).rgb;
    float w = smoothstep(uThreshold - knee, uThreshold + knee, luma(s));
    float falloff = 1.0 - t * 0.6;

    acc += s * w * falloff;
    total += falloff;
  }

  acc /= max(total, 0.0001);

  // Additiv gløding, så mørke partier står urørt.
  vec3 col = base + acc * uAmount;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`
