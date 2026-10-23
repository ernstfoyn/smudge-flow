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

function bevegeligBilde(): BlockTemplate {
  const b = new TemplateBuilder()
  const motion = b.node(
    'modifier.motion2D',
    { preset: 'float', amplitude: 80, cycles: 1 },
    { x: 0, y: 0 },
  )
  b.exposeInput(motion, 'in', 'Bilde')
  b.exposeOutput(motion, 'out', 'Bevegelig bilde')

  return withDefaultSources(
    b.build(
      'Bevegelig bilde',
      'Svevende bilde med løkkesikker bevegelse. Bytt preset i Objektbevegelse-noden.',
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

function glassBlob(): BlockTemplate {
  const b = new TemplateBuilder()
  const trailNode = b.node('modifier.trail', { brush: 0.28, spacing: 0.2 }, { x: 0, y: 0 })
  const blob = b.node(
    'source.blob3D',
    { shape: 'sphere', material: 'glass', count: 5, size: 0.46, blend: 0.55, morph: 0.45 },
    { x: 260, y: 0 },
  )
  const chromatic = b.node('modifier.look.chromatic', { amount: 0.4 }, { x: 500, y: 0 })

  b.connect(trailNode, 'out', blob, 'in')
  b.connect(blob, 'out', chromatic, 'in')
  b.exposeInput(trailNode, 'in', 'Bilde')
  b.exposeOutput(chromatic, 'out', 'Resultat')

  return withDefaultSources(
    b.build(
      'Glass-blob',
      'Malte stempler i en raymarchet glassform, med kromatisk spalting.',
      'Behandling',
    ),
  )
}

function treDScene(): BlockTemplate {
  const b = new TemplateBuilder()

  // To innebygde former, slik at scenen har innhold med én gang.
  const torus = b.node(
    'source.mesh3D',
    { shape: 'torus', size: 0.5, color: '#b9ff66', roughness: 0.35, metalness: 0.25 },
    { x: -620, y: 0 },
  )
  const sphere = b.node(
    'source.mesh3D',
    { shape: 'sphere', size: 0.28, color: '#ff6f91', roughness: 0.2, metalness: 0.5 },
    { x: -620, y: 180 },
  )

  const left = b.node('scene.object', { posX: -0.75 }, { x: -380, y: 0 })
  const right = b.node('scene.object', { posX: 0.75 }, { x: -380, y: 180 })

  const builtIn = b.node('scene.group', {}, { x: -140, y: 60 })
  // Egne objekter kommer inn her, uten å fortrenge de innebygde.
  const userObjects = b.node('scene.group', {}, { x: -140, y: 320 })

  const all = b.node('scene.group', {}, { x: 100, y: 160 })
  const parent = b.node('scene.object', { rotY: 12, posY: 0.15 }, { x: 340, y: 160 })

  const camera = b.node('scene.camera', { posZ: 4.5, posY: 0.4 }, { x: 340, y: 340 })
  const lights = b.node('scene.lights', {}, { x: 340, y: 460 })

  const scene = b.node(
    'composite.sceneRender',
    { cameraDistance: 4.5, ambient: 1.2, directional: 2, spin: 1 },
    { x: 580, y: 220 },
  )

  b.connect(torus, 'out', left, 'in')
  b.connect(sphere, 'out', right, 'in')
  b.connect(left, 'out', builtIn, 'children')
  b.connect(right, 'out', builtIn, 'children')
  b.connect(builtIn, 'out', all, 'children')
  b.connect(userObjects, 'out', all, 'children')
  b.connect(all, 'out', parent, 'in')
  b.connect(parent, 'out', scene, 'in')
  b.connect(camera, 'out', scene, 'camera')
  b.connect(lights, 'out', scene, 'lights')

  b.exposeInput(userObjects, 'children', 'Egne objekter')
  b.exposeOutput(scene, 'out', 'Scene')

  return withDefaultSources(
    b.build(
      '3D-scene',
      'Komplett scene: gruppe med objekter, kamera og belysning. Koble egne objekter inn i «Egne objekter».',
      '3D',
    ),
  )
}

function treDTekst(): BlockTemplate {
  const b = new TemplateBuilder()
  const text = b.node(
    'source.text3D',
    { text: 'SMUDGE', size: 0.55, depth: 0.18, color: '#b9ff66', roughness: 0.3, metalness: 0.35 },
    { x: 0, y: 0 },
  )
  const transform = b.node('modifier.transform3D', { rotX: 12, rotY: 0 }, { x: 240, y: 0 })
  const scene = b.node(
    'composite.sceneRender',
    { cameraDistance: 4.5, ambient: 1.2, directional: 2, spin: 0 },
    { x: 480, y: 0 },
  )

  b.connect(text, 'out', transform, 'in')
  b.connect(transform, 'out', scene, 'in')
  b.exposeOutput(scene, 'out', '3D-tekst')
  // Objektet eksponeres, slik at teksten kan settes inn i en større scene.
  b.exposeInput(transform, 'in', 'Objekt')

  return withDefaultSources(
    b.build(
      '3D-tekst',
      'Ekstrudert tekst med transform og scene. Bytt teksten i 3D-tekst-noden.',
      '3D',
    ),
  )
}

function treDGruppe(): BlockTemplate {
  const b = new TemplateBuilder()
  const group = b.node('scene.group', {}, { x: 0, y: 0 })
  const parent = b.node('scene.object', { rotY: 0 }, { x: 240, y: 0 })

  b.connect(group, 'out', parent, 'in')
  b.exposeInput(group, 'children', 'Objekter')
  b.exposeOutput(parent, 'out', 'Gruppe')

  return withDefaultSources(
    b.build(
      '3D-gruppe',
      'Samler objekter til én enhet. Flytt, roter og skaler hele gruppen med Objekt-noden.',
      '3D',
    ),
  )
}

function treDAnimasjon(): BlockTemplate {
  const b = new TemplateBuilder()
  const scatter = b.node(
    'modifier.scatter3D',
    { pattern: 'ring', count: 8, radius: 1.2, wave: 0.2, waveTurns: 1, spin: 0 },
    { x: 0, y: 0 },
  )
  const motion = b.node(
    'modifier.motion3D',
    { preset: 'orbit', strength: 100, cycles: 1, phaseOffset: 0.15 },
    { x: 220, y: 0 },
  )
  const scene = b.node(
    'composite.sceneRender',
    { cameraDistance: 4.5, ambient: 1.2, directional: 2, spin: 0 },
    { x: 440, y: 0 },
  )

  b.connect(scatter, 'out', motion, 'in')
  b.connect(motion, 'out', scene, 'in')
  b.exposeInput(scatter, 'in', '3D-objekt')
  b.exposeOutput(scene, 'out', '3D-animasjon')

  return withDefaultSources(
    b.build(
      '3D-animasjon',
      'Åtte objekter i ring med orbit og faseforskyvning. Bytt preset i 3D-animasjonspreset-noden.',
      '3D',
    ),
  )
}

export const BUILTIN_BLOCKS: BlockTemplate[] = [
  generativeBakgrunn(),
  rasterBehandling(),
  treDForm(),
  treDTekst(),
  treDScene(),
  treDGruppe(),
  treDAnimasjon(),
  loopAnimertForvrengning(),
  bevegeligBilde(),
  lagstabelMal(),
  smudgeGlass(),
  glassBlob(),
]
