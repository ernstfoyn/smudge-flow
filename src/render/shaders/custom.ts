import { lookPreamble } from './looks'

/**
 * Brukerens egen GLSL, som en fullskjermseffekt.
 *
 * Koden er *kroppen* i `applyLook()`, akkurat som de innebygde effektene i
 * `looks.ts`. Da får brukeren de samme hjelpemidlene uten å måtte kjenne
 * til uniform-oppsettet:
 *
 *   col        inngangsbildet (vec3)
 *   uv         0..1 over lerretet (vec2)
 *   centered   uv - 0.5 (vec2)
 *   bl         styrken, clampet til 0..1
 *   pw         styrken, uclampet (0..2)
 *   sc         skala/frekvens, 0..1
 *   dir        retning fra sentrum
 *   uTime      faselåst tid (sekunder, hele sykluser per loop)
 *   uValueA–D  fire animerbare tall
 *   uColorA/B  to farger
 *   TAU, hash11(), hsv2rgb(), sampleImage()
 *
 * Funksjonen må returnere en `vec3`.
 */
export const CUSTOM_SHADER_DEFAULT = `// Kroppen i applyLook(): returner en vec3.
// col = inngangsbildet, uv = 0..1, centered = -0.5..0.5.
float w = sin(uv.x * 5.0 + uTime * TAU) * cos(uv.y * 4.0 - uTime * TAU);
vec3 plasma = mix(uColorA, uColorB, 0.5 + 0.5 * w);
return mix(col, plasma, bl);
`

/**
 * Setter sammen en komplett fragment-shader rundt brukerens kropp.
 *
 * Ekstra-uniformene deklareres her, ikke i body-en: GLSL krever at uniformer
 * står på toppnivå, utenfor funksjonene.
 */
export function customLookShader(body: string): string {
  // En tom body er en gyldig no-op i stedet for en kompileringsfeil.
  const source = body.trim() ? body : 'return col;'

  return `${lookPreamble}
uniform float uValueA;
uniform float uValueB;
uniform float uValueC;
uniform float uValueD;
uniform vec3 uColorA;
uniform vec3 uColorB;

vec3 applyLook(vec3 col, vec2 uv, vec2 centered) {
  float bl = clamp(uAmount, 0.0, 1.0);
  float pw = uAmount;
  float sc = uScale;
  vec2 dir = normalize(centered + 1e-5);
${source}
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv - 0.5;
  vec3 col = texture2D(uTexture, uv).rgb;
  col = applyLook(col, uv, centered);
  gl_FragColor = vec4(col, 1.0);
}
`
}
