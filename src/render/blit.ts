import type { CanvasTarget } from '../engine/types'

/**
 * Kopierer et resultat inn i nodens eget lerret.
 *
 * Lerretet er delt mellom frames (se RenderServices), så vi nullstiller
 * transform, alpha og komposisjonsmodus før vi tegner. Uten dette ville
 * en tidligere effekt kunne «blø» inn i neste frame.
 */
export function blit(target: CanvasTarget, source: CanvasImageSource): void {
  const c = target.ctx
  c.save()
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
  c.clearRect(0, 0, target.width, target.height)
  c.drawImage(source, 0, 0, target.width, target.height)
  c.restore()
}
