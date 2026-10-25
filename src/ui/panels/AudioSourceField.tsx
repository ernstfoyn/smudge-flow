import { useEffect, useRef, useState } from 'react'
import { Link2, Music, Upload } from 'lucide-react'
import type { GraphNode } from '../../engine/types'
import { useGraphStore } from '../../state/useGraphStore'
import {
  audioParamsFromAsset,
  formatBytes,
  formatDuration,
  getAsset,
  isAudioFile,
  putAsset,
  type StoredAsset,
} from '../../assets/media'
import { HelpLink } from '../primitives/HelpLink'

type Mode = 'file' | 'url'

function modeFor(node: GraphNode): Mode {
  const explicit = node.params.sourceMode
  if (explicit === 'file' || explicit === 'url') return explicit
  return node.params.assetId ? 'file' : node.params.src ? 'url' : 'file'
}

/** Kildevelger for Lyd-noden. Lyden lagres i samme lokale filbank som bilder. */
export function AudioSourceField({ node }: { node: GraphNode }) {
  const setParams = useGraphStore((s) => s.setParams)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>(() => modeFor(node))
  const [meta, setMeta] = useState<StoredAsset | null | undefined>(undefined)
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
    if (!assetId) {
      setMeta(null)
      return
    }
    getAsset(assetId)
      .then((asset) => {
        if (alive) setMeta(asset ?? null)
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
    if (!isAudioFile(file)) {
      setError('Velg en lydfil.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const asset = await putAsset(file)
      setParams(node.id, audioParamsFromAsset(asset))
      setMode('file')
    } catch (err) {
      setError((err as Error)?.message ?? 'Kunne ikke lagre lydfilen.')
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

  const missing = !!assetId && meta === null

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Lydkilde
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
        accept="audio/*"
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
            fileOver ? 'border-lime-500/70 bg-lime-500/10' : 'border-zinc-700 bg-zinc-950/50'
          }`}
        >
          {assetId && meta ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded border border-zinc-700 bg-black">
                <Music size={18} className="text-zinc-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] text-zinc-200" title={meta.name}>
                  {meta.name}
                </p>
                <p className="text-[10px] text-zinc-500">
                  Lyd · {formatBytes(meta.size)}
                  {meta.duration ? ` · ${formatDuration(meta.duration)}` : ''}
                </p>
              </div>
            </div>
          ) : assetId && meta === undefined ? (
            <p className="p-2 text-[11px] text-zinc-500">Laster lydfil …</p>
          ) : assetId ? (
            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
              Lydfilen er ikke i denne nettleseren. Velg den på nytt for å koble den til
              noden.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-700 text-zinc-500 hover:border-lime-500/50 hover:text-zinc-300"
            >
              <Upload size={16} />
              <span className="text-[11px]">Velg lydfil, eller dra den hit</span>
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
            Nettadresser må tillate CORS. Lokale filer er tryggest.
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
          Koble til lydfil på nytt
        </button>
      )}

      {error && <p className="text-[10px] text-red-300">{error}</p>}
      <div>
        <HelpLink topic="lyd" />
      </div>
    </div>
  )
}
