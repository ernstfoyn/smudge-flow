import type { Graph } from '../engine/types'

/**
 * Historikk for grafen.
 *
 * Port av logikken i public/orbit/history.js i Smudge_animator @ 81cf506,
 * men tilpasset en nodegraf: hvert uttrykk i historikken er et *øyeblikksbilde*
 * av hele grafen.
 *
 * To ting holder historikken brukbar:
 *   1. Signaturen deduplikerer: å sette samme verdi to ganger gir én innslag.
 *   2. Nøkkelen slår sammen raske endringer (f.eks. en node som dras, eller
 *      en skyveknapp som kjøres over) til ett innslag.
 */
export interface HistoryEntry {
  graph: Graph
  label: string
  time: number
  signature: string
}

export class EditHistory {
  private entries: HistoryEntry[] = []
  private index = -1
  private lastKey: string | null = null
  private lastTime = 0

  constructor(private limit = 80) {}

  /**
   * Registrerer en endring, med den forrige tilstanden som utgangspunkt.
   *
   * Uten dette ville den første endringen ikke kunnet angres: historikken
   * må ha en opprinnelig tilstand å gå tilbake til.
   */
  recordChange(prev: Graph, next: Graph, label: string, key?: string): boolean {
    if (this.entries.length === 0) {
      this.entries.push({
        graph: prev,
        label: 'Utgangspunkt',
        time: Date.now(),
        signature: JSON.stringify(prev),
      })
      this.index = 0
      this.lastKey = null
      this.lastTime = 0
    }
    return this.record(next, label, key)
  }

  /** Registrerer en endring. Returnerer false hvis ingenting nytt skjedde. */
  record(graph: Graph, label: string, key?: string): boolean {
    const now = Date.now()
    const signature = JSON.stringify(graph)

    const current = this.entries[this.index]
    if (current && current.signature === signature) return false

    // En ny endring etter en angres: fork bort «fremtiden».
    if (this.index < this.entries.length - 1) {
      this.entries.length = this.index + 1
    }

    const coalesce =
      key !== undefined &&
      key === this.lastKey &&
      now - this.lastTime < 700 &&
      this.index >= 0

    if (coalesce) {
      this.entries[this.index] = { graph, label, time: now, signature }
    } else {
      this.entries.push({ graph, label, time: now, signature })
      this.index += 1
      if (this.entries.length > this.limit) {
        this.entries.shift()
        this.index -= 1
      }
    }

    this.lastKey = key ?? null
    this.lastTime = now
    return true
  }

  /** Tar ett steg tilbake. Returnerer grafen, eller null. */
  undo(): Graph | null {
    if (this.index <= 0) return null
    this.lastKey = null
    this.index -= 1
    return this.entries[this.index].graph
  }

  /** Tar ett steg fram. Returnerer grafen, eller null. */
  redo(): Graph | null {
    if (this.index >= this.entries.length - 1) return null
    this.lastKey = null
    this.index += 1
    return this.entries[this.index].graph
  }

  get canUndo(): boolean {
    return this.index > 0
  }

  get canRedo(): boolean {
    return this.index < this.entries.length - 1
  }

  /** Etiketten til neste angres — til visning i grensesnittet. */
  get undoLabel(): string | null {
    return this.canUndo ? this.entries[this.index].label : null
  }

  get redoLabel(): string | null {
    return this.canRedo ? this.entries[this.index + 1].label : null
  }

  clear(): void {
    this.entries = []
    this.index = -1
    this.lastKey = null
    this.lastTime = 0
  }
}
