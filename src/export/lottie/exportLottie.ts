import type { Graph, GraphEdge, GraphNode, Keyframe } from '../../engine/types'
import { valueAt } from '../../engine/animation/keyframes'
import { registry } from '../../nodes'
import { color as sampleColor, stops as gradientStops, type GradientStop } from '../../engine/color/gradient'
import {
  scatter2DCount,
  scatter2DInstance,
  type Scatter2DParams,
} from '../../nodes/modifier/scatter2D'
import { analyzeLottie, type LottieAnalysis } from './compat'

export interface LottieExportOptions {
  targetId?: string | null
  /** Antall samplepunkter når myke gradientstopp skal bli Lottie-stopp. */
  gradientSamples?: number
}

export interface LottieExportResult {
  json: string
  document: Record<string, any>
  analysis: LottieAnalysis
  warnings: string[]
  layers: number
}

type Json = Record<string, any>

const BLEND: Record<string, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
  overlay: 3,
  darken: 4,
  lighten: 5,
  difference: 10,
  add: 16,
}

interface Builder {
  nextInd: number
  fonts: Map<string, Json>
  warnings: string[]
  gradientSamples: number
}

function paramsFor(node: GraphNode): Record<string, any> {
  const def = registry.get(node.type)
  const defaults: Record<string, unknown> = {}
  for (const param of def.params) defaults[param.key] = param.default
  return { ...defaults, ...node.params }
}

