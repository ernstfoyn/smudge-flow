/**
 * Lagring til en mappe brukeren velger i en Finder-dialog.
 *
 * File System Access API finnes i Chromium-nettlesere. Safari og Firefox
 * faller tilbake til vanlig nedlasting, som før.
 */

interface DirectoryPickerOptions {
  id?: string
  mode?: 'read' | 'readwrite'
  startIn?: FileSystemHandle | string
}

declare global {
  interface Window {
    showDirectoryPicker?: (
      options?: DirectoryPickerOptions,
    ) => Promise<FileSystemDirectoryHandle>
  }
}

export type ExportDestination =
  | { kind: 'directory'; handle: FileSystemDirectoryHandle; name: string }
  | { kind: 'unsupported' }
  | { kind: 'cancelled' }

export async function pickExportDirectory(): Promise<ExportDestination> {
  const picker = typeof window !== 'undefined' ? window.showDirectoryPicker : undefined
  if (typeof picker !== 'function') return { kind: 'unsupported' }
  try {
    const handle = await picker.call(window, { id: 'smudge-flow-export', mode: 'readwrite' })
    return { kind: 'directory', handle, name: handle.name }
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return { kind: 'cancelled' }
    throw error
  }
}

async function existingFile(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name)
    return true
  } catch (error) {
    if ((error as DOMException)?.name === 'NotFoundError') return false
    throw error
  }
}

function splitFilename(filename: string): { base: string; extension: string } {
  // Behandle .lottie.json som én sammensatt endelse, så kopien blir
  // «smudge-flow-2.lottie.json» og ikke «smudge-flow.lottie-2.json».
  if (filename.endsWith('.lottie.json')) {
    return { base: filename.slice(0, -'.lottie.json'.length), extension: '.lottie.json' }
  }
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return { base: filename, extension: '' }
  return { base: filename.slice(0, dot), extension: filename.slice(dot) }
}

/**
 * Skriver filen i valgt mappe, med et ledig navn hvis filen finnes fra før.
 * Returnerer det faktiske filnavnet.
 */
export async function writeBlobToDirectory(
  directory: FileSystemDirectoryHandle,
  filename: string,
  blob: Blob,
): Promise<string> {
  const { base, extension } = splitFilename(filename)
  for (let index = 0; index < 1000; index++) {
    const name = index === 0 ? filename : `${base}-${index + 1}${extension}`
    if (await existingFile(directory, name)) continue
    const handle = await directory.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    try {
      await writable.write(blob)
    } finally {
      await writable.close()
    }
    return name
  }
  throw new Error('Fant ikke et ledig filnavn i den valgte mappen.')
}

/** Vanlig nedlasting, for nettlesere uten File System Access API. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
