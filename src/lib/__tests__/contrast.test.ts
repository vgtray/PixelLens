import { describe, it, expect } from 'vitest'
import {
  evaluateContrast,
  buildContrastReport,
  formatRatio,
  WCAG_THRESHOLDS,
} from '../contrast'
import type { ColorToken, ColorCategory } from '@/types/design-system'

const token = (hex: string, category: ColorCategory, frequency = 1): ColorToken => ({
  name: hex,
  hex,
  frequency,
  category,
})

describe('evaluateContrast', () => {
  it('scores black on white as the maximum 21:1 and passes every level', () => {
    const v = evaluateContrast('#000000', '#ffffff')
    expect(v.ratio).toBeCloseTo(21, 5)
    expect(v.aaNormal).toBe(true)
    expect(v.aaLarge).toBe(true)
    expect(v.aaaNormal).toBe(true)
    expect(v.aaaLarge).toBe(true)
    expect(v.normalLevel).toBe('AAA')
    expect(v.largeLevel).toBe('AAA')
  })

  it('scores identical colors as 1:1 and fails every level', () => {
    const v = evaluateContrast('#123456', '#123456')
    expect(v.ratio).toBeCloseTo(1, 5)
    expect(v.aaNormal).toBe(false)
    expect(v.aaLarge).toBe(false)
    expect(v.normalLevel).toBe('fail')
    expect(v.largeLevel).toBe('fail')
  })

  it('passes AA (not AAA) for normal text at ~4.54:1 (#767676 on white)', () => {
    const v = evaluateContrast('#767676', '#ffffff')
    expect(v.ratio).toBeGreaterThanOrEqual(WCAG_THRESHOLDS.aaNormal)
    expect(v.ratio).toBeLessThan(WCAG_THRESHOLDS.aaaNormal)
    expect(v.aaNormal).toBe(true)
    expect(v.aaaNormal).toBe(false)
    expect(v.normalLevel).toBe('AA')
    // ratio >= 4.5 also clears AAA for large text.
    expect(v.largeLevel).toBe('AAA')
  })

  it('passes large text only at ~3.23:1 (#8f8f8f on white)', () => {
    const v = evaluateContrast('#8f8f8f', '#ffffff')
    expect(v.aaNormal).toBe(false)
    expect(v.aaLarge).toBe(true)
    expect(v.aaaLarge).toBe(false)
    expect(v.normalLevel).toBe('fail')
    expect(v.largeLevel).toBe('AA')
  })

  it('fails both sizes below 3:1 (#a0a0a0 on white)', () => {
    const v = evaluateContrast('#a0a0a0', '#ffffff')
    expect(v.aaLarge).toBe(false)
    expect(v.normalLevel).toBe('fail')
    expect(v.largeLevel).toBe('fail')
  })

  it('is symmetric in its two arguments', () => {
    expect(evaluateContrast('#6366F1', '#ffffff').ratio).toBeCloseTo(
      evaluateContrast('#ffffff', '#6366F1').ratio,
      6,
    )
  })
})

describe('formatRatio', () => {
  it('renders two decimals', () => {
    expect(formatRatio(4.5)).toBe('4.50')
    expect(formatRatio(21)).toBe('21.00')
  })
})

describe('buildContrastReport', () => {
  it('pairs each foreground against explicit background tokens, best contrast first', () => {
    const colors = [
      token('#ffffff', 'background', 10),
      token('#000000', 'text', 8),
      token('#767676', 'neutral', 5),
      token('#6366F1', 'primary', 6),
    ]
    const report = buildContrastReport(colors)

    expect(report).toHaveLength(1)
    expect(report[0].background.hex).toBe('#ffffff')
    // Background token is not evaluated as its own foreground.
    expect(report[0].foregrounds.map((f) => f.token.hex)).toEqual([
      '#000000',
      '#767676',
      '#6366F1',
    ])
    expect(report[0].foregrounds[0].verdict.aaaNormal).toBe(true)
  })

  it('skips a foreground identical to its background, dropping empty pairings', () => {
    const colors = [token('#ffffff', 'background'), token('#ffffff', 'text')]
    expect(buildContrastReport(colors)).toEqual([])
  })

  it('falls back to luminance extremes when no background token is classified', () => {
    const colors = [
      token('#000000', 'text'),
      token('#767676', 'neutral'),
      token('#6366F1', 'primary'),
    ]
    const report = buildContrastReport(colors)
    expect(report.length).toBeGreaterThanOrEqual(1)
    const inputHexes = new Set(colors.map((c) => c.hex))
    for (const pairing of report) {
      expect(inputHexes.has(pairing.background.hex)).toBe(true)
      // No pairing ever includes a foreground equal to its own background.
      for (const fg of pairing.foregrounds) {
        expect(fg.token.hex).not.toBe(pairing.background.hex)
      }
    }
  })

  it('returns nothing for an empty palette', () => {
    expect(buildContrastReport([])).toEqual([])
  })
})
