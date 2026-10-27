import { describe, expect, it } from 'vitest'
import { motionGraphicsSource } from '../src/nodes/source/motionGraphicsSource'
import type { EvalContext, RenderServices } from '../src/engine/types'
import { fakeRender } from './fakeRender'

function renderWithColors() {
  const colors: string[] = []
  const props: Record<string, unknown> = {}
  const ctx = new Proxy(
    {
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
    },
    {
      set(_t, key, value) {
        props[String(key)] = value
        if (key === 'fillStyle') colors.push(String(value))
        return true
      },
      get(t, key) {
        if (key in t) return t[key as keyof typeof t]
        return props[String(key)]
      },
    },
  )
  const canvas = { width: 200, height: 100 } as HTMLCanvasElement
  const render = {
    ...fakeRender(200, 100),
    canvas: () => ({ canvas, ctx, width: 200, height: 100, version: 0 }),
  } as unknown as RenderServices
  return { render, colors }
}

const context = (render: RenderServices): EvalContext => ({
  nodeId: 'motion',
  scopeKey: 'root/motion',
  frame: 0,
  fps: 60,
  totalFrames: 60,
  time: 0,
  phase: 0,
  width: 200,
  height: 100,
  render,
  nodeCache: new Map(),
})

describe('Generativ grafikk med flerfarge', () => {
  it('bruker fargestoppene når gradientfarger er på', () => {
    const { render, colors } = renderWithColors()
    motionGraphicsSource.evaluate(context(render), {}, {
      motion: 'dotfield', count: 24, columns: 8, spacing: 70, phaseOffset: 0,
      lineWidth: 3, size: 40, spread: 100, amplitude: 100, centerX: 50, centerY: 50,
      opacity: 100, scale: 0, rotation: 0, speed: 1, useGradient: true,
      colorA: '#b9ff66', colorB: '#4bdac5',
      stops: [
        { position: 0, color: '#ff0000', softness: 1 },
        { position: 0.5, color: '#00ff00', softness: 1 },
        { position: 1, color: '#0000ff', softness: 1 },
      ],
    })
    expect(new Set(colors).size).toBeGreaterThan(3)
    expect(colors.every((c) => c.startsWith('#'))).toBe(true)
  })
})
