// PixelLens — Page Scanner (orchestrates full page scan)

import { getVisibleElements } from '@/lib/dom-utils'
import { ColorExtractor } from './ColorExtractor'
import { TypographyExtractor } from './TypographyExtractor'
import { SpacingExtractor } from './SpacingExtractor'
import { DesignSystemBuilder } from './DesignSystemBuilder'
import type { DesignSystem, ColorToken, TypographyToken, SpacingToken } from '@/types/design-system'

type ProgressCallback = (percent: number, phase: string) => void

export class PageScanner {
  private colorExtractor = new ColorExtractor()
  private typographyExtractor = new TypographyExtractor()
  private spacingExtractor = new SpacingExtractor()
  private builder = new DesignSystemBuilder()

  async scan(onProgress?: ProgressCallback): Promise<DesignSystem> {
    // Phase 1: DOM traversal
    onProgress?.(5, 'Scanning DOM elements...')
    const elements = getVisibleElements()
    onProgress?.(15, `Found ${elements.length} elements`)

    // Yield to main thread between heavy phases
    await this.yieldFrame()

    // Phase 2: Color extraction
    onProgress?.(20, 'Extracting colors...')
    let colors: ColorToken[]
    try {
      colors = this.colorExtractor.extract(elements)
    } catch {
      colors = []
    }
    onProgress?.(45, `Found ${colors.length} colors`)

    await this.yieldFrame()

    // Phase 3: Typography extraction
    onProgress?.(50, 'Extracting typography...')
    let typography: TypographyToken[]
    try {
      typography = this.typographyExtractor.extract(elements)
    } catch {
      typography = []
    }
    onProgress?.(65, `Found ${typography.length} font families`)

    await this.yieldFrame()

    // Phase 4: Spacing extraction
    onProgress?.(70, 'Extracting spacing...')
    let spacing: SpacingToken[]
    try {
      spacing = this.spacingExtractor.extract(elements)
    } catch {
      spacing = []
    }
    onProgress?.(85, `Found ${spacing.length} spacing values`)

    await this.yieldFrame()

    // Phase 5: Build design system (includes shadow + border-radius)
    onProgress?.(90, 'Building design system...')
    const designSystem = this.builder.build(colors, typography, spacing, elements)
    onProgress?.(100, 'Scan complete')

    return designSystem
  }

  private yieldFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
}
