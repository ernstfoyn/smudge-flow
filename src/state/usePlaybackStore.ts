import { create } from 'zustand'

interface PlaybackState {
  isPlaying: boolean
  frame: number
  /** Rest av tiden mot neste frame (ms). */
  accumulated: number
  /** Øker hver gang tidslinjen skal hoppe til en ny frame. */
  seekToken: number

  play: () => void
  pause: () => void
  toggle: () => void
  seek: (frame: number) => void
  step: (delta: number) => void
  tick: (fps: number, totalFrames: number, deltaMs: number, loop: boolean) => void
}

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  isPlaying: true,
  frame: 0,
  accumulated: 0,
  seekToken: 0,

  play: () => set({ isPlaying: true, accumulated: 0 }),
  pause: () => set({ isPlaying: false, accumulated: 0 }),
  toggle: () => {
    const playing = get().isPlaying
    set({ isPlaying: !playing, accumulated: 0 })
  },

  seek: (frame) =>
    set((s) => ({ frame: Math.max(0, Math.round(frame)), accumulated: 0, seekToken: s.seekToken + 1 })),

  step: (delta) =>
    set((s) => ({ frame: Math.max(0, s.frame + delta), accumulated: 0, seekToken: s.seekToken + 1 })),

  /**
   * Avanserer tidslinjen med faste frames per sekund, akkurat som i den
   * gamle kodebasen — slik at en gitt frame alltid ser identisk ut.
   */
  tick: (fps, totalFrames, deltaMs, loop) => {
    const state = get()
    if (!state.isPlaying) return

    const step = 1000 / Math.max(1, fps)
    let remaining = state.accumulated + Math.min(deltaMs, 250)
    let frame = state.frame

    let guard = 0
    while (remaining >= step && guard++ < 600) {
      remaining -= step
      frame += 1
      if (frame >= totalFrames) frame = loop ? 0 : Math.max(0, totalFrames - 1)
    }

    set({ frame, accumulated: remaining })
  },
}))
