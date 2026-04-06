import { describe, it, expect } from 'vitest';
import {
  formatCSSProperty,
  generateCSSBlock,
  shorthandToLonghand,
} from '../css-parser';

describe('formatCSSProperty', () => {
  it('formats a property-value pair with semicolon', () => {
    expect(formatCSSProperty('color', 'red')).toBe('color: red;');
  });

  it('handles complex values', () => {
    expect(formatCSSProperty('font-family', '"Helvetica", sans-serif')).toBe(
      'font-family: "Helvetica", sans-serif;',
    );
  });
});

describe('generateCSSBlock', () => {
  it('generates indented CSS lines from styles', () => {
    const styles = { color: '#ff0000', 'font-size': '16px' };
    const result = generateCSSBlock(styles);
    expect(result).toContain('color: #ff0000;');
    expect(result).toContain('font-size: 16px;');
    // Each line should be indented
    for (const line of result.split('\n')) {
      expect(line).toMatch(/^\s{2}/);
    }
  });

  it('filters out default/skip properties', () => {
    const styles = {
      opacity: '1',       // default — should be filtered
      color: '#ff0000',   // non-default — should be kept
    };
    const result = generateCSSBlock(styles);
    expect(result).not.toContain('opacity');
    expect(result).toContain('color');
  });

  it('filters out auto/initial/normal values', () => {
    const styles = {
      'margin-top': 'auto',
      'font-style': 'normal',
      display: 'initial',
      color: '#000',
    };
    const result = generateCSSBlock(styles);
    expect(result).not.toContain('margin-top');
    expect(result).not.toContain('font-style');
    expect(result).not.toContain('display');
    expect(result).toContain('color');
  });
});

describe('shorthandToLonghand', () => {
  it('expands margin with 4 values', () => {
    const result = shorthandToLonghand('margin', '10px 20px 30px 40px');
    expect(result).toEqual({
      'margin-top': '10px',
      'margin-right': '20px',
      'margin-bottom': '30px',
      'margin-left': '40px',
    });
  });

  it('expands padding with 1 value', () => {
    const result = shorthandToLonghand('padding', '8px');
    expect(result).toEqual({
      'padding-top': '8px',
      'padding-right': '8px',
      'padding-bottom': '8px',
      'padding-left': '8px',
    });
  });

  it('expands margin with 2 values', () => {
    const result = shorthandToLonghand('margin', '10px 20px');
    expect(result).toEqual({
      'margin-top': '10px',
      'margin-right': '20px',
      'margin-bottom': '10px',
      'margin-left': '20px',
    });
  });

  it('expands border-radius with 4 values', () => {
    const result = shorthandToLonghand('border-radius', '1px 2px 3px 4px');
    expect(result).toEqual({
      'border-top-left-radius': '1px',
      'border-top-right-radius': '2px',
      'border-bottom-right-radius': '3px',
      'border-bottom-left-radius': '4px',
    });
  });

  it('returns original for unknown properties', () => {
    const result = shorthandToLonghand('color', '#ff0000');
    expect(result).toEqual({ color: '#ff0000' });
  });
});
