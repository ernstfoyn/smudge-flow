import { Evaluator } from '../engine/evaluator'
import { BrowserRenderServices } from '../render/RenderServices'
import { registry } from '../nodes'

/**
 * Motorens singletons.
 *
 * Evalueringsmotoren lever utenfor React, slik at eksporten kan kjøre
 * uten å trigge re-renders, og slik at preview og eksport deler samme cache.
 */
export const renderServices = new BrowserRenderServices(960, 960)
export const evaluator = new Evaluator(registry, renderServices)
