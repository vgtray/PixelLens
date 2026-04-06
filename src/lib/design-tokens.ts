// PixelLens — Design Token Export Utilities

import type { DesignSystem, ExportFormat } from '@/types/design-system'

export function toCSSVariables(ds: DesignSystem): string {
  const lines: string[] = [':root {']

  // Colors
  for (const color of ds.colors) {
    const name = color.name || `${color.category}-${color.hex.slice(1)}`
    lines.push(`  --color-${slugify(name)}: ${color.hex};`)
  }

  // Typography
  for (const font of ds.typography) {
    const familyName = slugify(font.fontFamily.split(',')[0].replace(/['"]/g, '').trim())
    lines.push(`  --font-${familyName}: ${font.fontFamily};`)
  }

  // Spacing
  for (const space of ds.spacing) {
    lines.push(`  --spacing-${slugify(space.label)}: ${space.value};`)
  }

  // Border radius
  ds.borderRadius.forEach((br, i) => {
    lines.push(`  --radius-${i + 1}: ${br.value};`)
  })

  // Shadows
  ds.shadows.forEach((shadow, i) => {
    lines.push(`  --shadow-${i + 1}: ${shadow.value};`)
  })

  lines.push('}')
  return lines.join('\n')
}

export function toTailwindConfig(ds: DesignSystem): Record<string, unknown> {
  const colors: Record<string, string> = {}
  for (const color of ds.colors) {
    const name = color.name || `${color.category}-${color.hex.slice(1)}`
    colors[slugify(name)] = color.hex
  }

  const fontFamily: Record<string, string[]> = {}
  for (const font of ds.typography) {
    const familyName = slugify(font.fontFamily.split(',')[0].replace(/['"]/g, '').trim())
    fontFamily[familyName] = font.fontFamily.split(',').map((f) => f.trim().replace(/['"]/g, ''))
  }

  const spacing: Record<string, string> = {}
  for (const space of ds.spacing) {
    spacing[slugify(space.label)] = space.value
  }

  const borderRadius: Record<string, string> = {}
  ds.borderRadius.forEach((br, i) => {
    borderRadius[`r${i + 1}`] = br.value
  })

  const boxShadow: Record<string, string> = {}
  ds.shadows.forEach((shadow, i) => {
    boxShadow[`s${i + 1}`] = shadow.value
  })

  return {
    theme: {
      extend: {
        colors,
        fontFamily,
        spacing,
        borderRadius,
        boxShadow,
      },
    },
  }
}

export function toJSONTokens(ds: DesignSystem): Record<string, unknown> {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    color: Object.fromEntries(
      ds.colors.map((c) => [
        c.name || `${c.category}-${c.hex.slice(1)}`,
        { $value: c.hex, $type: 'color', $description: `${c.category} — freq: ${c.frequency}` },
      ]),
    ),
    fontFamily: Object.fromEntries(
      ds.typography.map((t) => [
        slugify(t.fontFamily.split(',')[0].replace(/['"]/g, '').trim()),
        { $value: t.fontFamily, $type: 'fontFamily' },
      ]),
    ),
    spacing: Object.fromEntries(
      ds.spacing.map((s) => [
        slugify(s.label),
        { $value: s.value, $type: 'dimension' },
      ]),
    ),
    borderRadius: Object.fromEntries(
      ds.borderRadius.map((br, i) => [
        `radius-${i + 1}`,
        { $value: br.value, $type: 'dimension' },
      ]),
    ),
    boxShadow: Object.fromEntries(
      ds.shadows.map((s, i) => [
        `shadow-${i + 1}`,
        { $value: s.value, $type: 'shadow' },
      ]),
    ),
  }
}

export function formatExport(ds: DesignSystem, format: ExportFormat): string {
  switch (format) {
    case 'css-variables':
      return toCSSVariables(ds)
    case 'tailwind':
      return `/** @type {import('tailwindcss').Config} */\nmodule.exports = ${JSON.stringify(toTailwindConfig(ds), null, 2)}`
    case 'json':
      return JSON.stringify(toJSONTokens(ds), null, 2)
    case 'png':
      return '' // handled separately via generatePalettePNG
  }
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
