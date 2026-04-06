// PixelLens — Spacing Extractor (extract spacing patterns from the page)

import type { SpacingToken } from '@/types/design-system'

const SPACING_PROPS = [
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
] as const

export class SpacingExtractor {
  extract(elements: Element[]): SpacingToken[] {
    const freqMap = new Map<number, number>()

    for (const el of elements) {
      const computed = window.getComputedStyle(el)

      for (const prop of SPACING_PROPS) {
        const raw = computed.getPropertyValue(prop)
        const px = parseFloat(raw)
        if (isNaN(px) || px === 0) continue

        // Round to nearest even number
        const rounded = this.roundSpacing(Math.abs(px))
        if (rounded === 0) continue

        freqMap.set(rounded, (freqMap.get(rounded) || 0) + 1)
      }
    }

    // Detect base unit
    const baseUnit = this.detectBaseUnit(freqMap)

    // Build spacing scale from base unit
    const multipliers = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]
    const scaleValues = new Set(multipliers.map((m) => Math.round(baseUnit * m)))

    // Collect all values sorted by frequency
    const allValues = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])

    const tokens: SpacingToken[] = []
    const seen = new Set<number>()

    // First add scale values that appear in the data
    for (const scaleVal of scaleValues) {
      const freq = freqMap.get(scaleVal) || 0
      if (freq > 0 && !seen.has(scaleVal)) {
        seen.add(scaleVal)
        tokens.push({
          value: `${scaleVal}px`,
          frequency: freq,
          label: this.getLabel(scaleVal, baseUnit),
        })
      }
    }

    // Then add top non-scale values
    for (const [val, freq] of allValues) {
      if (seen.has(val)) continue
      if (tokens.length >= 16) break
      seen.add(val)
      tokens.push({
        value: `${val}px`,
        frequency: freq,
        label: `space-${val}`,
      })
    }

    tokens.sort((a, b) => parseFloat(a.value) - parseFloat(b.value))
    return tokens
  }

  private roundSpacing(px: number): number {
    // Round to nearest multiple of 2
    return Math.round(px / 2) * 2
  }

  private detectBaseUnit(freqMap: Map<number, number>): number {
    // Check frequency of common base units (4 and 8)
    const freq4 = freqMap.get(4) || 0
    const freq8 = freqMap.get(8) || 0

    // Count how many values are multiples of 8 vs 4
    let multOf8 = 0
    let multOf4 = 0
    let total = 0

    for (const [val, freq] of freqMap) {
      total += freq
      if (val % 8 === 0) multOf8 += freq
      if (val % 4 === 0) multOf4 += freq
    }

    // If >60% of values are multiples of 8, base is 8
    if (total > 0 && multOf8 / total > 0.6) return 8
    // If >60% of values are multiples of 4, base is 4
    if (total > 0 && multOf4 / total > 0.6) return 4

    // Fallback: whichever of 4 or 8 is more frequent
    return freq8 >= freq4 ? 8 : 4
  }

  private getLabel(value: number, base: number): string {
    const ratio = value / base
    // Clean ratio labels
    if (ratio === 0.5) return `space-${base}-half`
    if (ratio === 1) return `space-${base}`
    if (ratio === 1.5) return `space-${base}-1half`
    if (Number.isInteger(ratio)) return `space-${base}-x${ratio}`
    return `space-${value}`
  }
}
