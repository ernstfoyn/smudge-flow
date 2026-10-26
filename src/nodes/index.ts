import { NodeRegistry } from '../engine/registry'
import { gradientSource } from './source/gradientSource'
import { motionGraphicsSource } from './source/motionGraphicsSource'
import { imageSource } from './source/imageSource'
import { loopSource } from './source/loopSource'
import { mesh3D } from './source/mesh3D'
import { text3D } from './source/text3D'
import { blob3D } from './source/blob3D'
import { objSource } from './source/objSource'
import { text2D } from './source/text2D'
import { shape2D } from './source/shape2D'
import { audioSource } from './source/audio'
import { kineticText } from './source/kineticText'
import { noise } from './source/noise'
import { voronoi } from './source/voronoi'
import { curveNodes } from './curve/curves'
import { signalNode } from './curve/signal'
import { mathNode, remapNode, valueSwitchNode } from './curve/mathNodes'
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
import { maskShape } from './mask/maskShape'
import { maskKey } from './mask/maskKey'
import { maskApply } from './mask/maskApply'
import { maskCombine } from './mask/maskCombine'
import { fitNode } from './modifier/fit'
import { displaceNode } from './modifier/displace'
import { echoNode } from './modifier/echo'
import { gradientMap } from './modifier/gradientMap'
import { patternNode } from './modifier/pattern'
import { imageSwitchNode } from './composite/imageSwitch'
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
  text2D,
  shape2D,
  audioSource,
  kineticText,
  noise,
  voronoi,
  // Signaler — kurver, matematikk og velgere
  signalNode,
  mathNode,
  remapNode,
  valueSwitchNode,
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
  fitNode,
  displaceNode,
  echoNode,
  gradientMap,
  patternNode,
  shader,
  // Masker
  maskShape,
  maskKey,
  maskApply,
  maskCombine,
  // Kompositt
  blend,
  stack,
  sceneRender,
  sceneObject,
  sceneGroup,
  sceneCamera,
  sceneLights,
  imageSwitchNode,
  // Output
  viewport,
  exportOutput,
])

export { NodeRegistry }
