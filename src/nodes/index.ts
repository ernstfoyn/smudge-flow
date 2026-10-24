import { NodeRegistry } from '../engine/registry'
import { gradientSource } from './source/gradientSource'
import { motionGraphicsSource } from './source/motionGraphicsSource'
import { imageSource } from './source/imageSource'
import { loopSource } from './source/loopSource'
import { mesh3D } from './source/mesh3D'
import { text3D } from './source/text3D'
import { blob3D } from './source/blob3D'
import { objSource } from './source/objSource'
import { noise } from './source/noise'
import { voronoi } from './source/voronoi'
import { curveNodes } from './curve/curves'
import { transform2D } from './modifier/transform2D'
import { motion2D } from './modifier/motion2D'
import { smudgeDeform } from './modifier/smudgeDeform'
import { lookNodes } from './modifier/lookNodes'
import { trail } from './modifier/trail'
import { scatter3D } from './modifier/scatter3D'
import { transform3D } from './modifier/transform3D'
import { motion3D } from './modifier/motion3D'
import { raster } from './modifier/raster'
import { blurNode, pixelateNode, warpNode } from './modifier/pixelNodes'
import { grade } from './modifier/grade'
import { shader } from './modifier/shader'
import { bloom } from './modifier/bloom'
import { blend } from './composite/blend'
import { stack } from './composite/stack'
import { sceneRender } from './composite/sceneRender'
import { sceneObject } from './composite/sceneObject'
import { sceneGroup } from './composite/sceneGroup'
import { sceneCamera } from './composite/sceneCamera'
import { sceneLights } from './composite/sceneLights'
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
  mesh3D,
  text3D,
  blob3D,
  objSource,
  noise,
  voronoi,
  // Kurver — frittstående verdier som styrer parametere
  ...curveNodes,
  loopSource,
  // Modifikatorer
  transform2D,
  motion2D,
  smudgeDeform,
  trail,
  ...lookNodes,
  transform3D,
  motion3D,
  scatter3D,
  raster,
  blurNode,
  pixelateNode,
  warpNode,
  bloom,
  grade,
  shader,
  // Kompositt
  blend,
  stack,
  sceneRender,
  sceneObject,
  sceneGroup,
  sceneCamera,
  sceneLights,
  // Output
  viewport,
  exportOutput,
])

export { NodeRegistry }
