/**
 * Størrelser og grenser for de justerbare hovedpanelene.
 *
 * Holder all regnestykket utenfor React, slik at layouten kan testes uten
 * nettleser. Hovedregelen er at sidepanelene aldri kan spise mer plass enn at
 * grafen og bunnpanelet fortsatt har en brukbar minimumsstørrelse.
 */

export const PANEL_HANDLE_SIZE = 8

export interface PanelLayout {
  /** Venstre sidebar i piksler. */
  left: number
  /** Høyre forhåndsvisning i piksler. */
  right: number
  /** Bunnpanelet (Timeline/Eksport) i piksler. */
  bottom: number
}

export interface WorkspaceSize {
  width: number
  height: number
}

export interface PanelRange {
  min: number
  max: number
}

export interface PanelLimits {
  left: PanelRange
  right: PanelRange
  bottom: PanelRange
}

export interface FittedLayout {
  layout: PanelLayout
  limits: PanelLimits
  /** Bredden grafen faktisk får når sidepanelene er trukket fra. */
  mainWidth: number
  /** Høyden grafen faktisk får når bunnpanelet er trukket fra. */
  graphHeight: number
}

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  left: 260,
  right: 500,
  bottom: 320,
}

/** Standardbredder når vinduet er stort nok. */
const MIN_LEFT = 240
const MAX_LEFT = 520
const MIN_RIGHT = 280
const MAX_RIGHT = 900
const MIN_BOTTOM = 140
const MAX_BOTTOM = 560

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/** Bruker faktisk størrelse når den finnes, ellers en fornuftig startverdi. */
function measured(size: WorkspaceSize): WorkspaceSize {
  return {
    width: Math.max(
      0,
      Math.floor(finite(size.width > 0 ? size.width : undefined, 1440)),
    ),
    height: Math.max(
      0,
      Math.floor(finite(size.height > 0 ? size.height : undefined, 900)),
    ),
  }
}

/**
 * Regner ut hvilken plass sidepanelene kan bruke.
 *
 * På smale vinduer krymper minimumsbreddene proporsjonalt, slik at summen
 * alltid passer inn i arbeidsflaten. Da oppstår det aldri horisontal overflow,
 * selv om brukeren har lagret en stor layout fra en bredere skjerm.
 */
export function fitPanelLayout(
  requested: PanelLayout,
  workspace: WorkspaceSize,
): FittedLayout {
  const { width, height } = measured(workspace)
  const usableWidth = Math.max(0, width - PANEL_HANDLE_SIZE * 2)

  const mainMin = Math.min(360, Math.max(160, Math.floor(usableWidth * 0.26)))
  const sideBudget = Math.max(0, usableWidth - mainMin)

  let leftMin = Math.min(MIN_LEFT, Math.max(0, Math.floor(sideBudget * 0.28)))
  let rightMin = Math.min(MIN_RIGHT, Math.max(0, Math.floor(sideBudget * 0.38)))

  // Extremt smale vinduer: del den tilgjengelige plassen likt i stedet for å
  // la minimumsgrensene presse arbeidsflaten ut av vinduet.
  if (leftMin + rightMin > sideBudget) {
    leftMin = Math.max(0, Math.floor(sideBudget / 2))
    rightMin = Math.max(0, sideBudget - leftMin)
  }

  const leftMax = Math.max(
    leftMin,
    Math.min(MAX_LEFT, Math.max(0, sideBudget - rightMin)),
  )
  const rightMax = Math.max(
    rightMin,
    Math.min(MAX_RIGHT, Math.max(0, sideBudget - leftMin)),
  )

  const maxBottom = Math.max(0, height - PANEL_HANDLE_SIZE)
  const graphMin = Math.min(240, Math.max(80, Math.floor(height * 0.25)))
  const bottomMin = Math.min(
    maxBottom,
    Math.max(80, Math.min(MIN_BOTTOM, Math.floor(height * 0.18))),
  )
  const bottomMax = Math.max(
    bottomMin,
    Math.min(MAX_BOTTOM, Math.max(0, height - PANEL_HANDLE_SIZE - graphMin)),
  )

  let left = clamp(finite(requested.left, DEFAULT_PANEL_LAYOUT.left), leftMin, leftMax)
  let right = clamp(
    finite(requested.right, DEFAULT_PANEL_LAYOUT.right),
    rightMin,
    rightMax,
  )

  // To store sidepanel samtidig: fordel overforbruket proporsjonalt mellom
  // ledig plass i hvert panel, så begge beholder sin minimumsbredde.
  const overflow = left + right - sideBudget
  if (overflow > 0) {
    const leftSlack = Math.max(0, left - leftMin)
    const rightSlack = Math.max(0, right - rightMin)
    const slack = leftSlack + rightSlack

    if (slack > 0) {
      const keep = Math.max(0, 1 - overflow / slack)
      left = leftMin + leftSlack * keep
      right = rightMin + rightSlack * keep
    } else {
      left = leftMin
      right = rightMin
    }
  }

  left = Math.floor(left)
  right = Math.floor(right)

  // Avrunding kan gi én piksel for mye. Ta den fra panelet med mest slakk.
  const roundedOverflow = left + right - sideBudget
  if (roundedOverflow > 0) {
    if (left - leftMin >= right - rightMin) left -= roundedOverflow
    else right -= roundedOverflow
  }

  const bottom = Math.floor(
    clamp(finite(requested.bottom, DEFAULT_PANEL_LAYOUT.bottom), bottomMin, bottomMax),
  )

  const layout: PanelLayout = { left, right, bottom }
  const limits: PanelLimits = {
    left: {
      min: leftMin,
      max: Math.max(leftMin, Math.min(leftMax, sideBudget - right)),
    },
    right: {
      min: rightMin,
      max: Math.max(rightMin, Math.min(rightMax, sideBudget - left)),
    },
    bottom: { min: bottomMin, max: bottomMax },
  }

  return {
    layout,
    limits,
    mainWidth: Math.max(0, width - PANEL_HANDLE_SIZE * 2 - left - right),
    graphHeight: Math.max(0, height - PANEL_HANDLE_SIZE - bottom),
  }
}
