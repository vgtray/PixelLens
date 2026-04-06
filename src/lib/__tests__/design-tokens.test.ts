import { describe, it, expect } from 'vitest';
import {
  toCSSVariables,
  toTailwindConfig,
  toJSONTokens,
  formatExport,
} from '../design-tokens';
import type { DesignSystem } from '@/types/design-system';

const mockDS: DesignSystem = {
  colors: [
    {
      name: 'Brand Red',
      hex: '#ff0000',
      rgb: { r: 255, g: 0, b: 0 },
      hsl: { h: 0, s: 100, l: 50 },
      frequency: 10,
      category: 'primary',
    },
  ],
  typography: [
    {
      fontFamily: '"Inter", sans-serif',
      variants: [{ fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: '0px' }],
    },
  ],
  spacing: [{ value: '8px', frequency: 20, label: 'Small' }],
  borderRadius: [{ value: '4px', frequency: 10 }],
  shadows: [{ value: '0 2px 4px rgba(0,0,0,0.1)', parsed: { x: '0', y: '2px', blur: '4px', spread: '0', color: 'rgba(0,0,0,0.1)' } }],
  metadata: { url: 'https://example.com', title: 'Test', scannedAt: '2026-01-01' },
};

describe('toCSSVariables', () => {
  it('generates valid CSS with :root block', () => {
    const css = toCSSVariables(mockDS);
    expect(css).toContain(':root {');
    expect(css).toContain('}');
  });

  it('includes color variables', () => {
    const css = toCSSVariables(mockDS);
    expect(css).toContain('--color-brand-red: #ff0000;');
  });

  it('includes font variables', () => {
    const css = toCSSVariables(mockDS);
    expect(css).toContain('--font-inter:');
  });

  it('includes spacing variables', () => {
    const css = toCSSVariables(mockDS);
    expect(css).toContain('--spacing-small: 8px;');
  });

  it('includes radius and shadow variables', () => {
    const css = toCSSVariables(mockDS);
    expect(css).toContain('--radius-1: 4px;');
    expect(css).toContain('--shadow-1:');
  });
});

describe('toTailwindConfig', () => {
  it('returns theme.extend structure', () => {
    const config = toTailwindConfig(mockDS) as any;
    expect(config.theme.extend).toBeDefined();
    expect(config.theme.extend.colors).toBeDefined();
    expect(config.theme.extend.fontFamily).toBeDefined();
    expect(config.theme.extend.spacing).toBeDefined();
  });

  it('maps colors by slugified name', () => {
    const config = toTailwindConfig(mockDS) as any;
    expect(config.theme.extend.colors['brand-red']).toBe('#ff0000');
  });

  it('maps font families as arrays', () => {
    const config = toTailwindConfig(mockDS) as any;
    expect(config.theme.extend.fontFamily['inter']).toEqual(['Inter', 'sans-serif']);
  });
});

describe('toJSONTokens', () => {
  it('returns valid JSON structure with $schema', () => {
    const tokens = toJSONTokens(mockDS);
    expect(tokens.$schema).toBeDefined();
  });

  it('includes color tokens with $value and $type', () => {
    const tokens = toJSONTokens(mockDS) as any;
    const colorEntry = tokens.color['Brand Red'];
    expect(colorEntry.$value).toBe('#ff0000');
    expect(colorEntry.$type).toBe('color');
  });

  it('includes spacing tokens', () => {
    const tokens = toJSONTokens(mockDS) as any;
    expect(tokens.spacing['small'].$value).toBe('8px');
    expect(tokens.spacing['small'].$type).toBe('dimension');
  });
});

describe('formatExport', () => {
  it('dispatches to css-variables format', () => {
    const result = formatExport(mockDS, 'css-variables');
    expect(result).toContain(':root {');
  });

  it('dispatches to tailwind format', () => {
    const result = formatExport(mockDS, 'tailwind');
    expect(result).toContain('module.exports');
    expect(result).toContain('"theme"');
  });

  it('dispatches to json format', () => {
    const result = formatExport(mockDS, 'json');
    const parsed = JSON.parse(result);
    expect(parsed.$schema).toBeDefined();
  });

  it('returns empty string for png format', () => {
    expect(formatExport(mockDS, 'png')).toBe('');
  });
});
