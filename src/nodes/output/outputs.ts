import type { NodeDefinition } from '../../engine/types'

/**
 * Terminal node. Merker hvilken gren av grafen som er leveransen.
 *
 * Viewport = det du ser i forhåndsvisningen.
 * Eksport  = det som kodes til MP4/WebM.
 */
export const viewport: NodeDefinition = {
  type: 'output.viewport',
  label: 'Viewport',
  category: 'output',
  inputs: [{ id: 'frame', label: 'Frame', type: 'canvas' }],
  outputs: [],
  params: [],
  evaluate(_ctx, { frame: input }) {
    return { frame: input }
  },
}

export const exportOutput: NodeDefinition = {
  type: 'output.export',
  label: 'MP4-eksport',
  category: 'output',
  inputs: [{ id: 'frame', label: 'Frame', type: 'canvas' }],
  outputs: [],
  params: [
    {
      key: 'format', label: 'Format', type: 'enum', default: 'mp4',
      options: [
        { value: 'mp4', label: 'MP4 (H.264)' },
        { value: 'webm', label: 'WebM (VP9)' },
      ],
    },
    { key: 'bitrate', label: 'Bitrate', type: 'number', default: 12_000_000, min: 1_000_000, max: 40_000_000, step: 500_000 },
  ],
  evaluate(_ctx, { frame: input }) {
    return { frame: input }
  },
}
