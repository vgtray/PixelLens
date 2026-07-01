// PixelLens — Design System Builder (assemble all extraction results)

import type {
  DesignSystem,
  ColorToken,
  TypographyToken,
  SpacingToken,
  ShadowToken,
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

      // Store the raw computed value only. The previous parseShadow() output
      // (ShadowToken.parsed) was never read by any consumer — ShadowPreview
      // renders shadow.value directly — so the parse was dead + buggy work.
      shadowSet.set(shadow, { value: shadow })
    }

    return Array.from(shadowSet.values())
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
