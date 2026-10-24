import type { NodeDefinition } from '../engine/types'

/** Felles kategori-utseende for paletten og Tab-menyen. */
export const CATEGORY_LABEL: Record<NodeDefinition['category'], string> = {
  source: 'Kilder',
  modifier: 'Modifikatorer',
  composite: 'Kompositt',
  output: 'Output',
}

export const CATEGORY_COLOR: Record<NodeDefinition['category'], string> = {
  source: '#22d3ee',
  modifier: '#e879f9',
  composite: '#fbbf24',
  output: '#a3e635',
}

export const CATEGORY_ORDER: NodeDefinition['category'][] = [
  'source',
  'modifier',
  'composite',
  'output',
]
