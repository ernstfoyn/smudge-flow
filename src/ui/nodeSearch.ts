import type { NodeDefinition } from '../engine/types'
import { CATEGORY_LABEL } from './categoryStyle'

/** Normaliserer tekst slik at «bolge» også treffer «Bølge». */
function fold(value: string): string {
  return value
    .toLocaleLowerCase('nb-NO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
}

/**
 * Søker i noderegisteret etter label, type, beskrivelse og kategori.
 *
 * Alle ordene i søket må finnes i noden. Treff på label veier tyngst,
 * deretter type, og til slutt beskrivelse/kategori. Med tomt søk beholdes
 * registerets rekkefølge, slik at Tab-menyen viser alle noder.
 */
export function searchNodes(
  defs: readonly NodeDefinition[],
  query: string,
): NodeDefinition[] {
  const tokens = fold(query).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return [...defs]

  const ranked: Array<{ def: NodeDefinition; rank: number }> = []

  for (const def of defs) {
    const label = fold(def.label)
    const type = fold(def.type)
    const description = fold(def.description ?? '')
    const category = fold(CATEGORY_LABEL[def.category] ?? '')
    const haystack = `${label} ${type} ${description} ${category}`

    if (!tokens.every((token) => haystack.includes(token))) continue

    const labelMatch = tokens.every((token) => label.includes(token))
    const typeMatch = tokens.every((token) => type.includes(token))
    const normalized = tokens.join(' ')

    let rank = 4
    if (label === normalized) rank = 0
    else if (label.startsWith(normalized)) rank = 1
    else if (labelMatch) rank = 2
    else if (typeMatch) rank = 3

    ranked.push({ def, rank })
  }

  ranked.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.def.label.localeCompare(b.def.label, 'nb') ||
      a.def.type.localeCompare(b.def.type, 'nb'),
  )

  return ranked.map((entry) => entry.def)
}
