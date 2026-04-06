// PixelLens — CSS Parser Utilities

import type { ColorInfo, TypographyInfo, EffectsInfo } from '@/types/inspection'
import { toHex, toRgb, toHsl } from './colors'

const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
]

const TYPOGRAPHY_PROPERTIES = [
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
]

const EFFECT_PROPERTIES = [
  'box-shadow',
  'opacity',
  'backdrop-filter',
  'border-radius',
]

export interface ParsedStyles {
  colors: ColorInfo[]
  typography: TypographyInfo
  effects: EffectsInfo
  allProperties: Record<string, string>
}

export function parseComputedStyles(element: Element): ParsedStyles {
  const computed = window.getComputedStyle(element)
  const allProperties: Record<string, string> = {}

  for (const prop of computed) {
    allProperties[prop] = computed.getPropertyValue(prop)
  }

  const colors: ColorInfo[] = COLOR_PROPERTIES
    .map((prop) => {
      const value = computed.getPropertyValue(prop)
      if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return null
      return {
        property: prop,
        value,
        hex: toHex(value),
        rgb: toRgb(value),
        hsl: toHsl(value),
      }
    })
    .filter((c): c is ColorInfo => c !== null)

  const typography: TypographyInfo = {
    fontFamily: computed.getPropertyValue('font-family'),
    fontSize: computed.getPropertyValue('font-size'),
    fontWeight: computed.getPropertyValue('font-weight'),
    lineHeight: computed.getPropertyValue('line-height'),
    letterSpacing: computed.getPropertyValue('letter-spacing'),
  }

  const effects: EffectsInfo = {
    boxShadow: computed.getPropertyValue('box-shadow'),
    opacity: computed.getPropertyValue('opacity'),
    backdropFilter: computed.getPropertyValue('backdrop-filter'),
    borderRadius: computed.getPropertyValue('border-radius'),
  }

  return { colors, typography, effects, allProperties }
}

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
