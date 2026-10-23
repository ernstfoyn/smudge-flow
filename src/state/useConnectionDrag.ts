import { create } from 'zustand'
import type { ValueType } from '../engine/types'

/**
 * Hvilken port brukeren drar en kobling fra akkurat nå.
 *
 * Vi holder dette utenfor React Flow fordi alle nodekort trenger å vite det
 * samtidig: kompatible mål skal lyse, og alt annet skal dempes. Tilstanden
 * endres bare ved start/slutt på en dra-operasjon, ikke på hver musebevegelse.
 */
export interface ConnectionDrag {
  nodeId: string
  portId: string
  direction: 'source' | 'target'
  type: ValueType
  /** Sant når brukeren drar fra en parameterinngang (diamant). */
  isParam?: boolean
}

interface ConnectionDragState {
  drag: ConnectionDrag | null
  start: (drag: ConnectionDrag) => void
  end: () => void
}

export const useConnectionDrag = create<ConnectionDragState>((set) => ({
  drag: null,
  start: (drag) => set({ drag }),
  end: () => set({ drag: null }),
}))
