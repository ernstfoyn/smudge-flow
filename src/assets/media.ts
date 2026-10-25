/**
 * Lokal filbank for bilder og video.
 *
 * Filene ligger i IndexedDB, ikke i grafens JSON. Noden lagrer bare en
 * asset-ID og litt metadata. Da kan et prosjekt med store videoer lagres
 * raskt, og samme fil kan brukes av flere noder uten å dupliseres.
 *
 * IndexedDB er per nettleser og per nettsted. En prosjektfil som åpnes på en
 * annen maskin mangler derfor filene, og noden må kobles til filen på nytt.
 */

const DB_NAME = 'smudgeflow.media.v1'
const STORE = 'assets'
const DB_VERSION = 1

export interface StoredAsset {
  id: string
  name: string
  mime: string
  size: number
  width?: number
  height?: number
  duration?: number
  createdAt: string
  blob: Blob
}

let dbPromise: Promise<IDBDatabase> | null = null
const urlCache = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Nettleseren tillater ikke lokal fillagring.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Kunne ikke åpne den lokale filbanken.'))
  })
  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Filbanken svarte med feil.'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Kunne ikke lagre filen.'))
    tx.onabort = () => reject(tx.error ?? new Error('Lagringen ble avbrutt.'))
  })
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (['png'].includes(ext)) return 'image/png'
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg'
  if (['webp'].includes(ext)) return 'image/webp'
  if (['gif'].includes(ext)) return 'image/gif'
  if (['avif'].includes(ext)) return 'image/avif'
  if (['mp4', 'm4v'].includes(ext)) return 'video/mp4'
  if (['webm'].includes(ext)) return 'video/webm'
  if (['mov'].includes(ext)) return 'video/quicktime'
  return ''
}

export function mediaMime(file: { type?: string; name: string }): string {
  return file.type || mimeFromName(file.name)
}

export function isVideoMime(mime: string): boolean {
  return mime.startsWith('video/')
}

export function isAudioMime(mime: string): boolean {
  return mime.startsWith('audio/')
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

/** Er filen noe Bilde/video-noden kan bruke? */
export function isMediaFile(file: { type?: string; name: string }): boolean {
  const mime = mediaMime(file)
  return isImageMime(mime) || isVideoMime(mime)
}

/** Er filen lyd? */
export function isAudioFile(file: { type?: string; name: string }): boolean {
  return isAudioMime(mediaMime(file))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** power
  return `${value >= 10 || power === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[power]}`
}

export function formatDuration(seconds?: number): string {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const total = Math.round(seconds)
  const min = Math.floor(total / 60)
  const sec = total % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

async function readMediaMeta(blob: Blob, mime: string): Promise<Pick<StoredAsset, 'width' | 'height' | 'duration'>> {
  if (isImageMime(mime)) {
    try {
      const bitmap = await createImageBitmap(blob)
      const meta = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      return meta
    } catch {
      return {}
    }
  }

  if (isAudioMime(mime)) {
    const url = URL.createObjectURL(blob)
    try {
      const audio = document.createElement('audio')
      audio.preload = 'metadata'
      audio.src = url
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve()
        audio.onerror = () => reject(new Error('Kunne ikke lese lydfilen.'))
      })
      return { duration: Number.isFinite(audio.duration) ? audio.duration : undefined }
    } catch {
      return {}
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  if (isVideoMime(mime)) {
    const url = URL.createObjectURL(blob)
    try {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = url
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve()
        video.onerror = () => reject(new Error('Kunne ikke lese videoen.'))
      })
      return {
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        duration: Number.isFinite(video.duration) ? video.duration : undefined,
      }
    } catch {
      return {}
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  return {}
}

function newAssetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `asset-${crypto.randomUUID()}`
  }
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Lagrer en fil og returnerer metadata + ID. */
export async function putAsset(file: File): Promise<StoredAsset> {
  const mime = mediaMime(file)
  const meta = await readMediaMeta(file, mime)
  const asset: StoredAsset = {
    id: newAssetId(),
    name: file.name || 'limt inn',
    mime,
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
    ...meta,
  }

  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(asset)
  await transactionDone(tx)
  return asset
}

export async function getAsset(id: string): Promise<StoredAsset | undefined> {
  if (!id) return undefined
  const db = await openDb()
  return requestResult(db.transaction(STORE, 'readonly').objectStore(STORE).get(id)) as Promise<
    StoredAsset | undefined
  >
}

export async function assetExists(id: string): Promise<boolean> {
  return !!(await getAsset(id))
}

/** Blob-URL for en lagret fil. URL-en gjenbrukes til siden lukkes. */
export async function getAssetUrl(id: string): Promise<string> {
  const cached = urlCache.get(id)
  if (cached) return cached

  const asset = await getAsset(id)
  if (!asset) throw new Error(`Filen «${id}» mangler i denne nettleseren.`)

  const url = URL.createObjectURL(asset.blob)
  urlCache.set(id, url)
  return url
}

export async function deleteAsset(id: string): Promise<void> {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(id)
  await transactionDone(tx)
}

/** Parametrene som lagres på Bilde/video-noden når en fil velges. */
export function mediaParamsFromAsset(asset: StoredAsset): Record<string, unknown> {
  return {
    sourceMode: 'file',
    assetId: asset.id,
    assetName: asset.name,
    assetMime: asset.mime,
    assetSize: asset.size,
    assetWidth: asset.width ?? 0,
    assetHeight: asset.height ?? 0,
    assetDuration: asset.duration ?? 0,
    src: '',
  }
}

/** Parametrene som lagres på Lyd-noden når en fil velges. */
export function audioParamsFromAsset(asset: StoredAsset): Record<string, unknown> {
  return {
    sourceMode: 'file',
    assetId: asset.id,
    assetName: asset.name,
    assetMime: asset.mime,
    assetSize: asset.size,
    assetDuration: asset.duration ?? 0,
    src: '',
  }
}

export function missingAssetMessage(name?: string): string {
  return `Filen «${name || 'ukjent'}» finnes ikke i denne nettleseren. Velg filen på nytt i Bilde/video-noden.`
}
