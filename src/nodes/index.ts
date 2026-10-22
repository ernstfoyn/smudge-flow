import { NodeRegistry } from '../engine/registry'
import { gradientSource } from './source/gradientSource'
import { motionGraphicsSource } from './source/motionGraphicsSource'
import { imageSource } from './source/imageSource'
import { loopSource } from './source/loopSource'
import { mesh3D } from './source/mesh3D'
import { transform2D } from './modifier/transform2D'
import { smudgeDeform } from './modifier/smudgeDeform'
import { lookNodes } from './modifier/lookNodes'
import { transform3D } from './modifier/transform3D'
import { raster } from './modifier/raster'
import { blurNode, pixelateNode, warpNode } from './modifier/pixelNodes'
import { blend } from './composite/blend'
import { stack } from './composite/stack'
import { sceneRender } from './composite/sceneRender'
import { exportOutput, viewport } from './output/outputs'

/**
 * Registeret over alle nodetyper. Én sann kilde til sann for UI-en.
 *
 * 'group' er ikke i registret — gruppenoder har dynamiske porter og
 * håndteres spesielt i motoren.
 */
export const registry = new NodeRegistry().registerAll([
  // Kilder
  gradientSource,
  motionGraphicsSource,
  imageSource,
  loopSource,
  mesh3D,
  // Modifikatorer
  transform2D,
  smudgeDeform,
  ...lookNodes,
  transform3D,
  raster,
  blurNode,
  pixelateNode,
  warpNode,
  // Kompositt
  blend,
  stack,
  sceneRender,
  // Output
  viewport,
  exportOutput,
])

export { NodeRegistry }
