import { create } from 'zustand'

const SEEN_KEY = 'smudgeflow.help.seen'

/** Har brukeren sett velkomstvinduet før? */
export function hasSeenHelp(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function markHelpSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // Privat modus: vinduet vises da igjen neste gang, og det er greit.
  }
}

interface HelpState {
  open: boolean
  topic: string
  show: (topic?: string) => void
  close: () => void
  toggle: () => void
}

export const useHelpStore = create<HelpState>((set, get) => ({
  open: false,
  topic: 'kom-i-gang',
  show: (topic) => set((s) => ({ open: true, topic: topic ?? s.topic })),
  close: () => {
    markHelpSeen()
    set({ open: false })
  },
  toggle: () => (get().open ? get().close() : get().show()),
}))
