// PixelLens — Typography Extractor (extract fonts and type scale from the page)

import type { TypographyToken, TypographyVariant } from '@/types/design-system'

const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'li', 'label', 'button',
  'td', 'th', 'caption', 'blockquote',
])

const KNOWN_RATIOS = [1.067, 1.125, 1.2, 1.25, 1.333, 1.414, 1.5, 1.618] as const

export class TypographyExtractor {
  extract(elements: Element[]): TypographyToken[] {
    // Family → Map<"size|weight" → variant with count>
    const familyMap = new Map<string, Map<string, TypographyVariant & { count: number }>>()

    for (const el of elements) {
      const tag = el.tagName.toLowerCase()
      if (!TEXT_TAGS.has(tag)) continue

      const computed = window.getComputedStyle(el)
      const fontFamily = computed.getPropertyValue('font-family')
      const fontSize = computed.getPropertyValue('font-size')
      const fontWeight = computed.getPropertyValue('font-weight')
      const lineHeight = computed.getPropertyValue('line-height')
      const letterSpacing = computed.getPropertyValue('letter-spacing')

      if (!fontFamily || !fontSize) continue

      const familyKey = fontFamily.trim()
      const variantKey = `${fontSize}|${fontWeight}`

      if (!familyMap.has(familyKey)) {
        familyMap.set(familyKey, new Map())
      }

      const variants = familyMap.get(familyKey)!
      if (variants.has(variantKey)) {
        variants.get(variantKey)!.count++
      } else {
        variants.set(variantKey, {
          fontSize,
          fontWeight,
          lineHeight,
          letterSpacing,
          count: 1,
        })
      }
    }

    // Convert to TypographyToken[]
    const tokens: TypographyToken[] = []

    for (const [fontFamily, variantsMap] of familyMap) {
      const variants: TypographyVariant[] = Array.from(variantsMap.values())
        .sort((a, b) => parseFloat(b.fontSize) - parseFloat(a.fontSize))
        .map(({ fontSize, fontWeight, lineHeight, letterSpacing }) => ({
          fontSize,
          fontWeight,
          lineHeight,
          letterSpacing,
        }))

      tokens.push({ fontFamily, variants })
    }

    // Sort by total variant count (most used family first)
    tokens.sort((a, b) => b.variants.length - a.variants.length)

    return tokens
  }

  detectTypeScaleRatio(tokens: TypographyToken[]): number | null {
    // Collect all unique font sizes across all families
    const sizes = new Set<number>()
    for (const token of tokens) {
      for (const v of token.variants) {
        const px = parseFloat(v.fontSize)
        if (px > 0) sizes.add(px)
      }
    }

    const sorted = Array.from(sizes).sort((a, b) => a - b)
    if (sorted.length < 3) return null

    // Compute ratios between consecutive sizes
    const ratios: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      ratios.push(sorted[i] / sorted[i - 1])
    }

    // Find the median ratio
    ratios.sort((a, b) => a - b)
    const median = ratios[Math.floor(ratios.length / 2)]

    // Match to nearest known ratio
    let closest: number = KNOWN_RATIOS[0]
    let minDiff = Math.abs(median - closest)
    for (const r of KNOWN_RATIOS) {
      const diff = Math.abs(median - r)
      if (diff < minDiff) {
        minDiff = diff
        closest = r
      }
    }

    return minDiff < 0.1 ? closest : null
  }
}
