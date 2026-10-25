/**
 * Type-API for den lokalt vendorede MediaBunny-byggingen.
 *
 * Selve biblioteket ligger i ./mediabunny.js (uendret, MPL-2.0) og lastes
 * dynamisk, slik at det ikke øker oppstartstiden i appen.
 * https://github.com/Vanilagy/mediabunny/tree/v1.61.3
 */
export interface MediaBunnyQuality {
  bitrate?: number
}

export interface MediaBunnyApi {
  Quality: new (options?: { bitrate?: number }) => MediaBunnyQuality
  Mp4OutputFormat: new (options?: { fastStart?: 'in-memory' | 'fragment' | 'moov' }) => unknown
  WebMOutputFormat: new (options?: Record<string, unknown>) => unknown
  BufferTarget: new () => { buffer: ArrayBuffer }
  CanvasSource: new (
    canvas: HTMLCanvasElement,
    options: { codec: string; quality: MediaBunnyQuality; latencyMode?: string },
  ) => {
    add(timestamp: number, duration: number, options?: { keyFrame?: boolean }): Promise<void>
  }
  Output: new (options: { format: unknown; target: { buffer: ArrayBuffer } }) => {
    target: { buffer: ArrayBuffer }
    addVideoTrack(source: unknown, options?: { frameRate?: number }): void
    addAudioTrack(source: unknown, options?: Record<string, unknown>): void
    start(): Promise<void>
    finalize(): Promise<void>
    cancel(): Promise<void>
  }
  canEncodeVideo(
    codec: string,
    options: { width: number; height: number; frameRate: number; quality: MediaBunnyQuality },
  ): Promise<boolean>
  canEncodeAudio(
    codec: string,
    options: {
      numberOfChannels: number
      sampleRate: number
      bitrate?: number
      quality?: MediaBunnyQuality
    },
  ): Promise<boolean>
  AudioBufferSource: new (config: {
    codec: string
    bitrate?: number
    quality?: MediaBunnyQuality
  }) => {
    add(audioBuffer: AudioBuffer): Promise<void>
  }
}
