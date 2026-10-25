import type { RenderServices } from '../src/engine/types'

/**
 * Minimal RenderServices for tester som ikke tegner.
 * Kaster hvis en node faktisk prøver å bruke lerretet eller GPU-en.
 */
export function fakeRender(width = 10, height = 10): RenderServices {
  return {
    width,
    height,
    canvas: () => {
      throw new Error('Ikke støttet i test')
    },
    assets: {
      resolveAsset: async () => {
        throw new Error('Ikke støttet i test')
      },
      audio: async () => {
        throw new Error('Ikke støttet i test')
      },
      image: async () => {
        throw new Error('Ikke støttet i test')
      },
      videoFrame: async () => {
        throw new Error('Ikke støttet i test')
      },
    },
    touch: () => {},
    versionOf: () => 0,
    post: async () => {
      throw new Error('Ikke støttet i test')
    },
    dispose: () => {},
  }
}
