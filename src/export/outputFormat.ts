/**
 * Formater for videoeksporten.
 *
 * Holder valg av container/kodek og bildeformat (bredde/høyde) adskilt fra
 * React, slik at regnestykkene kan testes uten nettleser.
 */

export type OutputFormat = 'mp4' | 'webm'

export const OUTPUT_FORMATS: ReadonlyArray<{ value: OutputFormat; label: string }> = [
  { value: 'mp4', label: 'MP4 (H.264)' },
  { value: 'webm', label: 'WebM (VP9)' },
]

export interface AspectPreset {
  id: 'square' | 'landscape' | 'portrait' | 'vertical' | 'classic' | 'wide'
  label: string
  ratio: number
}

export const ASPECT_PRESETS: ReadonlyArray<AspectPreset> = [
  { id: 'square', label: 'Kvadrat 1:1', ratio: 1 },
  { id: 'landscape', label: 'Landskap 16:9', ratio: 16 / 9 },
  { id: 'portrait', label: 'Portrett 9:16', ratio: 9 / 16 },
  { id: 'vertical', label: 'Vertikal 4:5', ratio: 4 / 5 },
  { id: 'classic', label: 'Klassisk 4:3', ratio: 4 / 3 },
  { id: 'wide', label: 'Bredformat 21:9', ratio: 21 / 9 },
]

export type AspectPresetId = AspectPreset['id'] | 'custom'

/** Maks og min fra eksportpanelet. Video-kodeker krever partallsdimensjoner. */
export const MIN_OUTPUT_SIZE = 64
export const MAX_OUTPUT_SIZE = 4096

function finiteDimension(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(MAX_OUTPUT_SIZE, Math.max(MIN_OUTPUT_SIZE, Math.round(value / 2) * 2))
}

/** Klemmer en bredde/høyde til gyldig eksportområde og gjør den partall. */
export function clampOutputSize(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return finiteDimension(parsed, finiteDimension(fallback, MIN_OUTPUT_SIZE))
}

/**
 * Finner bildeformatet som passer best til gjeldende bredde/høyde.
 *
 * Toleransen er relativ, slik at avrunding til partall ikke gjør at et format
 * plutselig vises som «Egendefinert».
 */
export function aspectPresetFor(width: number, height: number): AspectPresetId {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'custom'
  }

  const ratio = width / height
  let best: AspectPreset | null = null
  let bestError = Number.POSITIVE_INFINITY

  for (const preset of ASPECT_PRESETS) {
    const error = Math.abs(ratio - preset.ratio) / preset.ratio
    if (error < bestError) {
      best = preset
      bestError = error
    }
  }

  return best && bestError <= 0.01 ? best.id : 'custom'
}

/**
 * Tilpasser bredde/høyde til et bildeformat.
 *
 * Den lengste siden beholdes, slik at 960×540 → 9:16 blir 540×960 og
 * 1080×1920 → 16:9 blir 1920×1080. Da kan brukeren veksle mellom formater
 * uten at oppløsningen krymper for hver gang. Resultatet rundes til partall.
 */
export function dimensionsForAspect(
  ratio: number,
  width: number,
  height: number,
): { width: number; height: number } {
  const currentWidth = finiteDimension(width, 960)
  const currentHeight = finiteDimension(height, 960)
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1
  const longestSide = Math.max(currentWidth, currentHeight)

  let nextWidth: number
  let nextHeight: number

  if (safeRatio >= 1) {
    nextWidth = longestSide
    nextHeight = longestSide / safeRatio
  } else {
    nextHeight = longestSide
    nextWidth = longestSide * safeRatio
  }

  // Ekstremt smale formater: sørg for at begge mål fortsatt er gyldige.
  if (nextWidth < MIN_OUTPUT_SIZE) {
    nextWidth = MIN_OUTPUT_SIZE
    nextHeight = nextWidth / safeRatio
  }
  if (nextHeight < MIN_OUTPUT_SIZE) {
    nextHeight = MIN_OUTPUT_SIZE
    nextWidth = nextHeight * safeRatio
  }

  return {
    width: finiteDimension(nextWidth, currentWidth),
    height: finiteDimension(nextHeight, currentHeight),
  }
}

/**
 * Velger format fra eksport-noden når den finnes, ellers prosjektinnstillingen.
 * Ukjente/eldre verdier faller trygt tilbake til MP4.
 */
export function resolveOutputFormat(
  nodeValue: unknown,
  settingValue: unknown,
): OutputFormat {
  if (nodeValue === 'mp4' || nodeValue === 'webm') return nodeValue
  if (settingValue === 'webm') return 'webm'
  return 'mp4'
}
