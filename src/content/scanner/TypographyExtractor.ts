// PixelLens — Typography Extractor (extract fonts and type scale from the page)

import type { TypographyToken, TypographyVariant } from '@/types/design-system'

const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'li', 'label', 'button',
  'td', 'th', 'caption', 'blockquote',
])

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
}
