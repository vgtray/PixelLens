// PixelLens — Color Utilities (Chroma.js wrappers)

import chroma from 'chroma-js'
import type { ColorToken } from '@/types/design-system'

type Rgba = { r: number; g: number; b: number; a: number }

const FALLBACK_HEX = '#000000'

// sRGB transfer functions (CSS Color 4 / IEC 61966-2-1).
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)
const to255 = (n: number): number => Math.round(clamp01(n) * 255)

// Parse a component that may be a <number>, a <percentage> or the `none` keyword.
// For color() channels a bare number is already in 0..1 and `100%` maps to 1.
function parseComponent(token: string): number {
  const t = token.trim()
  if (t === 'none' || t === '') return 0
  if (t.endsWith('%')) return parseFloat(t) / 100
  return parseFloat(t)
}

function parseAlpha(token: string | undefined): number {
  if (token === undefined) return 1
  const t = token.trim()
  if (t === 'none' || t === '') return 1
  const a = t.endsWith('%') ? parseFloat(t) / 100 : parseFloat(t)
  return Number.isFinite(a) ? clamp01(a) : 1
}

// Split "1 0 0 / 0.5" into coordinate tokens and the alpha token.
function splitCoords(body: string): { coords: string[]; alpha: string | undefined } {
  const [main, alpha] = body.split('/')
  const coords = main.trim().split(/[\s,]+/).filter(Boolean)
  return { coords, alpha }
}

// Split a top-level list on `sep` while respecting nested parentheses
// (so `rgb(1, 2, 3)` inside `color-mix(...)` stays intact).
function splitTopLevel(str: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === sep && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

function normalizeHue(token: string): number {
  const t = token.trim()
  if (t.endsWith('turn')) return parseFloat(t) * 360
  if (t.endsWith('grad')) return parseFloat(t) * 0.9
  if (t.endsWith('rad')) return (parseFloat(t) * 180) / Math.PI
  return parseFloat(t) // deg or unitless
}

// color(<space> c1 c2 c3 [/ a]) — handles the sRGB-family and Display-P3 spaces.
function parseColorFunction(input: string): Rgba | null {
  const m = /^color\(\s*([\w-]+)\s+([^)]+)\)$/i.exec(input)
  if (!m) return null
  const space = m[1].toLowerCase()
  const { coords, alpha } = splitCoords(m[2])
  if (coords.length < 3) return null
  const a = parseAlpha(alpha)
  const c = coords.slice(0, 3).map(parseComponent)

  switch (space) {
    case 'srgb':
      return { r: to255(c[0]), g: to255(c[1]), b: to255(c[2]), a }
    case 'srgb-linear':
      return {
        r: to255(linearToSrgb(c[0])),
        g: to255(linearToSrgb(c[1])),
        b: to255(linearToSrgb(c[2])),
        a,
      }
    case 'display-p3':
    case 'p3': {
      // P3 gamma -> P3 linear -> sRGB linear (matrix) -> sRGB gamma.
      const lr = srgbToLinear(c[0])
      const lg = srgbToLinear(c[1])
      const lb = srgbToLinear(c[2])
      const sr = 1.2249401762 * lr - 0.2249401762 * lg
      const sg = -0.0420569547 * lr + 1.0420569547 * lg
      const sb = -0.0196375546 * lr - 0.0786360454 * lg + 1.0982736 * lb
      return {
        r: to255(linearToSrgb(clamp01(sr))),
        g: to255(linearToSrgb(clamp01(sg))),
        b: to255(linearToSrgb(clamp01(sb))),
        a,
      }
    }
    default:
      // rec2020 / a98-rgb / prophoto-rgb / xyz… -> leave to the browser (canvas).
      return null
  }
}

