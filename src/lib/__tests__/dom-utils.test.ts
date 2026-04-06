import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isElementVisible, isPixelLensElement, getElementPath } from '../dom-utils';

function mockRect(el: Element, width: number, height: number) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('isElementVisible', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true for a visible element', () => {
    const el = document.createElement('div');
    el.style.display = 'block';
    document.body.appendChild(el);
    mockRect(el, 100, 100);
    expect(isElementVisible(el)).toBe(true);
  });

  it('returns false for display:none', () => {
    const el = document.createElement('div');
    el.style.display = 'none';
    document.body.appendChild(el);
    mockRect(el, 0, 0);
    expect(isElementVisible(el)).toBe(false);
  });

  it('returns false for visibility:hidden', () => {
    const el = document.createElement('div');
    el.style.visibility = 'hidden';
    document.body.appendChild(el);
    mockRect(el, 100, 100);
    expect(isElementVisible(el)).toBe(false);
  });

  it('returns false for opacity:0', () => {
    const el = document.createElement('div');
    el.style.opacity = '0';
    document.body.appendChild(el);
    mockRect(el, 100, 100);
    expect(isElementVisible(el)).toBe(false);
  });

  it('returns false for zero-size element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    mockRect(el, 0, 0);
    expect(isElementVisible(el)).toBe(false);
  });
});

describe('isPixelLensElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns true for elements inside #pixellens-host', () => {
    const host = document.createElement('div');
    host.id = 'pixellens-host';
    const child = document.createElement('span');
    host.appendChild(child);
    document.body.appendChild(host);
    expect(isPixelLensElement(child)).toBe(true);
  });

  it('returns true for the host element itself', () => {
    const host = document.createElement('div');
    host.id = 'pixellens-host';
    document.body.appendChild(host);
    expect(isPixelLensElement(host)).toBe(true);
  });

  it('returns false for elements outside #pixellens-host', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    expect(isPixelLensElement(el)).toBe(false);
  });
});

describe('getElementPath', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('returns tag name for simple element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const path = getElementPath(el);
    expect(path).toContain('div');
  });

  it('includes id when present and stops there', () => {
    const parent = document.createElement('div');
    parent.id = 'main';
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);
    const path = getElementPath(child);
    expect(path).toContain('div#main');
    expect(path).toContain('span');
  });

  it('includes class names', () => {
    const el = document.createElement('div');
    el.className = 'foo bar';
    document.body.appendChild(el);
    const path = getElementPath(el);
    expect(path).toContain('.foo');
    expect(path).toContain('.bar');
  });

  it('includes nth-of-type for siblings', () => {
    const parent = document.createElement('div');
    const child1 = document.createElement('span');
    const child2 = document.createElement('span');
    parent.appendChild(child1);
    parent.appendChild(child2);
    document.body.appendChild(parent);
    const path = getElementPath(child2);
    expect(path).toContain('nth-of-type(2)');
  });
});
