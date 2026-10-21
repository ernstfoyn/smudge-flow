import { Evaluator } from '../engine/evaluator'
import { BrowserRenderServices } from '../render/RenderServices'
import { registry } from '../nodes'
import { useGraphStore } from './useGraphStore'

/**
 * Motorens singletons.
 *
 * Evalueringsmotoren lever utenfor React, slik at eksporten kan kjøre
 * uten å trigge re-renders, og slik at preview og eksport deler samme cache.
 */
export const renderServices = new BrowserRenderServices(960, 960)
export const evaluator = new Evaluator(registry, renderServices)

/**
 * Dev-håndtak for inspeksjon fra konsollen:
 *   smudgeFlow.store.getState().graph
 *   smudgeFlow.evaluator.evaluateFrame(graph, 0, ['node-id'])
 */
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).smudgeFlow = {
    store: useGraphStore,
    evaluator,
    renderServices,
  }
}
