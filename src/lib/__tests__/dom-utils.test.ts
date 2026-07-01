import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isElementVisible, isPixelLensElement, getElementPath, getVisibleElements } from '../dom-utils';

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


describe('getVisibleElements', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('scans <html> and <body> (page background + base typography)', () => {
    document.body.innerHTML = '<div id="child"></div>';
    const child = document.getElementById('child')!;
    mockRect(document.documentElement, 1000, 800);
    mockRect(document.body, 1000, 800);
    mockRect(child, 100, 50);

    const els = getVisibleElements();
    expect(els).toContain(document.documentElement);
    expect(els).toContain(document.body);
    expect(els).toContain(child);
  });

  it('keeps visible children of a display:contents / zero-box wrapper', () => {
    document.body.innerHTML = '<div id="wrap"><span id="leaf">x</span></div>';
    const wrap = document.getElementById('wrap')!;
    const leaf = document.getElementById('leaf')!;
    wrap.style.display = 'contents';
    mockRect(document.documentElement, 1000, 800);
    mockRect(document.body, 1000, 800);
    mockRect(wrap, 0, 0); // display:contents paints no box
    mockRect(leaf, 40, 20);

    const els = getVisibleElements();
    expect(els).toContain(leaf); // subtree preserved (FILTER_SKIP, not REJECT)
    expect(els).not.toContain(wrap); // wrapper itself is skipped
  });

  it('prunes a display:none subtree entirely', () => {
    document.body.innerHTML = '<div id="hidden"><span id="deep">x</span></div>';
    const hidden = document.getElementById('hidden')!;
    const deep = document.getElementById('deep')!;
    hidden.style.display = 'none';
    mockRect(document.documentElement, 1000, 800);
    mockRect(document.body, 1000, 800);
    mockRect(deep, 40, 20);

    const els = getVisibleElements();
    expect(els).not.toContain(hidden);
    expect(els).not.toContain(deep); // REJECT prunes the whole subtree
  });

  it('keeps a visible child under a visibility:hidden parent', () => {
    document.body.innerHTML = '<div id="vh"><span id="shown">x</span></div>';
    const vh = document.getElementById('vh')!;
    const shown = document.getElementById('shown')!;
    vh.style.visibility = 'hidden';
    shown.style.visibility = 'visible';
    mockRect(document.documentElement, 1000, 800);
    mockRect(document.body, 1000, 800);
    mockRect(vh, 100, 40);
    mockRect(shown, 40, 20);

    const els = getVisibleElements();
    expect(els).not.toContain(vh); // hidden node skipped
    expect(els).toContain(shown); // but its visible child is kept
  });
});
