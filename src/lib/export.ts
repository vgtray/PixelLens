// PixelLens — Export Utilities

import type { ColorToken } from '@/types/design-system'

export async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function generatePalettePNG(colors: ColorToken[]): Blob {
  const swatchSize = 80
  const cols = Math.min(colors.length, 8)
  const rows = Math.ceil(colors.length / cols)
  const padding = 16
  const labelHeight = 24

  const width = cols * swatchSize + (cols + 1) * padding
  const height = rows * (swatchSize + labelHeight) + (rows + 1) * padding

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#0C0C0E'
  ctx.fillRect(0, 0, width, height)

  // Swatches
  colors.forEach((color, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = padding + col * (swatchSize + padding)
    const y = padding + row * (swatchSize + labelHeight + padding)

    // Rounded swatch
    ctx.fillStyle = color.hex
    ctx.beginPath()
    ctx.roundRect(x, y, swatchSize, swatchSize, 8)
    ctx.fill()

    // Label
    ctx.fillStyle = '#EDEDEF'
    ctx.font = '11px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(color.hex.toUpperCase(), x + swatchSize / 2, y + swatchSize + 16)
  })

  // Convert canvas to blob synchronously via toBlob workaround
  const dataUrl = canvas.toDataURL('image/png')
  const binary = atob(dataUrl.split(',')[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}
