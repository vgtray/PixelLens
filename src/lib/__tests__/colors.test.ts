import { describe, it, expect } from 'vitest';
import {
  toHex,
  tryToHex,
  toRgb,
  toHsl,
  isNeutral,
  isTransparent,
  deltaE,
  clusterColors,
  classifyColors,
  getContrastRatio,
} from '../colors';
import type { ColorToken } from '@/types/design-system';

describe('toHex', () => {
  it('converts rgb string to hex', () => {
    expect(toHex('rgb(255, 0, 0)')).toBe('#ff0000');
  });

  it('converts hsl string to hex', () => {
    const hex = toHex('hsl(120, 100%, 50%)');
    expect(hex).toBe('#00ff00');
  });

  it('never round-trips an unparseable color as a fake hex', () => {
    // Regression guard (was `toHex('not-a-color') === 'not-a-color'`): toHex used
    // to return its input verbatim, so garbage leaked downstream as a fake token.
    expect(toHex('not-a-color')).not.toBe('not-a-color');
    expect(toHex('not-a-color')).toMatch(/^#[0-9a-f]{6}$/);
    expect(tryToHex('not-a-color')).toBeNull();
  });

  it('passes through hex values', () => {
    expect(toHex('#abcdef')).toBe('#abcdef');
  });
});

describe('modern CSS colors', () => {
  it('parses oklch via chroma', () => {
    expect(tryToHex('oklch(0.7 0.15 200)')).toBe('#00b9c3');
  });

  it('parses lab via chroma', () => {
    expect(tryToHex('lab(50% 40 30)')).toBe('#bb5846');
  });

  it('parses hwb (which chroma 3.2.0 cannot)', () => {
    expect(tryToHex('hwb(120 0% 0%)')).toBe('#00ff00');
    expect(tryToHex('hwb(0 0% 0%)')).toBe('#ff0000');
  });

  it('parses color(srgb ...)', () => {
    expect(tryToHex('color(srgb 0.5 0 0.5)')).toBe('#800080');
    expect(tryToHex('color(srgb 1 1 1)')).toBe('#ffffff');
  });

  it('maps Display-P3 into sRGB (valid hex, never a black swatch)', () => {
    const hex = tryToHex('color(display-p3 1 0 0)');
    expect(hex).not.toBeNull();
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(hex).toBe('#ff0000');
  });

  it('parses color-mix(in srgb, ...)', () => {
    expect(tryToHex('color-mix(in srgb, red, blue)')).toBe('#800080');
    expect(tryToHex('color-mix(in srgb, white 25%, black)')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('feeds a valid rgb/hsl for modern colors (no {0,0,0} fallback)', () => {
    expect(toRgb('color(display-p3 1 0 0)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(toHsl('color(srgb 0.5 0 0.5)').s).toBeGreaterThan(0);
  });

  it('returns null for genuinely invalid input (jsdom has no canvas)', () => {
    expect(tryToHex('definitely-not-a-color')).toBeNull();
    expect(tryToHex('rgb(oops)')).toBeNull();
  });
});

describe('toRgb', () => {
  it('converts hex to rgb', () => {
    expect(toRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('converts named color', () => {
    expect(toRgb('white')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns black for invalid color', () => {
    expect(toRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('toHsl', () => {
  it('converts red to hsl', () => {
    const hsl = toHsl('#ff0000');
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it('handles achromatic colors (hue = NaN)', () => {
    const hsl = toHsl('#808080');
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
  });

  it('returns zeros for invalid color', () => {
    expect(toHsl('invalid')).toEqual({ h: 0, s: 0, l: 0 });
  });
});

describe('isNeutral', () => {
  it('returns true for grays (low saturation)', () => {
    expect(isNeutral('#808080')).toBe(true);
    expect(isNeutral('#ffffff')).toBe(true);
    expect(isNeutral('#000000')).toBe(true);
  });

  it('returns false for vivid colors', () => {
    expect(isNeutral('#ff0000')).toBe(false);
    expect(isNeutral('#00ff00')).toBe(false);
  });

  it('returns false for invalid color', () => {
    expect(isNeutral('invalid')).toBe(false);
  });
});

describe('isTransparent', () => {
  it('returns true for fully transparent', () => {
    expect(isTransparent('rgba(0,0,0,0)')).toBe(true);
    expect(isTransparent('transparent')).toBe(true);
  });

  it('returns false for opaque colors', () => {
    expect(isTransparent('#ff0000')).toBe(false);
    expect(isTransparent('rgb(0,0,0)')).toBe(false);
  });
});

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    expect(deltaE('#ff0000', '#ff0000')).toBe(0);
  });

  it('returns > 0 for different colors', () => {
    expect(deltaE('#ff0000', '#00ff00')).toBeGreaterThan(0);
  });

  it('returns Infinity for invalid colors', () => {
    expect(deltaE('invalid', '#ff0000')).toBe(Infinity);
  });
});

describe('getContrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBe(21);
  });

  it('returns 1 for same color', () => {
    expect(getContrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it('returns 0 for invalid color', () => {
    expect(getContrastRatio('invalid', '#fff')).toBe(0);
  });
});

describe('clusterColors', () => {
  it('returns empty array for empty input', () => {
    expect(clusterColors([])).toEqual([]);
  });

  it('clusters similar colors together', () => {
    const colors = [
      { hex: '#ff0000', frequency: 5 },
      { hex: '#ff0102', frequency: 3 },
      { hex: '#00ff00', frequency: 2 },
    ];
    const result = clusterColors(colors);
    // Red shades should cluster, green stays separate
    expect(result.length).toBe(2);
    // Most frequent cluster first
    expect(result[0].frequency).toBe(8);
  });

  it('keeps distinct colors separate', () => {
    const colors = [
      { hex: '#ff0000', frequency: 1 },
      { hex: '#00ff00', frequency: 1 },
      { hex: '#0000ff', frequency: 1 },
    ];
    const result = clusterColors(colors);
    expect(result.length).toBe(3);
  });
});

describe('classifyColors', () => {
  it('classifies chromatic colors as primary/secondary/accent', () => {
    const colors: ColorToken[] = [
      { name: '', hex: '#ff0000', frequency: 10, category: 'primary' },
      { name: '', hex: '#00ff00', frequency: 5, category: 'primary' },
      { name: '', hex: '#0000ff', frequency: 2, category: 'primary' },
    ];
    const result = classifyColors(colors);
    expect(result[0].category).toBe('primary');
    expect(result[1].category).toBe('secondary');
    expect(result[2].category).toBe('accent');
  });

  it('classifies neutrals by luminance', () => {
    const colors: ColorToken[] = [
      { name: '', hex: '#ffffff', frequency: 10, category: 'primary' },
      { name: '', hex: '#000000', frequency: 5, category: 'primary' },
      { name: '', hex: '#808080', frequency: 3, category: 'primary' },
    ];
    const result = classifyColors(colors);
    const white = result.find((c) => c.hex === '#ffffff')!;
    const black = result.find((c) => c.hex === '#000000')!;
    const gray = result.find((c) => c.hex === '#808080')!;
    expect(white.category).toBe('background');
    expect(black.category).toBe('text');
    expect(gray.category).toBe('neutral');
  });
});
