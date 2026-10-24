import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_PANEL_LAYOUT,
  fitPanelLayout,
  type PanelLayout,
  type WorkspaceSize,
} from './layoutMath'

const STORAGE_KEY = 'smudgeflow.ui.layout.v1'

function readStoredLayout(): PanelLayout {
  if (typeof localStorage === 'undefined') return DEFAULT_PANEL_LAYOUT

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PANEL_LAYOUT
    const parsed = JSON.parse(raw) as Partial<PanelLayout>
    const pick = (value: unknown, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback

    return {
      left: pick(parsed.left, DEFAULT_PANEL_LAYOUT.left),
      right: pick(parsed.right, DEFAULT_PANEL_LAYOUT.right),
      bottom: pick(parsed.bottom, DEFAULT_PANEL_LAYOUT.bottom),
    }
  } catch {
    return DEFAULT_PANEL_LAYOUT
  }
}

/** Måler et element med ResizeObserver, slik at panelgrensene følger vinduet. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<WorkspaceSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const rect = element.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      )
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, size] as const
}

/**
 * Justerbare hovedpaneler med lagrede størrelser.
 *
 * `layout` er den effektive størrelsen etter at grensene er brukt, mens
 * brukerens siste ønske blir liggende i localStorage. Derfor kan et panel
 * gjenoppta en større bredde hvis vinduet blir bredt igjen.
 */
export function usePanelLayout(workspace: WorkspaceSize) {
  const [requested, setRequested] = useState<PanelLayout>(readStoredLayout)

  const fitted = useMemo(
    () => fitPanelLayout(requested, workspace),
    [requested, workspace.width, workspace.height],
  )

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(requested))
    } catch {
      // Privat modus / full lagring: størrelsene gjelder bare denne økten.
    }
  }, [requested])

  const setPanel = (key: keyof PanelLayout, value: number) => {
    setRequested((current) => ({ ...current, [key]: value }))
  }

  const resetPanel = (key: keyof PanelLayout) => {
    setRequested((current) => ({ ...current, [key]: DEFAULT_PANEL_LAYOUT[key] }))
  }

  return { ...fitted, setPanel, resetPanel }
}
