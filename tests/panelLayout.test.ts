import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PANEL_LAYOUT,
  PANEL_HANDLE_SIZE,
  fitPanelLayout,
  type PanelLayout,
} from '../src/ui/layoutMath'

const workspace = { width: 1440, height: 900 }

function expectNoOverflow(layout: PanelLayout, size: { width: number; height: number }) {
  const fitted = fitPanelLayout(layout, size)
  expect(fitted.layout.left + fitted.layout.right + fitted.mainWidth + PANEL_HANDLE_SIZE * 2).toBe(
    size.width,
  )
  expect(fitted.layout.bottom + fitted.graphHeight + PANEL_HANDLE_SIZE).toBe(size.height)
  expect(fitted.layout.left).toBeGreaterThanOrEqual(fitted.limits.left.min)
  expect(fitted.layout.right).toBeGreaterThanOrEqual(fitted.limits.right.min)
  expect(fitted.mainWidth).toBeGreaterThan(0)
  expect(fitted.graphHeight).toBeGreaterThan(0)
  return fitted
}

describe('fitPanelLayout', () => {
  it('holder standardlayouten innenfor arbeidsflaten', () => {
    const fitted = expectNoOverflow(DEFAULT_PANEL_LAYOUT, workspace)
    expect(fitted.layout.left).toBe(DEFAULT_PANEL_LAYOUT.left)
    expect(fitted.layout.right).toBe(DEFAULT_PANEL_LAYOUT.right)
    expect(fitted.layout.bottom).toBe(DEFAULT_PANEL_LAYOUT.bottom)
  })

  it('krymper lagrede bredder når vinduet blir smalere', () => {
    const wide: PanelLayout = { left: 520, right: 900, bottom: 560 }
    const fitted = expectNoOverflow(wide, { width: 900, height: 700 })

    expect(fitted.layout.left).toBeLessThan(wide.left)
    expect(fitted.layout.right).toBeLessThan(wide.right)
    expect(fitted.mainWidth).toBeGreaterThanOrEqual(160)
  })

  it('lar ett panel vokse helt til det andre og grafen har minimumsplass', () => {
    const fitted = fitPanelLayout(DEFAULT_PANEL_LAYOUT, workspace)
    const maxLeft = fitted.limits.left.max
    const expanded = fitPanelLayout({ ...DEFAULT_PANEL_LAYOUT, left: maxLeft }, workspace)

    expect(expanded.layout.left).toBe(maxLeft)
    expect(expanded.layout.right).toBeGreaterThanOrEqual(expanded.limits.right.min)
    expect(expanded.mainWidth).toBeGreaterThan(0)
  })

  it('gir alltid en positiv grafhøyde, også i et lavt vindu', () => {
    const fitted = expectNoOverflow({ left: 260, right: 500, bottom: 560 }, { width: 700, height: 220 })
    expect(fitted.graphHeight).toBeGreaterThan(0)
  })

  it('tåler at panelet ennå ikke er målt', () => {
    const fitted = fitPanelLayout(DEFAULT_PANEL_LAYOUT, { width: 0, height: 0 })
    expect(fitted.mainWidth).toBeGreaterThan(0)
    expect(fitted.graphHeight).toBeGreaterThan(0)
    expect(Number.isFinite(fitted.layout.left)).toBe(true)
    expect(Number.isFinite(fitted.layout.right)).toBe(true)
    expect(Number.isFinite(fitted.layout.bottom)).toBe(true)
  })
})
