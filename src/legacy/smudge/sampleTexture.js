// Generate a colourful "fluid art" texture in the browser, so people can try
// the app immediately without uploading anything.

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function makeSampleTexture(size = 1024) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  // Dark base so the glows pop.
  ctx.fillStyle = '#07030f'
  ctx.fillRect(0, 0, size, size)

  const palette = [
    '#ff006e', '#8338ec', '#3a86ff', '#06d6a0',
    '#ffbe0b', '#fb5607', '#00f5d4', '#f72585',
  ]

  // Soft blurred blobs.
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = size * (0.08 + Math.random() * 0.3)
    const color = palette[Math.floor(Math.random() * palette.length)]
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, hexToRgba(color, 0.85))
    gradient.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Curved marbling strokes.
  ctx.lineCap = 'round'
  for (let i = 0; i < 24; i++) {
    const color = palette[Math.floor(Math.random() * palette.length)]
    ctx.strokeStyle = hexToRgba(color, 0.35)
    ctx.lineWidth = size * (0.005 + Math.random() * 0.02)
    ctx.beginPath()
    let x = Math.random() * size
    let y = Math.random() * size
    ctx.moveTo(x, y)
    for (let s = 0; s < 6; s++) {
      x += (Math.random() - 0.5) * size * 0.5
      y += (Math.random() - 0.5) * size * 0.5
      ctx.quadraticCurveTo(
        Math.random() * size,
        Math.random() * size,
        x,
        y,
      )
    }
    ctx.stroke()
  }

  return canvas.toDataURL('image/png')
}
