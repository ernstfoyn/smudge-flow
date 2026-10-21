import { NodeRegistry } from '../engine/registry'
import { gradientSource } from './source/gradientSource'
import { motionGraphicsSource } from './source/motionGraphicsSource'
import { imageSource } from './source/imageSource'
import { transform2D } from './modifier/transform2D'
import { raster } from './modifier/raster'
import { blurNode, pixelateNode, warpNode } from './modifier/pixelNodes'
import { blend } from './composite/blend'
import { stack } from './composite/stack'
import { exportOutput, viewport } from './output/outputs'

/**
 * Registeret over alle nodetyper. Én sann kilde til sann for UI-en.
 */
export const registry = new NodeRegistry().registerAll([
  // Kilder
  gradientSource,
  motionGraphicsSource,
  imageSource,
  // Modifikatorer
  transform2D,
  raster,
  blurNode,
  pixelateNode,
  warpNode,
  // Kompositt
  blend,
  stack,
  // Output
  viewport,
  exportOutput,
])

export { NodeRegistry }
