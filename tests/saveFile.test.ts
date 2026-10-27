import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickExportDirectory, writeBlobToDirectory } from '../src/export/saveFile'

function fakeDirectory(files: Map<string, Blob> = new Map()): FileSystemDirectoryHandle {
  return {
    name: 'Eksport',
    async getFileHandle(name: string, options?: { create?: boolean }) {
      if (!files.has(name) && !options?.create) {
        const error = new Error('missing')
        error.name = 'NotFoundError'
        throw error
      }
      return {
        name,
        async createWritable() {
          return {
            async write(blob: Blob) {
              files.set(name, blob)
            },
            async close() {},
          }
        },
      }
    },
  } as unknown as FileSystemDirectoryHandle
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lagringsdialog', () => {
  it('rapporterer at File System Access ikke er støttet', async () => {
    vi.stubGlobal('window', {})
    await expect(pickExportDirectory()).resolves.toEqual({ kind: 'unsupported' })
  })

  it('returnerer valgt mappe', async () => {
    const handle = fakeDirectory()
    vi.stubGlobal('window', { showDirectoryPicker: async () => handle })
    const result = await pickExportDirectory()
    expect(result.kind).toBe('directory')
    if (result.kind === 'directory') expect(result.name).toBe('Eksport')
  })

  it('oppfatter avbrutt dialog', async () => {
    vi.stubGlobal('window', {
      showDirectoryPicker: async () => {
        const error = new Error('avbrutt')
        error.name = 'AbortError'
        throw error
      },
    })
    await expect(pickExportDirectory()).resolves.toEqual({ kind: 'cancelled' })
  })

  it('skriver filen og lager nytt navn hvis den finnes', async () => {
    const files = new Map<string, Blob>()
    const first = new Blob(['gammel'])
    files.set('smudge-flow.lottie.json', first)
    const savedName = await writeBlobToDirectory(
      fakeDirectory(files),
      'smudge-flow.lottie.json',
      new Blob(['ny']),
    )
    expect(savedName).toBe('smudge-flow-2.lottie.json')
    expect(files.get('smudge-flow.lottie.json')).toBe(first)
    expect(await files.get('smudge-flow-2.lottie.json')?.text()).toBe('ny')
  })
})