function rgb(hex: string): [number, number, number] {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim())
  let value = match?.[1] ?? '000000'
  if (value.length === 3) {
    value = value
      .split('')
      .map((part) => part + part)
      .join('')
  }
  const n = parseInt(value, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function rgba(hex: string): number[] {
  const [r, g, b] = rgb(hex)
  return [r, g, b, 1]
}

function prop(value: number | number[]): Json {
  return { a: 0, k: value }
}

function animatedNumber(
  node: GraphNode,
  _graph: Graph,
  key: string,
  base: number,
  map: (value: number) => number = (value) => value,
): Json {
  const track = node.tracks?.[key]
  if (!track?.length) return prop(map(base))
  const sorted = [...track].sort((a, b) => a.frame - b.frame)
  const keys = sorted.map((keyframe) => ({
    t: Math.round(keyframe.frame),
    s: [map(Number(keyframe.value))],
    ...(keyframe.interpolation === 'hold' ? { h: 1 } : {}),
  }))
  if (keys[0].t > 0) {
    keys.unshift({ t: 0, s: [map(Number(valueAt(base, track, 0)))] })
  }
  if (keys.length === 1) return { a: 0, k: keys[0].s[0] }
  return { a: 1, k: keys }
}

function unionFrames(graph: Graph, tracks: Array<Keyframe[] | undefined>): number[] {
  const frames = new Set<number>([0, Math.max(1, graph.settings.frames - 1)])
  for (const track of tracks) {
    for (const key of track ?? []) frames.add(Math.round(key.frame))
  }
  return [...frames].sort((a, b) => a - b)
}

function animatedVector(
  node: GraphNode,
  graph: Graph,
  values: Array<{ key: string; base: number; map?: (value: number) => number }>,
  tail: number[] = [],
): Json {
  const tracks = values.map((item) => node.tracks?.[item.key])
  if (!tracks.some((track) => track?.length)) {
    return prop([...values.map((item) => (item.map ?? ((value: number) => value))(item.base)), ...tail])
  }
  const frames = unionFrames(graph, tracks)
  const keys = frames.map((frame) => ({
    t: frame,
    s: [
      ...values.map((item) =>
        (item.map ?? ((value: number) => value))(
          Number(valueAt(item.base, node.tracks?.[item.key], frame)),
        ),
      ),
      ...tail,
    ],
  }))
  return { a: 1, k: keys }
}

function layerBase(node: GraphNode, graph: Graph, type: number, builder: Builder): Json {
  return {
    ddd: 0,
    ind: builder.nextInd++,
    ty: type,
    nm: node.title,
    sr: 1,
    ks: {
      o: prop(100),
      r: prop(0),
      p: prop([0, 0, 0]),
      a: prop([0, 0, 0]),
      s: prop([100, 100, 100]),
    },
    ip: 0,
    op: Math.max(1, graph.settings.frames),
    st: 0,
    bm: 0,
  }
}

function shapeLayer(node: GraphNode, graph: Graph, builder: Builder): Json {
  const p = paramsFor(node)
  const canvasW = graph.settings.width
  const canvasH = graph.settings.height
  const shapeW = Math.max(1, canvasW * Number(p.width ?? 0.4))
  const shapeH = Math.max(1, canvasH * Number(p.height ?? 0.4))
  const kind = String(p.shape ?? 'ellipse')
  const layer = layerBase(node, graph, 4, builder)
  const items: Json[] = []

  if (kind === 'rectangle') {
    items.push({
      ty: 'rc',
      d: 1,
      s: animatedVector(
        node,
        graph,
        [
          { key: 'width', base: Number(p.width ?? 0.4), map: (v) => Math.max(1, v * canvasW) },
          { key: 'height', base: Number(p.height ?? 0.4), map: (v) => Math.max(1, v * canvasH) },
        ],
      ),
      p: prop([0, 0]),
      r: prop(0),
      nm: 'Rectangle',
    })
  } else if (kind === 'ellipse') {
    items.push({
      ty: 'el',
      d: 1,
      s: animatedVector(
        node,
        graph,
        [
          { key: 'width', base: Number(p.width ?? 0.4), map: (v) => Math.max(1, v * canvasW) },
          { key: 'height', base: Number(p.height ?? 0.4), map: (v) => Math.max(1, v * canvasH) },
        ],
      ),
      p: prop([0, 0]),
      nm: 'Ellipse',
    })
  } else {
    items.push({
      ty: 'sh',
      ks: { a: 0, k: pathFor(kind, shapeW, shapeH, p) },
      nm: 'Path',
    })
  }

  if (p.gradient) {
    items.push(gradientFill(node, shapeW, shapeH, p, builder))
  } else {
    items.push({
      ty: 'fl',
      c: prop(rgba(String(p.fill ?? '#b9ff66'))),
      o: prop(100),
      r: 1,
      bm: 0,
      nm: 'Fill',
    })
  }

  const strokeWidth = Number(p.strokeWidth ?? 0)
  if (strokeWidth > 0) {
    items.push({
      ty: 'st',
      c: prop(rgba(String(p.stroke ?? '#ffffff'))),
      o: prop(100),
      w: animatedNumber(node, graph, 'strokeWidth', strokeWidth),
      lc: 2,
      lj: 2,
      ml: 4,
      bm: 0,
      nm: 'Stroke',
    })
  }

  items.push({
    ty: 'tr',
    p: prop([0, 0]),
    a: prop([0, 0]),
    s: prop([100, 100]),
    r: prop(0),
    o: prop(100),
    sk: prop(0),
    sa: prop(0),
  })

  layer.shapes = [{ ty: 'gr', it: items, nm: node.title }]
  layer.ks = {
    o: animatedNumber(node, graph, 'opacity', Number(p.opacity ?? 1), (v) => v * 100),
    r: animatedNumber(node, graph, 'rotation', Number(p.rotation ?? 0)),
    p: animatedVector(node, graph, [
      { key: 'x', base: Number(p.x ?? 0.5), map: (v) => v * canvasW },
      { key: 'y', base: Number(p.y ?? 0.5), map: (v) => v * canvasH },
    ], [0]),
    a: prop([0, 0, 0]),
    s: animatedVector(
      node,
      graph,
      [{ key: 'scale', base: Number(p.scale ?? 1), map: (v) => v * 100 }],
      [100],
    ),
  }
  return layer
}

function pathFor(kind: string, width: number, height: number, p: Record<string, any>): Json {
  const hw = width / 2
  const hh = height / 2
  const points: Array<[number, number]> = []
  if (kind === 'triangle') {
    points.push([0, -hh], [hw, hh], [-hw, hh])
  } else if (kind === 'diamond') {
    points.push([0, -hh], [hw, 0], [0, hh], [-hw, 0])
  } else if (kind === 'star') {
    const inner = Math.min(hw, hh) * Math.min(1, Math.max(0.05, Number(p.innerRadius ?? 0.45)))
    const outer = Math.min(hw, hh)
    for (let i = 0; i < 10; i++) {
      const radius = i % 2 === 0 ? outer : inner
      const angle = (i / 10) * Math.PI * 2 - Math.PI / 2
      points.push([Math.cos(angle) * radius, Math.sin(angle) * radius])
    }
  } else {
    const sides = Math.max(3, Math.round(Number(p.sides ?? 6)))
    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 2
      points.push([Math.cos(angle) * hw, Math.sin(angle) * hh])
    }
  }
  return {
    i: points.map(() => [0, 0]),
    o: points.map(() => [0, 0]),
    v: points,
    c: true,
  }
}

