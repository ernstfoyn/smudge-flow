import { describe, expect, it } from 'vitest'
import { registry } from '../src/nodes'
import { LOOKS } from '../src/render/shaders/looks'
import { smudgeFragmentShader } from '../src/render/shaders/smudgeFragment.glsl'
import { smudgeVertexShader } from '../src/render/shaders/smudgeVertex.glsl'
import { noiseLibrary } from '../src/render/shaders/noise.glsl'

/**
 * Strukturtester for shader-splittet.
 *
 * Disse beskytter porten: at effektene er blitt egne noder, at grunnmaterialet
 * fortsatt inneholder det gamle materialet, og at ingen effekt har blitt borte
 * på veien.
 */
describe('shader-splitt', () => {
  it('alle 16 effekter er egne nodetyper', () => {
    expect(LOOKS).toHaveLength(16)
    for (const look of LOOKS) {
      expect(registry.has(look.type)).toBe(true)
      const def = registry.get(look.type)
      expect(def.category).toBe('modifier')
      expect(def.inputs[0].id).toBe('in')
      expect(def.outputs[0].id).toBe('out')
      // Styrke og skala er animerbare.
      expect(def.params.find((p) => p.key === 'amount')?.animatable).toBe(true)
      expect(def.params.find((p) => p.key === 'scale')?.animatable).toBe(true)
    }
  })

  it('effektene har unike typer og navn', () => {
    const types = new Set(LOOKS.map((l) => l.type))
    const labels = new Set(LOOKS.map((l) => l.label))
    expect(types.size).toBe(16)
    expect(labels.size).toBe(16)
  })

  it('grunnmaterialet er uten effektene', () => {
    // applyLook skal ikke finnes i fragment-shaderen lenger.
    expect(smudgeFragmentShader).not.toContain('applyLook')
    expect(smudgeFragmentShader).not.toContain('uLookOrder')
    expect(smudgeFragmentShader).not.toContain('uLookAmounts')
  })

  it('grunnmaterialet har beholdt trail, hue og fresnel', () => {
    expect(smudgeFragmentShader).toContain('uTrailCount')
    expect(smudgeFragmentShader).toContain('uHue')
    expect(smudgeFragmentShader).toContain('fresnel')
    expect(smudgeFragmentShader).toContain('uKaleido')
    expect(smudgeFragmentShader).toContain('uRepeat')
  })

  it('vertex-shaderen har beholdt forskyvning og twist', () => {
    expect(smudgeVertexShader).toContain('float fbm(')
    expect(smudgeVertexShader).toContain('vec3 displace(')
    expect(smudgeVertexShader).toContain('uTwist')
    expect(smudgeVertexShader).toContain('uPull')
    // Støybiblioteket skal være med i vertex-shaderen.
    expect(smudgeVertexShader).toContain('baseNoise')
  })

  it('støybiblioteket har alle de seks algoritmenes', () => {
    expect(noiseLibrary).toContain('snoise(')
    expect(noiseLibrary).toContain('cnoise(')
    expect(noiseLibrary).toContain('voronoi(')
    expect(noiseLibrary).toContain('curl(')
    expect(noiseLibrary).toContain('baseNoise(')
  })

  it('smudge-noden har de gamle parameterne', () => {
    const def = registry.get('modifier.smudgeDeform')
    const keys = def.params.map((p) => p.key)
    for (const key of [
      'twist', 'pull', 'octaves', 'noiseType', 'repeat', 'mirror', 'kaleido',
      'trailCount', 'trailSpread', 'trailSwirl', 'trailFade',
      'hue', 'saturation', 'gloss', 'shape', 'scale',
      'posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'speed',
    ]) {
      expect(keys).toContain(key)
    }
  })

  it('effektene bruker riktig GLSL-form', () => {
    // Alle effekter skal returnere en farge, og bruke de delte uniformene.
    for (const look of LOOKS) {
      expect(look.glsl).toContain('return')
      expect(look.glsl).toMatch(/\bcol\b/)
    }
    // De som forskyver samplingen, må bruke sampleImage.
    expect(LOOKS.find((l) => l.type === 'modifier.look.chromatic')!.glsl).toContain('sampleImage')
    expect(LOOKS.find((l) => l.type === 'modifier.look.zoomBlur')!.glsl).toContain('sampleImage')
    // De som bare jobber med fargen, skal ikke sample.
    expect(LOOKS.find((l) => l.type === 'modifier.look.duotone')!.glsl).not.toContain('sampleImage')
    expect(LOOKS.find((l) => l.type === 'modifier.look.vignette')!.glsl).not.toContain('sampleImage')
  })

  it('bare de animerte effektene bruker tiden', () => {
    const animated = LOOKS.filter((l) => l.animated).map((l) => l.type)
    expect(animated).toContain('modifier.look.ripple')
    expect(animated).toContain('modifier.look.glitch')
    expect(animated).toContain('modifier.look.vhs')
    expect(animated).toContain('modifier.look.rainbow')
    expect(animated).not.toContain('modifier.look.vignette')
  })
})
