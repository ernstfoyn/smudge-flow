import { create } from 'zustand'

interface EditorState {
  /** Økes hver gang brukeren ber om auto-layout. */
  layoutRequest: number
  requestLayout: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  layoutRequest: 0,
  requestLayout: () => set((s) => ({ layoutRequest: s.layoutRequest + 1 })),
}))