// hwb(H W% B% [/ a]) — chroma 3.2.0 does not parse this notation.
function parseHwb(input: string): Rgba | null {
  const m = /^hwb\(\s*([^)]+)\)$/i.exec(input)
  if (!m) return null
  const { coords, alpha } = splitCoords(m[1])
  if (coords.length < 3) return null
  const h = normalizeHue(coords[0])
  let w = parseComponent(coords[1])
  let bl = parseComponent(coords[2])
  if (!Number.isFinite(h) || !Number.isFinite(w) || !Number.isFinite(bl)) return null
  if (w + bl > 1) {
    const sum = w + bl
    w /= sum
    bl /= sum
  }
  const [hr, hg, hb] = chroma.hsl(h, 1, 0.5).rgb()
  const apply = (v: number): number => Math.round((v / 255) * (1 - w - bl) * 255 + w * 255)
  return { r: apply(hr), g: apply(hg), b: apply(hb), a: parseAlpha(alpha) }
}

// color-mix(in <space>, C1 [p1%], C2 [p2%]) — mixed in sRGB (adequate for token
// extraction; exact non-sRGB interpolation is left to the browser via canvas).
function parseColorMix(input: string): Rgba | null {
  const m = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(.+)\)$/i.exec(input)
  if (!m) return null
  const parts = splitTopLevel(m[1], ',')
  if (parts.length !== 2) return null

  const parseArg = (s: string): { color: string; pct: number | null } => {
    let str = s.trim()
    let pct: number | null = null
    let pm = /^([\d.]+)%\s+(.+)$/.exec(str)
    if (pm) {
      pct = parseFloat(pm[1])
      str = pm[2]
    } else {
      pm = /^(.+?)\s+([\d.]+)%$/.exec(str)
      if (pm) {
        str = pm[1]
        pct = parseFloat(pm[2])
      }
    }
    return { color: str.trim(), pct }
  }

  const a = parseArg(parts[0])
  const b = parseArg(parts[1])
  const ca = normalizeToRgba(a.color)
  const cb = normalizeToRgba(b.color)
  if (!ca || !cb) return null

  let pa = a.pct
  let pb = b.pct
  if (pa == null && pb == null) {
    pa = 50
    pb = 50
  } else if (pa == null) {
    pa = 100 - (pb as number)
  } else if (pb == null) {
    pb = 100 - pa
  }
  const sum = (pa as number) + (pb as number)
  if (sum <= 0) return null
  const wa = (pa as number) / sum
  const wb = (pb as number) / sum

  return {
    r: Math.round(ca.r * wa + cb.r * wb),
    g: Math.round(ca.g * wa + cb.g * wb),
    b: Math.round(ca.b * wa + cb.b * wb),
    a: ca.a * wa + cb.a * wb,
  }
}

// Browser fallback: rasterise the color on a 1x1 canvas and read the sRGB bytes.
// In a real browser this resolves *any* CSS color (system colors, wide-gamut,
// unresolved color-mix…). Returns null when no 2D canvas is available (jsdom).
let cachedCtx: CanvasRenderingContext2D | null | undefined
function getCanvasCtx(): CanvasRenderingContext2D | null {
  if (cachedCtx !== undefined) return cachedCtx
  try {
    if (typeof document === 'undefined') {
      cachedCtx = null
    } else {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      cachedCtx = canvas.getContext('2d', { willReadFrequently: true }) ?? null
    }
  } catch {
    cachedCtx = null
  }
  return cachedCtx
}

function rgbaFromCanvas(color: string): Rgba | null {
  const ctx = getCanvasCtx()
  if (!ctx) return null
  // Validity probe: an invalid value leaves fillStyle untouched, so two distinct
  // sentinels stay distinct; a valid value overwrites both to the same string.
  ctx.fillStyle = '#000000'
  ctx.fillStyle = color
  const s1 = ctx.fillStyle
  ctx.fillStyle = '#ffffff'
  ctx.fillStyle = color
  const s2 = ctx.fillStyle
  if (s1 !== s2) return null

  try {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
  } catch {
    return null
  }
}

function rgbaFromChroma(color: string): Rgba | null {
  try {
    const c = chroma(color)
    const [r, g, b] = c.rgb()
    return { r, g, b, a: c.alpha() }
  } catch {
    return null
  }
}

