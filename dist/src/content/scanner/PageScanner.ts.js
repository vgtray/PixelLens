import { getVisibleElements } from "/src/lib/dom-utils.ts.js";
import { ColorExtractor } from "/src/content/scanner/ColorExtractor.ts.js";
import { TypographyExtractor } from "/src/content/scanner/TypographyExtractor.ts.js";
import { SpacingExtractor } from "/src/content/scanner/SpacingExtractor.ts.js";
import { DesignSystemBuilder } from "/src/content/scanner/DesignSystemBuilder.ts.js";
export class PageScanner {
  colorExtractor = new ColorExtractor();
  typographyExtractor = new TypographyExtractor();
  spacingExtractor = new SpacingExtractor();
  builder = new DesignSystemBuilder();
  async scan(onProgress) {
    onProgress?.(5, "Scanning DOM elements...");
    const elements = getVisibleElements();
    onProgress?.(15, `Found ${elements.length} elements`);
    await this.yieldFrame();
    onProgress?.(20, "Extracting colors...");
    let colors;
    try {
      colors = this.colorExtractor.extract(elements);
    } catch {
      colors = [];
    }
    onProgress?.(45, `Found ${colors.length} colors`);
    await this.yieldFrame();
    onProgress?.(50, "Extracting typography...");
    let typography;
    try {
      typography = this.typographyExtractor.extract(elements);
    } catch {
      typography = [];
    }
    onProgress?.(65, `Found ${typography.length} font families`);
    await this.yieldFrame();
    onProgress?.(70, "Extracting spacing...");
    let spacing;
    try {
      spacing = this.spacingExtractor.extract(elements);
    } catch {
      spacing = [];
    }
    onProgress?.(85, `Found ${spacing.length} spacing values`);
    await this.yieldFrame();
    onProgress?.(90, "Building design system...");
    const designSystem = this.builder.build(colors, typography, spacing, elements);
    onProgress?.(100, "Scan complete");
    return designSystem;
  }
  yieldFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
}
