import type { NodeDefinition } from '../../engine/types'

/**
 * Én stempel i trail-laget.
 *
 * Stemplene er DATA, ikke tilstand. Det er hele poenget: i den gamle appen
 * var malingslaget et lerret som ble endret mens du malte, og en eksport
 * ville derfor gitt ulikt resultat for hver kjøring. Her lagres stemplene
 * som koordinater, og laget rendres på nytt hver frame.
 */
export interface TrailStamp {
  /** 0..1, fra venstre. */
  u: number
  /** 0..1, fra bunnen (UV-konvensjon). */
  v: number
  /** Rotorad i radianer. */
  rotation: number
}

export interface TrailParams {
  /** Størrelse på stemplene, som andel av lerretet. */
  brush: number
  /** Avstand mellom stempler i et dra, som andel av stempelstørrelsen. */
  spacing: number
  /** Dekkevne per stempel. */
  opacity: number
  /** Roterer hvert nye dra med 90°. */
  rotateStrokes: boolean
  /** Antall dra som er startet — bestemmer rotasjonen. */
  strokeCount: number
  /** Selve stemplene. */
  stamps: TrailStamp[]
  /** Bakgrunnsfarge under bildet. */
  background: string
}

/** Naturlig størrelse på en medie. */
function mediaSize(media: CanvasImageSource): { w: number; h: number } {
  const any = media as any
  const w = any.naturalWidth || any.videoWidth || any.width || 0
  const h = any.naturalHeight || any.videoHeight || any.height || 0
  return { w, h }
}

/** Tegner mediet «cover» inn i en boks, sentrert. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  media: CanvasImageSource,
  boxW: number,
  boxH: number,
  offsetX = 0,
  offsetY = 0,
): void {
  const { w, h } = mediaSize(media)
  if (!w || !h) return
  const scale = Math.max(boxW / w, boxH / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(media, offsetX + (boxW - dw) / 2, offsetY + (boxH - dh) / 2, dw, dh)
}

/**
 * Trail-laget: bildet ditt, pluss stemplene du har malt.
 *
 * Stemplene er små kopier av bildet, plassert på bestemte steder. Laget
 * mates videre til Smudge-materialet, som lager ekko-kopier av det.
 *
 * Maler du i inspectorens malepute, og stemplene lagres i noden — slik at
 * de er animerbare, kan kopieres, og gir samme resultat ved hver eksport.
 */
export const trail: NodeDefinition<TrailParams> = {
  type: 'modifier.trail',
  label: 'Trail-lag',
  category: 'modifier',
  description:
    'Bildet ditt med malte stempler. Stemplene lagres som data, så laget er eksporterbart og kan animeres.',
  inputs: [{ id: 'in', label: 'Bilde', type: 'drawable' }],
  outputs: [{ id: 'out', label: 'Lag', type: 'canvas' }],
  params: [
    { key: 'brush', label: 'Pensel', type: 'number', default: 0.28, min: 0.05, max: 1, step: 0.01 },
    { key: 'spacing', label: 'Avstand', type: 'number', default: 0.2, min: 0.05, max: 1, step: 0.01 },
    { key: 'opacity', label: 'Dekkevne', type: 'number', default: 1, min: 0, max: 1, step: 0.01 },
    { key: 'rotateStrokes', label: 'Roter dra', type: 'boolean', default: false },
    { key: 'background', label: 'Bakgrunn', type: 'color', default: '#05050a' },
  ],
  evaluate(ctx, { in: input }, p) {
    const target = ctx.render.canvas(ctx.scopeKey)
    const c = target.ctx
    const { width: w, height: h } = target
    const media = input as CanvasImageSource | undefined

    c.save()
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'
    c.fillStyle = String(p.background ?? '#05050a')
    c.fillRect(0, 0, w, h)

    if (media) {
      // Basismediet, fylt til kanten.
      drawCover(c, media, w, h)

      // Stemplene, i den rekkefølgen de ble malt.
      const stamps = Array.isArray(p.stamps) ? (p.stamps as TrailStamp[]) : []
      const brush = Math.max(w, h) * Number(p.brush)
      const opacity = Math.max(0, Math.min(1, Number(p.opacity)))

      for (const stamp of stamps) {
        c.save()
        c.globalAlpha = opacity
        c.translate(stamp.u * w, (1 - stamp.v) * h)
        if (stamp.rotation) c.rotate(stamp.rotation)
        drawCover(c, media, brush, brush, -brush / 2, -brush / 2)
        c.restore()
      }
    }

    c.restore()
    return { out: target.canvas }
  },
}