// Resolve any CSS color to sRGB, or null if it is genuinely unparseable.
// Order: chroma (hex/rgb/hsl/named/oklch/oklab/lab/lch) -> pure CSS Color 4
// parsers (color()/hwb()/color-mix, deterministic & test-friendly) -> browser
// canvas fallback (authoritative in Chrome for everything else).
function normalizeToRgba(color: string): Rgba | null {
  const input = color.trim()
  if (!input) return null

  return (
    rgbaFromChroma(input) ??
    parseColorFunction(input) ??
    parseHwb(input) ??
    parseColorMix(input) ??
    rgbaFromCanvas(input)
  )
}

function rgbaToHex({ r, g, b, a }: Rgba): string {
  return chroma(Math.round(r), Math.round(g), Math.round(b)).alpha(a).hex()
}

// Honest hex conversion: a valid hex string or null when the color cannot be
// parsed. Use this on the extraction/export path so unparseable values are
// dropped instead of being smuggled through as fake tokens.
export function tryToHex(color: string): string | null {
  const rgba = normalizeToRgba(color)
  return rgba ? rgbaToHex(rgba) : null
}

// Always returns a valid hex string (never the raw input). Unparseable colors
// fall back to FALLBACK_HEX; callers that must distinguish invalid colors
// should use tryToHex().
export function toHex(color: string): string {
  return tryToHex(color) ?? FALLBACK_HEX
}

export function toRgb(color: string): { r: number; g: number; b: number } {
  const rgba = normalizeToRgba(color)
  if (!rgba) return { r: 0, g: 0, b: 0 }
  return { r: Math.round(rgba.r), g: Math.round(rgba.g), b: Math.round(rgba.b) }
}

export function toHsl(color: string): { h: number; s: number; l: number } {
  const rgba = normalizeToRgba(color)
  if (!rgba) return { h: 0, s: 0, l: 0 }
  const [h, s, l] = chroma(Math.round(rgba.r), Math.round(rgba.g), Math.round(rgba.b)).hsl()
  return {
    h: Math.round(isNaN(h) ? 0 : h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

export function deltaE(c1: string, c2: string): number {
  try {
    return chroma.deltaE(c1, c2)
  } catch {
    return Infinity
  }
}

export function getContrastRatio(fg: string, bg: string): number {
  try {
    return chroma.contrast(fg, bg)
  } catch {
    return 0
  }
}

export function isNeutral(color: string): boolean {
  const rgba = normalizeToRgba(color)
  if (!rgba) return false
  const [, s] = chroma(Math.round(rgba.r), Math.round(rgba.g), Math.round(rgba.b)).hsl()
  return s < 0.1
}

export function isTransparent(color: string): boolean {
  const rgba = normalizeToRgba(color)
  if (rgba) return rgba.a === 0
  return color === 'transparent' || color === 'rgba(0, 0, 0, 0)'
}

export function clusterColors(
  colors: { hex: string; frequency: number }[],
  threshold = 5,
): { hex: string; frequency: number }[] {
  if (colors.length === 0) return []

  const sorted = [...colors].sort((a, b) => b.frequency - a.frequency)
  const clusters: { hex: string; frequency: number }[] = []

  for (const color of sorted) {
    const existing = clusters.find((c) => deltaE(c.hex, color.hex) < threshold)
    if (existing) {
      existing.frequency += color.frequency
    } else {
      clusters.push({ ...color })
    }
  }

  return clusters.sort((a, b) => b.frequency - a.frequency)
}

export function classifyColors(colors: ColorToken[]): ColorToken[] {
  const sorted = [...colors].sort((a, b) => b.frequency - a.frequency)

  const neutrals: ColorToken[] = []
  const chromatic: ColorToken[] = []

  for (const color of sorted) {
    if (isNeutral(color.hex)) {
      neutrals.push(color)
    } else {
      chromatic.push(color)
    }
  }

  // Classify neutrals
  for (const color of neutrals) {
    const lightness = chroma(color.hex).luminance()
    if (lightness > 0.85) {
      color.category = 'background'
    } else if (lightness < 0.15) {
      color.category = 'text'
    } else {
      color.category = 'neutral'
    }
  }

  // Classify chromatic colors
  chromatic.forEach((color, i) => {
    if (i === 0) {
      color.category = 'primary'
    } else if (i === 1) {
      color.category = 'secondary'
    } else {
      color.category = 'accent'
    }
  })

  return [...chromatic, ...neutrals]
}
