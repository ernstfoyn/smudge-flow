import { TemplateBuilder } from './builder'
import { withDefaultSources } from './builder'
import type { BlockTemplate } from './types'

/**
 * Innebygde oppsett.
 *
 * Hver blokk er en komplett, gjenbrukbart rørledning. De er ment som
 * startpunkter: last inn, koble til eget innhold, og juster.
 */

function generativeBakgrunn(): BlockTemplate {
  const b = new TemplateBuilder()
  const gradient = b.node('source.gradient', { fill: 'radial', colorA: '#1b2a4a', colorB: '#05050a' }, { x: 0, y: 0 })
  const dots = b.node(
    'source.motionGraphics',
    { motion: 'dotfield', count: 48, size: 90, colorA: '#b9ff66', colorB: '#4bdac5' },
    { x: 0, y: 200 },
  )
  const stack = b.node('composite.stack', { mode: 'screen', opacity: 0.9 }, { x: 300, y: 100 })

  b.connect(gradient, 'out', stack, 'in')
  b.connect(dots, 'out', stack, 'in')
  b.exposeOutput(stack, 'out', 'Kompositt')

  return withDefaultSources(
    b.build('Generativ bakgrunn', 'Gradient + generativt prikkefelt, blandet med screen.', 'Generativ'),
  )
}

function rasterBehandling(): BlockTemplate {
  const b = new TemplateBuilder()
  const raster = b.node(
    'modifier.raster',
    { pattern: 'dots', cellSize: 12, colorMode: 'source', sizeMode: 'luminance', strength: 100 },
    { x: 0, y: 0 },
  )
  const blur = b.node('modifier.blur', { radius: 0 }, { x: 240, y: 0 })

  b.connect(raster, 'out', blur, 'in')
  b.exposeInput(raster, 'in', 'Bilde')
  b.exposeOutput(blur, 'out', 'Behandlet')

  return withDefaultSources(
    b.build(
      'Raster-behandling',
      'Luminansraster etterfulgt av blur. Koble hvilket som helst bilde inn i «Bilde».',
      'Behandling',
    ),
  )
}

function treDForm(): BlockTemplate {
  const b = new TemplateBuilder()
  const mesh = b.node(
    'source.mesh3D',
    { shape: 'torus', size: 0.5, color: '#b9ff66', roughness: 0.35, metalness: 0.25 },
    { x: 0, y: 0 },
  )
  const transform = b.node('modifier.transform3D', { rotX: 20, rotY: 0 }, { x: 220, y: 0 })
  const scene = b.node(
    'composite.sceneRender',
    { cameraDistance: 4, ambient: 1.2, directional: 2 },
    { x: 460, y: 0 },
  )

  b.connect(mesh, 'out', transform, 'in')
  b.connect(transform, 'out', scene, 'in')
  b.exposeOutput(scene, 'out', '3D-bilde')
  // Transformen eksponeres, slik at formen kan styres utenfra.
  b.exposeInput(transform, 'in', '3D-objekt')

  return withDefaultSources(b.build('3D-form', 'Prosedural 3D-form med transform og scene.', '3D'))
}

function loopAnimertForvrengning(): BlockTemplate {
  const b = new TemplateBuilder()
  const loop = b.node(
    'source.loop',
    { algorithm: 'sine', cycles: 1, min: 0, max: 24, window: 'pingpong' },
    { x: 0, y: 0 },
  )
  const warp = b.node('modifier.warp', { type: 'warp-dots', spacing: 40, cycles: 1 }, { x: 240, y: 0 })
  const stack = b.node('composite.stack', { mode: 'screen', opacity: 1 }, { x: 480, y: 0 })

  // Loop-generatoren driver forvrengningen automatisk.
  b.drive(loop, 'value', warp, 'amount')
  b.connect(warp, 'out', stack, 'in')
  b.exposeInput(warp, 'in', 'Bilde')
  b.exposeOutput(stack, 'out', 'Kompositt')

  return withDefaultSources(
    b.build(
      'Loop-animert forvrengning',
      'En løkkesikker loop-generator driver forvrengningen automatisk.',
      'Behandling',
    ),
  )
}

function lagstabelMal(): BlockTemplate {
  const b = new TemplateBuilder()
  const stack = b.node('composite.stack', { mode: 'screen', opacity: 0.9 }, { x: 0, y: 0 })
  b.exposeInput(stack, 'in', 'Lag')
  b.exposeOutput(stack, 'out', 'Kompositt')

  return withDefaultSources(
    b.build('Lagstabel', 'Kombinerer mange lag i én node. Koble så mange kilder du vil inn.', 'Kompositt'),
  )
}

function smudgeGlass(): BlockTemplate {
  const b = new TemplateBuilder()
  const smudge = b.node(
    'modifier.smudgeDeform',
    {
      trailCount: 5,
      trailSpread: 0.55,
      trailSwirl: 0.5,
      twist: 3,
      pull: 2.5,
      octaves: 4,
      hue: 0,
      saturation: 1,
      gloss: 1,
    },
    { x: 0, y: 0 },
  )
  const chromatic = b.node('modifier.look.chromatic', { amount: 0.6 }, { x: 260, y: 0 })
  const vhs = b.node('modifier.look.vhs', { amount: 0.35 }, { x: 480, y: 0 })

  b.connect(smudge, 'out', chromatic, 'in')
  b.connect(chromatic, 'out', vhs, 'in')
  b.exposeInput(smudge, 'in', 'Bilde')
  b.exposeOutput(vhs, 'out', 'Glass')

  return withDefaultSources(
    b.build(
      'Smudge-glass',
      'Flytende glass-effekt med trail, kromatisk spalting og VHS-linjer.',
      'Behandling',
    ),
  )
}

export const BUILTIN_BLOCKS: BlockTemplate[] = [
  generativeBakgrunn(),
  rasterBehandling(),
  treDForm(),
  loopAnimertForvrengning(),
  lagstabelMal(),
  smudgeGlass(),
]
