import { useEffect, useRef, useState } from 'react'
import { Film, Image as ImageIcon, Link2, Upload } from 'lucide-react'
import type { GraphNode } from '../../engine/types'
import { HelpLink } from '../primitives/HelpLink'
import { useGraphStore } from '../../state/useGraphStore'
import {
  formatBytes,
  formatDuration,
  getAsset,
  getAssetUrl,
  isImageMime,
  isMediaFile,
  isVideoMime,
  mediaParamsFromAsset,
  putAsset,
  type StoredAsset,
} from '../../assets/media'

type Mode = 'file' | 'url'

function modeFor(node: GraphNode): Mode {
  const explicit = node.params.sourceMode
  if (explicit === 'file' || explicit === 'url') return explicit
  return node.params.assetId ? 'file' : node.params.src ? 'url' : 'file'
}

/**
 * Kilden til Bilde/video-noden.
 *
 * Lokale filer lagres i IndexedDB, så grafens JSON holder seg liten. En
 * prosjektfil kan derfor åpnes uten filene; da vises en advarsel og knappen
 * for å koble til filen på nytt.
 */
export function MediaSourceField({ node }: { node: GraphNode }) {
  const setParams = useGraphStore((s) => s.setParams)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>(() => modeFor(node))
  const [meta, setMeta] = useState<StoredAsset | null | undefined>(undefined)
  const [thumb, setThumb] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [fileOver, setFileOver] = useState(false)

  const assetId = String(node.params.assetId ?? '')
  const src = String(node.params.src ?? '')

  useEffect(() => {
    setMode(modeFor(node))
  }, [node.id, node.params.sourceMode, node.params.assetId, node.params.src])

  useEffect(() => {
    let alive = true
    setMeta(undefined)
    setThumb(null)
    if (!assetId) {
      setMeta(null)
      return
    }

    getAsset(assetId)
      .then(async (asset) => {
        if (!alive) return
        setMeta(asset ?? null)
        if (asset && isImageMime(asset.mime)) {
          const url = await getAssetUrl(assetId)
          if (alive) setThumb(url)
        }
      })
      .catch(() => {
        if (alive) setMeta(null)
      })

    return () => {
      alive = false
    }
  }, [assetId])

  const takeFile = async (file: File | undefined) => {
    if (!file) return
    if (!isMediaFile(file)) {
      setError('Velg et bilde eller en video.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const asset = await putAsset(file)
      setParams(node.id, mediaParamsFromAsset(asset))
      setMode('file')
    } catch (err) {
      setError((err as Error)?.message ?? 'Kunne ikke lagre filen.')
    } finally {
      setBusy(false)
    }
  }

  const removeFile = () => {
    setParams(node.id, {
      sourceMode: 'file',
      assetId: '',
      assetName: '',
      assetMime: '',
      assetSize: 0,
      assetWidth: 0,
      assetHeight: 0,
      assetDuration: 0,
    })
    setError(null)
    setMode('file')
  }

  const chooseMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setParams(node.id, { sourceMode: next })
  }

  const isVideo = !!meta && isVideoMime(meta.mime)
  const missing = !!assetId && meta === null

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Kilde
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => chooseMode('file')}
            className={`rounded border px-2 py-0.5 text-[10px] ${
              mode === 'file'
                ? 'border-lime-500/60 bg-lime-500/10 text-lime-300'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            Fil
          </button>
          <button
            type="button"
            onClick={() => chooseMode('url')}
            className={`rounded border px-2 py-0.5 text-[10px] ${
              mode === 'url'
                ? 'border-lime-500/60 bg-lime-500/10 text-lime-300'
                : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
            }`}
          >
            URL
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => {
          void takeFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {mode === 'file' ? (
        <div
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('Files')) {
              event.preventDefault()
              setFileOver(true)
            }
          }}
          onDragLeave={() => setFileOver(false)}
          onDrop={(event) => {
            if (!event.dataTransfer.files.length) return
            event.preventDefault()
            event.stopPropagation()
            setFileOver(false)
            void takeFile(event.dataTransfer.files[0])
          }}
          className={`flex min-w-0 flex-col gap-2 rounded-lg border p-2 transition ${
            fileOver
              ? 'border-lime-500/70 bg-lime-500/10'
              : 'border-zinc-700 bg-zinc-950/50'
          }`}
        >
          {assetId && meta ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700 bg-black">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                ) : isVideo ? (
                  <Film size={18} className="text-zinc-400" />
                ) : (
                  <ImageIcon size={18} className="text-zinc-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-zinc-200" title={meta.name}>
                  {meta.name}
                </p>
                <p className="text-[10px] text-zinc-500">
                  {isVideo ? 'Video' : 'Bilde'} · {formatBytes(meta.size)}
                  {meta.width ? ` · ${meta.width}×${meta.height}` : ''}
                  {meta.duration ? ` · ${formatDuration(meta.duration)}` : ''}
                </p>
              </div>
            </div>
          ) : assetId && meta === undefined ? (
            <p className="p-2 text-[11px] text-zinc-500">Laster fil …</p>
          ) : assetId ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
              Filen er ikke i denne nettleseren. Velg den på nytt for å koble den til
              noden.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-lime-500/50 hover:text-zinc-300"
            >
              <Upload size={16} />
              <span className="text-[11px]">Velg bilde/video, eller dra filen hit</span>
            </button>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {busy ? 'Lagrer…' : assetId ? 'Bytt fil' : 'Velg fil'}
            </button>
            {assetId && (
              <button
                type="button"
                onClick={removeFile}
                className="rounded border border-red-900/70 px-2 py-0.5 text-[10px] text-red-300 hover:bg-red-950/40"
              >
                Fjern
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="flex min-w-0 items-center gap-2">
            <Link2 size={13} className="shrink-0 text-zinc-500" />
            <input
              type="text"
              value={src}
              onChange={(event) =>
                setParams(node.id, { sourceMode: 'url', src: event.target.value })
              }
              placeholder="https:// …"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            />
          </label>
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Nettadresser må tillate CORS for at eksporten skal virke. Lokale filer er
            tryggest.
          </p>
          <button
            type="button"
            onClick={() => chooseMode('file')}
            className="self-start rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-800"
          >
            Bruk lokal fil i stedet
          </button>
        </div>
      )}

      {missing && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start rounded border border-amber-500/50 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10"
        >
          Koble til fil på nytt
        </button>
      )}

      {error && <p className="text-[10px] text-red-300">{error}</p>}
      <div>
        <HelpLink topic="bilde-video" />
      </div>
    </div>
  )
}
