// PixelLens — Color Extractor (extract and cluster colors from the page)

import { toHex, toRgb, toHsl, isTransparent, clusterColors, classifyColors } from '@/lib/colors'
import type { ColorToken } from '@/types/design-system'

const COLOR_PROPS = ['color', 'background-color', 'border-color', 'outline-color'] as const

const SKIP_VALUES = new Set([
  'transparent', 'rgba(0, 0, 0, 0)', 'inherit', 'initial', 'currentcolor',
])

export class ColorExtractor {
  extract(elements: Element[]): ColorToken[] {
    const freqMap = new Map<string, number>()

    for (const el of elements) {
      const computed = window.getComputedStyle(el)

      for (const prop of COLOR_PROPS) {
        const value = computed.getPropertyValue(prop)
        if (!value || SKIP_VALUES.has(value.toLowerCase())) continue
        if (isTransparent(value)) continue

        let hex: string
        try {
          hex = toHex(value)
        } catch {
          continue
        }

        freqMap.set(hex, (freqMap.get(hex) || 0) + 1)
      }
    }

    // Convert to array for clustering
    const rawColors = Array.from(freqMap.entries()).map(([hex, frequency]) => ({
      hex,
      frequency,
    }))

    // Cluster similar colors (deltaE < 5)
    const clustered = clusterColors(rawColors, 5)

    // Build ColorToken array
    const tokens: ColorToken[] = clustered.map((c) => ({
      name: '',
      hex: c.hex,
      rgb: toRgb(c.hex),
      hsl: toHsl(c.hex),
      frequency: c.frequency,
      category: 'accent' as const,
    }))

    // Classify into primary/secondary/neutral/bg/text
    return classifyColors(tokens)
  }
}