function gradientStopsFor(p: Record<string, any>, samples: number): GradientStop[] {
  const list = gradientStops({
    colorA: String(p.colorA ?? p.fill ?? '#b9ff66'),
    colorB: String(p.colorB ?? '#4bdac5'),
    gradient: p.stops && p.stops.length ? { stops: p.stops } : undefined,
  })
  if (samples <= 0) return list
  const count = Math.max(2, Math.min(32, Math.round(samples)))
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1)
    return { position, color: sampleColor(list, position), softness: 1 }
  })
}

function gradientFill(
  _node: GraphNode,
  width: number,
  height: number,
  p: Record<string, any>,
  builder: Builder,
): Json {
  const list = gradientStopsFor(p, builder.gradientSamples)
  const angle = (Number(p.gradientAngle ?? p.angle ?? 0) * Math.PI) / 180
  const radial = p.fill === 'radial'
  const start = radial ? [0, 0] : [-Math.cos(angle) * width / 2, -Math.sin(angle) * height / 2]
  const end = radial
    ? [Math.max(width, height) / 2, 0]
    : [Math.cos(angle) * width / 2, Math.sin(angle) * height / 2]
  const flat: number[] = []
  for (const stop of list) {
    const [r, g, b] = rgb(stop.color)
    flat.push(Math.max(0, Math.min(1, stop.position)), r, g, b)
  }
  return {
    ty: 'gf',
    nm: 'Gradient Fill',
    o: prop(100),
    r: 1,
    bm: 0,
    g: { p: list.length, k: { a: 0, k: flat } },
    s: prop(start),
    e: prop(end),
    t: radial ? 2 : 1,
  }
}

