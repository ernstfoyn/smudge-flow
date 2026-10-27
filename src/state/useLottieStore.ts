import { create } from 'zustand'
import { analyzeLottie, type LottieAnalysis } from '../export/lottie/compat'
import { useGraphStore } from './useGraphStore'

interface LottieState {
  /** Vis kompatibilitetsfarger på nodekortene. */
  mode: boolean
  analysis: LottieAnalysis | null
  setMode: (mode: boolean) => void
  refresh: (graph?: Parameters<typeof analyzeLottie>[0]) => void
}

export const useLottieStore = create<LottieState>((set, get) => ({
  mode: false,
  analysis: null,
  setMode: (mode) => {
    if (!mode) {
      set({ mode: false, analysis: null })
      return
    }
    set({ mode: true, analysis: analyzeLottie(useGraphStore.getState().graph) })
  },
  refresh: (graph) => {
    if (!get().mode) return
    set({ analysis: analyzeLottie(graph ?? useGraphStore.getState().graph) })
  },
}))

let lastGraph = useGraphStore.getState().graph
useGraphStore.subscribe((state) => {
  if (state.graph === lastGraph) return
  lastGraph = state.graph
  useLottieStore.getState().refresh(state.graph)
})
