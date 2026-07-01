// PixelLens — WCAG Contrast Evaluation
//
// Pure, browser-free layer on top of the chroma-js wrappers in `colors.ts`.
// Turns the extracted color tokens of the latest scan into a set of relevant
// text/background pairings, each scored against the WCAG 2.x contrast ratio
// thresholds. Kept free of the DOM so it is fully testable.

import chroma from 'chroma-js'
import { getContrastRatio } from './colors'
import type { ColorToken, ColorCategory } from '@/types/design-system'

// WCAG 2.x minimum contrast ratios.
//   AA  normal text  >= 4.5   ·  AA  large text (>=18.66px bold / >=24px) >= 3
//   AAA normal text  >= 7     ·  AAA large text                          >= 4.5
export const WCAG_THRESHOLDS = {
  aaNormal: 4.5,
  aaLarge: 3,
  aaaNormal: 7,
  aaaLarge: 4.5,
} as const

/** Best passing level for a given text size, or `'fail'` when nothing passes. */
export type ContrastLevel = 'AAA' | 'AA' | 'fail'

export interface ContrastVerdict {
  /** Raw WCAG contrast ratio (1 -> 21). Not rounded — round at the display edge. */
  ratio: number
  aaNormal: boolean
  aaLarge: boolean
  aaaNormal: boolean
  aaaLarge: boolean
  /** Best passing level for normal-size text. */
  normalLevel: ContrastLevel
  /** Best passing level for large text. */
  largeLevel: ContrastLevel
}

/** Score a foreground color against a background color per WCAG 2.x. */
export function evaluateContrast(foreground: string, background: string): ContrastVerdict {
  const ratio = getContrastRatio(foreground, background)
  const aaNormal = ratio >= WCAG_THRESHOLDS.aaNormal
  const aaLarge = ratio >= WCAG_THRESHOLDS.aaLarge
  const aaaNormal = ratio >= WCAG_THRESHOLDS.aaaNormal
  const aaaLarge = ratio >= WCAG_THRESHOLDS.aaaLarge
  return {
    ratio,
    aaNormal,
    aaLarge,
    aaaNormal,
    aaaLarge,
    normalLevel: aaaNormal ? 'AAA' : aaNormal ? 'AA' : 'fail',
    largeLevel: aaaLarge ? 'AAA' : aaLarge ? 'AA' : 'fail',
  }
}

/** WCAG contrast ratio formatted for display, e.g. `5.23`. */
export function formatRatio(ratio: number): string {
  return ratio.toFixed(2)
}

/** WCAG relative luminance (0 -> 1); returns 0 for an unparseable color. */
function luminance(hex: string): number {
  try {
    return chroma(hex).luminance()
  } catch {
    return 0
  }
}

/** One background surface and every foreground token evaluated on it. */
export interface ContrastPairing {
  background: ColorToken
  foregrounds: { token: ColorToken; verdict: ContrastVerdict }[]
}

// Tokens that can plausibly carry text / icons and are worth checking as a
// foreground on a surface.
const FOREGROUND_CATEGORIES: ColorCategory[] = ['text', 'primary', 'secondary', 'accent', 'neutral']

/**
 * Choose the surfaces to evaluate foregrounds against. Prefers tokens the
 * scanner classified as `background`; when a scan yields none, falls back to the
 * luminance extremes (the lightest — and, if distinct, the darkest — token) so
 * the report still covers the likely page surfaces instead of coming up empty.
 */
function pickBackgrounds(colors: ColorToken[]): ColorToken[] {
  const explicit = colors.filter((c) => c.category === 'background')
  if (explicit.length > 0) return explicit
  if (colors.length === 0) return []

  const byLuminance = [...colors].sort((a, b) => luminance(b.hex) - luminance(a.hex))
  const picks: ColorToken[] = [byLuminance[0]]
  const darkest = byLuminance[byLuminance.length - 1]
  if (darkest.hex.toLowerCase() !== picks[0].hex.toLowerCase()) picks.push(darkest)
  return picks
}

/**
 * Build the contrast report for the extracted color tokens: for each background
 * surface, every relevant foreground token scored against it, best contrast
 * first. A foreground identical to its background is skipped, and backgrounds
 * that end up with no foreground are dropped.
 */
export function buildContrastReport(colors: ColorToken[]): ContrastPairing[] {
  const backgrounds = pickBackgrounds(colors)

  return backgrounds
    .map((background) => {
      const candidates = colors.filter((c) => FOREGROUND_CATEGORIES.includes(c.category))
      // If categorisation left us with nothing usable, fall back to every token.
      const pool = candidates.length > 0 ? candidates : colors

      const foregrounds = pool
        .filter((token) => token.hex.toLowerCase() !== background.hex.toLowerCase())
        .map((token) => ({ token, verdict: evaluateContrast(token.hex, background.hex) }))
        .sort((a, b) => b.verdict.ratio - a.verdict.ratio)

      return { background, foregrounds }
    })
    .filter((pairing) => pairing.foregrounds.length > 0)
}