function fontFor(css: string, weight: string): { fName: string; fFamily: string; fStyle: string } {
  const first = String(css).split(',')[0].trim().replace(/^['"]|['"]$/g, '')
  const family =
    first === 'ui-sans-serif' || first === 'system-ui' || first === 'sans-serif'
      ? 'Arial'
      : first === 'serif'
        ? 'Georgia'
        : first === 'monospace'
          ? 'Courier New'
          : first || 'Arial'
  const numeric = Number(weight)
  const style = numeric >= 900 ? 'Black' : numeric >= 700 ? 'Bold' : numeric >= 600 ? 'Medium' : 'Regular'
  return { fName: family, fFamily: family, fStyle: style }
}

function textLayer(node: GraphNode, graph: Graph, builder: Builder): Json | null {
  const p = paramsFor(node)
  if (p.gradient) return null
  const layer = layerBase(node, graph, 5, builder)
  const size = Math.max(1, Number(p.size ?? 120) * Number(p.scale ?? 1))
  const font = fontFor(String(p.font ?? 'Arial'), String(p.weight ?? '700'))
  const fontKey = `${font.fName}|${font.fStyle}`
  if (!builder.fonts.has(fontKey)) {
    builder.fonts.set(fontKey, {
      fName: font.fName,
      fFamily: font.fFamily,
      fStyle: font.fStyle,
      ascent: 75,
    })
  }
  const justify = p.align === 'left' ? 0 : p.align === 'right' ? 1 : 2
  const width = graph.settings.width
  const height = graph.settings.height
  layer.t = {
    d: {
      k: [
        {
          s: {
            t: String(p.text ?? ''),
            f: font.fName,
            s: size,
            j: justify,
            tr: 0,
            lh: size * Number(p.lineHeight ?? 1.1),
            ls: 0,
            fc: rgb(String(p.color ?? '#ffffff')),
          },
          t: 0,
        },
      ],
    },
    p: {},
    m: { g: 1, a: { a: 0, k: [0, 0] } },
    a: [],
  }
  layer.ks = {
    o: animatedNumber(node, graph, 'opacity', Number(p.opacity ?? 1), (v) => v * 100),
    r: prop(0),
    p: animatedVector(
      node,
      graph,
      [
        { key: 'x', base: Number(p.x ?? 0.5), map: (v) => v * width },
        { key: 'y', base: Number(p.y ?? 0.5), map: (v) => v * height + size * 0.35 },
      ],
      [0],
    ),
    a: prop([0, 0, 0]),
    s: prop([100, 100, 100]),
  }
  return layer
}

function gradientSourceLayer(node: GraphNode, graph: Graph, builder: Builder): Json {
  const p = paramsFor(node)
  const width = graph.settings.width
  const height = graph.settings.height
  const layer = layerBase(node, graph, 4, builder)
  const items: Json[] = [
    { ty: 'rc', d: 1, s: prop([width, height]), p: prop([0, 0]), r: prop(0), nm: 'Background' },
  ]
  if (p.fill === 'solid') {
    items.push({ ty: 'fl', c: prop(rgba(String(p.colorA ?? '#b9ff66'))), o: prop(100), r: 1, bm: 0, nm: 'Fill' })
  } else {
    items.push(
      gradientFill(node, width, height, {
        fill: p.fill === 'radial' ? 'radial' : 'linear',
        colorA: p.colorA,
        colorB: p.colorB,
        stops: p.stops,
        angle: p.angle,
      }, builder),
    )
  }
  items.push({
    ty: 'tr', p: prop([0, 0]), a: prop([0, 0]), s: prop([100, 100]), r: prop(0),
    o: prop(100), sk: prop(0), sa: prop(0),
  })
  layer.shapes = [{ ty: 'gr', it: items, nm: node.title }]
  layer.ks = {
    o: prop(100),
    r: prop(0),
    p: prop([width / 2, height / 2, 0]),
    a: prop([0, 0, 0]),
    s: prop([100, 100, 100]),
  }
  return layer
}

function cloneLayerGroup(layers: Json[], builder: Builder): Json[] {
  const copies = layers.map((layer) => JSON.parse(JSON.stringify(layer)) as Json)
  const indexMap = new Map<number, number>()
  for (const layer of copies) {
    const previous = Number(layer.ind)
    layer.ind = builder.nextInd++
    indexMap.set(previous, layer.ind)
  }
  for (const layer of copies) {
    if (layer.parent) layer.parent = indexMap.get(Number(layer.parent)) ?? layer.parent
  }
  return copies
}

function sampledProperty(frames: number[], values: number[][]): Json {
  return {
    a: 1,
    k: frames.map((frame, index) => ({ t: frame, s: values[index] })),
  }
}

function motionFrames(frames: number, cycles: number): number[] {
  const total = Math.max(1, frames)
  const samples = Math.min(48, Math.max(2, Math.ceil(Math.max(1, cycles) * 8)))
  if (samples >= total) return Array.from({ length: total }, (_, index) => index)
  return Array.from({ length: samples }, (_, index) =>
    Math.round((index * (total - 1)) / (samples - 1)),
  )
}

function applyOpacitySamples(
  layers: Json[],
  frames: number[],
  values: number[],
  builder: Builder,
  node: GraphNode,
): void {
  let warned = false
  for (const layer of layers) {
    const opacity = layer.ks?.o
    if (!opacity) continue
    if (opacity.a === 1) {
      if (!warned) {
        builder.warnings.push(`${node.title}: fade på et lag med animert opacity er forenklet.`)
        warned = true
      }
      continue
    }
    const base = Number(opacity.k ?? 100) / 100
    opacity.a = 1
    opacity.k = frames.map((frame, index) => ({
      t: frame,
      s: [Math.max(0, Math.min(100, base * values[index] * 100))],
    }))
  }
}

function multiplyOpacity(layer: Json, factor: number): void {
  const o = layer.ks?.o
  if (!o || factor === 1) return
  if (o.a === 1) {
    o.k = o.k.map((key: Json) => ({ ...key, s: [Number(key.s?.[0] ?? 100) * factor] }))
  } else {
    o.k = Number(o.k ?? 100) * factor
  }
}

function stackSettings(node: GraphNode, edge: GraphEdge): { mode: string; opacity: number; visible: boolean } {
  const p = paramsFor(node)
  const own = (p.layers as Record<string, any> | undefined)?.[edge.id]
  return {
    mode: String(own?.mode ?? p.mode ?? 'normal'),
    opacity: Math.max(0, Math.min(1, Number(own?.opacity ?? p.opacity ?? 1))),
    visible: own?.visible !== false,
  }
}

function exportNode(
  id: string,
  graph: Graph,
  builder: Builder,
  seen: Set<string> = new Set(),
): Json[] {
  const node = graph.nodes.find((item) => item.id === id)
  if (!node) return []
  if (seen.has(id)) {
    builder.warnings.push(`${node.title}: syklus i grafen.`)
    return []
  }
  const nextSeen = new Set(seen).add(id)
  const incoming = (port?: string) =>
    graph.edges.filter(
      (edge) =>
        edge.target === id &&
        (edge.kind ?? 'value') === 'value' &&
        (port === undefined || edge.targetPort === port),
    )

  if (node.enabled === false) {
    const input = incoming()[0]
    return input ? exportNode(input.source, graph, builder, nextSeen) : []
  }

  switch (node.type) {
    case 'source.shape2D':
      return [shapeLayer(node, graph, builder)]
    case 'source.text2D': {
      const layer = textLayer(node, graph, builder)
      if (!layer) {
        builder.warnings.push(`${node.title}: gradienttekst kan ikke eksporteres til Lottie v1.`)
        return []
      }
      return [layer]
    }
    case 'source.gradient':
      return [gradientSourceLayer(node, graph, builder)]
    case 'modifier.scatter2D': {
      const input = incoming()[0]
      if (!input) return []
      const layers = exportNode(input.source, graph, builder, nextSeen)
      if (layers.length === 0) return []
      const params = paramsFor(node) as Scatter2DParams
      const count = scatter2DCount(params)
      const pivot = { x: graph.settings.width / 2, y: graph.settings.height / 2 }
      const motion = String(params.motion ?? 'none')
      const transformAnimated = (motion !== 'none' && motion !== 'fade') || Math.round(Number(params.spin ?? 0)) !== 0
      const frames = transformAnimated || motion === 'fade'
        ? motionFrames(graph.settings.frames, Number(params.motionCycles ?? 1))
        : []
      const output: Json[] = []

      if (!builder.warnings.some((warning) => warning.startsWith(`${node.title}:`))) {
        builder.warnings.push(
          `${node.title}: rotasjon og skala bruker lerretets midtpunkt i Lottie.`,
        )
      }

      for (let index = 0; index < count; index++) {
        const group = cloneLayerGroup(layers, builder)
        const wrapper = layerBase(node, graph, 3, builder)
        wrapper.nm = `${node.title} ${index + 1}`

        if (transformAnimated) {
          const instances = frames.map((frame) =>
            scatter2DInstance(params, index, count, frame / Math.max(1, graph.settings.frames)),
          )
          wrapper.ks = {
            o: prop(100),
            r: sampledProperty(frames, instances.map((item) => [item.rotation])),
            p: sampledProperty(
              frames,
              instances.map((item) => [pivot.x + item.x, pivot.y + item.y, 0]),
            ),
            a: prop([pivot.x, pivot.y, 0]),
            s: sampledProperty(
              frames,
              instances.map((item) => [item.scale * 100, item.scale * 100, 100]),
            ),
          }
        } else {
          const item = scatter2DInstance(params, index, count, 0)
          wrapper.ks = {
            o: prop(100),
            r: prop(item.rotation),
            p: prop([pivot.x + item.x, pivot.y + item.y, 0]),
            a: prop([pivot.x, pivot.y, 0]),
            s: prop([item.scale * 100, item.scale * 100, 100]),
          }
        }

        const roots = group.filter((layer) => !layer.parent)
        for (const layer of roots) layer.parent = wrapper.ind

        if (motion === 'fade') {
          const values = frames.map((frame) => {
            const item = scatter2DInstance(
              params,
              index,
              count,
              frame / Math.max(1, graph.settings.frames),
            )
            return item.opacity * Number(params.opacity ?? 1)
          })
          applyOpacitySamples(group, frames, values, builder, node)
        } else {
          const item = scatter2DInstance(params, index, count, 0)
          for (const layer of group) {
            multiplyOpacity(layer, item.opacity * Number(params.opacity ?? 1))
          }
        }

        output.push(...group, wrapper)
      }
      return output
    }
    case 'modifier.transform2D': {
      const input = incoming()[0]
      if (!input) return []
      const layers = exportNode(input.source, graph, builder, nextSeen)
      if (layers.length === 0) return []
      const p = paramsFor(node)
      const x = Number(p.x ?? 0)
      const y = Number(p.y ?? 0)
      const rotation = Number(p.rotation ?? 0)
      const scale = Number(p.scale ?? 1)
      const opacity = Number(p.opacity ?? 1)
      if (x === 0 && y === 0 && rotation === 0 && scale === 1 && opacity === 1) return layers
      const parent = layerBase(node, graph, 3, builder)
      parent.nm = `${node.title} (transform)`
      parent.ks = {
        o: prop(100),
        r: animatedNumber(node, graph, 'rotation', rotation),
        p: animatedVector(node, graph, [
          { key: 'x', base: graph.settings.width / 2 + x, map: (v) => v },
          { key: 'y', base: graph.settings.height / 2 + y, map: (v) => v },
        ], [0]),
        a: prop([graph.settings.width / 2, graph.settings.height / 2, 0]),
        s: animatedVector(
          node,
          graph,
          [{ key: 'scale', base: scale, map: (v) => v * 100 }],
          [100],
        ),
      }
      for (const layer of layers) {
        layer.parent = parent.ind
        multiplyOpacity(layer, opacity)
      }
      return [...layers, parent]
    }
    case 'composite.stack': {
      const groups: Json[][] = []
      for (const edge of incoming('in')) {
        const settings = stackSettings(node, edge)
        if (!settings.visible || settings.opacity <= 0) continue
        const child = exportNode(edge.source, graph, builder, nextSeen)
        for (const layer of child) {
          layer.bm = BLEND[settings.mode] ?? 0
          multiplyOpacity(layer, settings.opacity)
        }
        groups.push(child)
      }
      if (paramsFor(node).reverse) groups.reverse()
      return groups.flat()
    }
    case 'composite.blend': {
      const baseEdge = incoming('base')[0]
      const topEdge = incoming('top')[0]
      const base = baseEdge ? exportNode(baseEdge.source, graph, builder, nextSeen) : []
      const top = topEdge ? exportNode(topEdge.source, graph, builder, nextSeen) : []
      if ((baseEdge && base.length === 0) || (topEdge && top.length === 0)) {
        builder.warnings.push(`${node.title}: en av inngangene kan ikke eksporteres, så blandingen hoppes over.`)
        return []
      }
      if (top.length > 0) {
        const p = paramsFor(node)
        for (const layer of top) {
          layer.bm = BLEND[String(p.mode ?? 'normal')] ?? 0
          multiplyOpacity(layer, Number(p.opacity ?? 1))
        }
      }
      return [...base, ...top]
    }
    case 'output.viewport':
    case 'output.export': {
      const input = incoming('frame')[0] ?? incoming()[0]
      return input ? exportNode(input.source, graph, builder, nextSeen) : []
    }
    default:
      builder.warnings.push(`${node.title}: ${registry.get(node.type)?.label ?? node.type} støttes ikke i Lottie v1.`)
      return []
  }
}

function targetNode(graph: Graph, requested?: string | null): GraphNode | undefined {
  if (requested) {
    const match = graph.nodes.find((node) => node.id === requested)
    if (match) return match
  }
  return (
    graph.nodes.find((node) => node.type === 'output.export') ??
    graph.nodes.find((node) => node.type === 'output.viewport')
  )
}

/**
 * Eksporterer en Lottie-animasjon for den delen av grafen som kan uttrykkes
 * som ekte vektorer. Noder uten Lottie-ekvivalent hoppes over med advarsel.
 */
export function exportLottie(graph: Graph, options: LottieExportOptions = {}): LottieExportResult {
  const analysis = analyzeLottie(graph, options.targetId)
  const target = targetNode(graph, options.targetId)
  if (!target) throw new Error('Fant ingen output-node for Lottie-eksport.')

  const builder: Builder = {
    nextInd: 1,
    fonts: new Map(),
    warnings: [],
    gradientSamples: Math.max(0, Math.min(32, options.gradientSamples ?? 16)),
  }
  const layers = exportNode(target.id, graph, builder)
  if (layers.length === 0) {
    throw new Error('Fant ingen Lottie-kompatible lag. Bruk former, tekst uten gradient eller en gradientkilde.')
  }

  for (const [id, nodeInfo] of Object.entries(analysis.nodes)) {
    if (nodeInfo.status === 'native') continue
    const node = graph.nodes.find((item) => item.id === id)
    if (node?.type === 'output.viewport' || node?.type === 'output.export') continue
    const prefix = `${node?.title ?? id}:`
    if (builder.warnings.some((warning) => warning.startsWith(prefix))) continue
    builder.warnings.push(`${prefix} ${nodeInfo.reason}`)
  }

  const eased = graph.nodes.some((node) =>
    Object.values(node.tracks ?? {}).some((track) =>
      track.some((key) => key.interpolation && key.interpolation !== 'linear' && key.interpolation !== 'hold'),
    ),
  )
  if (eased) {
    builder.warnings.push('Keyframe-easing med myk start/slutt, sprett eller elastisk eksporteres som lineær i Lottie v1.')
  }

  const document: Json = {
    v: '5.12.2',
    fr: graph.settings.fps,
    ip: 0,
    op: Math.max(1, graph.settings.frames),
    w: graph.settings.width,
    h: graph.settings.height,
    nm: 'Smudge Flow',
    ddd: 0,
    assets: [],
    layers: [...layers].reverse(),
    meta: { g: 'Smudge Flow · Lottie v1' },
  }
  if (builder.fonts.size > 0) document.fonts = { list: [...builder.fonts.values()] }

  return {
    json: JSON.stringify(document, null, 2),
    document,
    analysis,
    warnings: builder.warnings,
    layers: layers.filter((layer) => layer.ty !== 3).length,
  }
}
