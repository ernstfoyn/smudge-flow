import * as THREE from 'three'

// ---------------------------------------------------------------------------
// TRAIL PAINT LAYER  (images AND videos)
//
// Two hidden 2D canvases:
//   * paint  — only the stamps you make by dragging (transparent background)
//   * out    — what the 3D shader actually uses: the base media + the paint
//
// The base media can be a still image OR a playing video. For a video we
// re-composite every frame, so the surface texture is a live, moving video
// with your repeated trail stamped on top.
// ---------------------------------------------------------------------------

const SIZE = 1024
const BG = '#05050a'

export const trailState = {
  paint: null,
  pctx: null,
  out: null,
  octx: null,
  texture: null,
  image: null,
  hasImage: false,
  video: null,
  hasVideo: false,
  strokeIndex: 0,
}

function ensure() {
  if (trailState.out) return trailState

  const paint = document.createElement('canvas')
  paint.width = SIZE
  paint.height = SIZE
  const pctx = paint.getContext('2d')
  pctx.imageSmoothingEnabled = true
  pctx.imageSmoothingQuality = 'high'

  const out = document.createElement('canvas')
  out.width = SIZE
  out.height = SIZE
  const octx = out.getContext('2d')
  octx.fillStyle = BG
  octx.fillRect(0, 0, SIZE, SIZE)
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'

  const texture = new THREE.CanvasTexture(out)
  texture.colorSpace = THREE.NoColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 8
  texture.needsUpdate = true

  trailState.paint = paint
  trailState.pctx = pctx
  trailState.out = out
  trailState.octx = octx
  trailState.texture = texture
  return trailState
}

export function getTrailTexture() {
  return ensure().texture
}

// The current base media element (video takes priority), plus its size.
function currentSource() {
  const s = trailState
  const src = s.hasVideo ? s.video : s.hasImage ? s.image : null
  if (!src) return null
  const w = src.videoWidth || src.naturalWidth || src.width || 0
  const h = src.videoHeight || src.naturalHeight || src.height || 0
  if (!w || !h) return null
  return { src, w, h }
}

function coverRect(w, h) {
  const scale = Math.max(SIZE / w, SIZE / h)
  const cw = w * scale
  const ch = h * scale
  return { x: (SIZE - cw) / 2, y: (SIZE - ch) / 2, w: cw, h: ch }
}

// Base media + stamps -> the output canvas that the shader reads.
function composite() {
  const s = ensure()
  const ctx = s.octx

  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SIZE, SIZE)

  const found = currentSource()
  if (found) {
    const r = coverRect(found.w, found.h)
    const ready = s.hasVideo ? s.video.readyState >= 2 : true
    if (ready) ctx.drawImage(found.src, r.x, r.y, r.w, r.h)
  }

  ctx.drawImage(s.paint, 0, 0)
  s.texture.needsUpdate = true
}

function clearPaint() {
  const s = ensure()
  s.pctx.clearRect(0, 0, SIZE, SIZE)
}

// Wipe the trail back to just the base media.
export function clearTrail() {
  ensure()
  clearPaint()
  composite()
}

// --- Media loading ----------------------------------------------------------

function teardownVideo() {
  const s = trailState
  if (s.video) {
    try {
      s.video.pause()
    } catch (e) {
      /* ignore */
    }
    if (s.video.parentNode) s.video.parentNode.removeChild(s.video)
    s.video.src = ''
    s.video = null
  }
  s.hasVideo = false
}

// Load a still image.
export function setTrailImage(url) {
  const s = ensure()
  teardownVideo()
  s.image = null
  s.hasImage = false
  clearPaint()

  if (!url) {
    composite()
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    s.image = img
    s.hasImage = true
    composite()
  }
  img.src = url
}

// Load a video (muted + looping so it can play by itself).
export function setTrailVideo(url) {
  const s = ensure()
  teardownVideo()
  s.image = null
  s.hasImage = false
  clearPaint()

  if (!url) {
    composite()
    return
  }

  const v = document.createElement('video')
  v.src = url
  v.muted = true
  v.loop = true
  v.playsInline = true
  v.autoplay = true
  v.preload = 'auto'
  v.crossOrigin = 'anonymous'
  // Some browsers need the element in the DOM to decode; keep it off-screen.
  v.style.cssText =
    'position:fixed;left:-10000px;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none'
  document.body.appendChild(v)

  s.video = v
  s.hasVideo = true

  const ready = () => {
    composite()
    v.play().catch(() => {})
  }
  v.addEventListener('loadeddata', ready)
  v.addEventListener('playing', composite)
  v.load()
  composite()
}

// Called every frame from the 3D scene: keeps a video playing / paused and
// re-composites so the texture shows the current video frame.
export function updateTrail(isPlaying = true) {
  const s = trailState
  if (!s.video) return

  if (isPlaying) {
    if (s.video.paused) s.video.play().catch(() => {})
  } else if (!s.video.paused) {
    s.video.pause()
  }

  if (s.video.readyState >= 2) composite()
}

// Restart a video from the beginning (used by the Reset button).
export function rewindVideo() {
  const s = trailState
  if (s.video) {
    try {
      s.video.currentTime = 0
    } catch (e) {
      /* ignore */
    }
  }
}

// --- Painting ---------------------------------------------------------------

function uvToPx(ux, uy) {
  return { x: ux * SIZE, y: (1 - uy) * SIZE }
}

function stampPx(x, y, cfg, rotation) {
  const s = ensure()
  const found = currentSource()
  if (!found) return
  if (s.hasVideo && s.video.readyState < 2) return

  const box = SIZE * cfg.brush
  const scale = Math.max(box / found.w, box / found.h)
  const w = found.w * scale
  const h = found.h * scale

  const ctx = s.pctx
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, cfg.opacity))
  ctx.translate(x, y)
  if (rotation) ctx.rotate(rotation)
  ctx.drawImage(found.src, -w / 2, -h / 2, w, h)
  ctx.restore()

  // For a still image we can composite right away; a video composites itself
  // every frame.
  if (!s.hasVideo) composite()
}

export function stampUv(ux, uy, cfg, rotation = 0) {
  ensure()
  if (!currentSource()) return
  const p = uvToPx(ux, uy)
  stampPx(p.x, p.y, cfg, rotation)
}

export function paintLineUv(ux0, uy0, ux1, uy1, cfg, rotation = 0) {
  ensure()
  if (!currentSource()) return

  const a = uvToPx(ux0, uy0)
  const b = uvToPx(ux1, uy1)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)

  const spacingPx = Math.max(1, SIZE * cfg.brush * cfg.spacing)
  const steps = Math.max(1, Math.round(dist / spacingPx))

  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    stampPx(a.x + dx * t, a.y + dy * t, cfg, rotation)
  }
}

export function nextStrokeRotation(cfg) {
  const s = ensure()
  if (!cfg.rotateStrokes) return 0
  const rotation = (s.strokeIndex % 4) * (Math.PI / 2)
  s.strokeIndex += 1
  return rotation
}
