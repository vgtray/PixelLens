// PixelLens — Design System Builder (assemble all extraction results)

import type {
  DesignSystem,
  ColorToken,
  TypographyToken,
  SpacingToken,
  ShadowToken,
  ShadowParsed,
  BorderRadiusToken,
} from '@/types/design-system'

export class DesignSystemBuilder {
  build(
    colors: ColorToken[],
    typography: TypographyToken[],
    spacing: SpacingToken[],
    elements: Element[],
  ): DesignSystem {
    const shadows = this.extractShadows(elements)
    const borderRadius = this.extractBorderRadius(elements)

    return {
      colors,
      typography,
      spacing,
      shadows,
      borderRadius,
      metadata: {
        url: window.location.href,
        title: document.title,
        scannedAt: new Date().toISOString(),
      },
    }
  }

  private extractShadows(elements: Element[]): ShadowToken[] {
    const shadowSet = new Map<string, ShadowToken>()

    for (const el of elements) {
      const computed = window.getComputedStyle(el)
      const shadow = computed.getPropertyValue('box-shadow')

      if (!shadow || shadow === 'none') continue

      // Deduplicate by raw value
      if (shadowSet.has(shadow)) continue

      const parsed = this.parseShadow(shadow)
      if (parsed) {
        shadowSet.set(shadow, { value: shadow, parsed })
      }
    }

    return Array.from(shadowSet.values())
  }

  private parseShadow(shadow: string): ShadowParsed | null {
    // Basic shadow parsing: <x> <y> <blur> <spread> <color>
    // Computed values always resolve to rgb() format
    const rgbMatch = shadow.match(/(rgba?\([^)]+\))\s+(-?[\d.]+px)\s+(-?[\d.]+px)\s+([\d.]+px)\s*([\d.]+px)?/)
    if (rgbMatch) {
      return {
        color: rgbMatch[1],
        x: rgbMatch[2],
        y: rgbMatch[3],
        blur: rgbMatch[4],
        spread: rgbMatch[5] || '0px',
      }
    }

    // Alternate order: offsets first then color
    const altMatch = shadow.match(/(-?[\d.]+px)\s+(-?[\d.]+px)\s+([\d.]+px)\s*([\d.]+px)?\s+(rgba?\([^)]+\))/)
    if (altMatch) {
      return {
        x: altMatch[1],
        y: altMatch[2],
        blur: altMatch[3],
        spread: altMatch[4] || '0px',
        color: altMatch[5],
      }
    }

    return null
  }

  private extractBorderRadius(elements: Element[]): BorderRadiusToken[] {
    const freqMap = new Map<string, number>()

    for (const el of elements) {
      const computed = window.getComputedStyle(el)
      const br = computed.getPropertyValue('border-radius')

      if (!br || br === '0px') continue

      freqMap.set(br, (freqMap.get(br) || 0) + 1)
    }

    return Array.from(freqMap.entries())
      .map(([value, frequency]) => ({ value, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
  }
}
