// PixelLens — CSS Parser Utilities

export function formatCSSProperty(prop: string, value: string): string {
  return `${prop}: ${value};`
}

export function generateCSSBlock(styles: Record<string, string>): string {
  const relevant = filterRelevantStyles(styles)
  return Object.entries(relevant)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n')
}

export function shorthandToLonghand(
  prop: string,
  value: string,
): Record<string, string> {
  const parts = value.split(/\s+/)

  if (prop === 'margin' || prop === 'padding') {
    const [top, right = top, bottom = top, left = right] = parts
    return {
      [`${prop}-top`]: top,
      [`${prop}-right`]: right,
      [`${prop}-bottom`]: bottom,
      [`${prop}-left`]: left,
    }
  }

  if (prop === 'border-radius') {
    const [tl, tr = tl, br = tl, bl = tr] = parts
    return {
      'border-top-left-radius': tl,
      'border-top-right-radius': tr,
      'border-bottom-right-radius': br,
      'border-bottom-left-radius': bl,
    }
  }

  return { [prop]: value }
}

const SKIP_PROPERTIES = new Set([
  'all', 'animation', 'transition',
  '-webkit-text-fill-color', '-webkit-tap-highlight-color',
])

function filterRelevantStyles(styles: Record<string, string>): Record<string, string> {
  const defaults: Record<string, string> = {
    'opacity': '1',
    'visibility': 'visible',
    'display': 'block',
    'position': 'static',
    'box-shadow': 'none',
    'backdrop-filter': 'none',
    'transform': 'none',
  }

  const result: Record<string, string> = {}

  for (const [prop, value] of Object.entries(styles)) {
    if (SKIP_PROPERTIES.has(prop)) continue
    if (prop.startsWith('-webkit-') && !prop.includes('backdrop')) continue
    if (value === '' || value === 'initial' || value === 'normal' || value === 'auto') continue
    if (defaults[prop] === value) continue
    result[prop] = value
  }

  return result
}
