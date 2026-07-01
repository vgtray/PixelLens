import { describe, it, expect } from 'vitest'
import { buildLlmBundle } from '../llm-bundle'
import type { MarkdownResult } from '@/types/markdown'
import type { DesignSystem } from '@/types/design-system'

// --- Fixtures ------------------------------------------------------------------------

function md(over: Partial<MarkdownResult['frontmatter']> = {}, body = '# Hello\n\nSome body.'): MarkdownResult {
  return {
    frontmatter: {
      title: 'Test Page',
      url: 'https://example.com/page',
      capturedAt: '2026-07-01T10:00:00.000Z',
      description: 'A short description',
      siteName: 'Example',
      lang: 'en',
      wordCount: 42,
      ...over,
    },
    markdown: body,
    fullDocument: '---\n---\n\n' + body,
    stats: { headings: 3, links: 5, images: 2, tables: 1, codeBlocks: 4 },
  }
}

const ds: DesignSystem = {
  colors: [
    { name: 'Brand Red', hex: '#ff0000', frequency: 10, category: 'primary' },
    { name: 'Ink', hex: '#111111', frequency: 30, category: 'text' },
  ],
  typography: [
    {
      fontFamily: '"Inter", sans-serif',
      variants: [{ fontSize: '16px', fontWeight: '400', lineHeight: '1.5', letterSpacing: '0px' }],
    },
  ],
  spacing: [{ value: '8px', frequency: 20, label: 'Small' }],
  borderRadius: [{ value: '4px', frequency: 10 }],
  shadows: [
    {
      value: '0 2px 4px rgba(0,0,0,0.1)',
      parsed: { x: '0', y: '2px', blur: '4px', spread: '0', color: 'rgba(0,0,0,0.1)' },
    },
  ],
  metadata: { url: 'https://example.com', title: 'Test', scannedAt: '2026-07-01T09:00:00.000Z' },
}

// --- With design system --------------------------------------------------------------

describe('buildLlmBundle — avec design system', () => {
  const out = buildLlmBundle({ markdown: md(), designSystem: ds })

  it('émet un frontmatter global marquant le design system comme inclus', () => {
    expect(out.startsWith('---\n')).toBe(true)
    expect(out).toContain('generator: PixelLens')
    expect(out).toContain('kind: llm-bundle')
    expect(out).toContain('designSystem: included')
    expect(out).toContain('title: "Test Page"')
    expect(out).toContain('url: "https://example.com/page"')
    expect(out).toContain('wordCount: 42')
  })

  it('contient les trois sections principales dans l\'ordre', () => {
    const iContent = out.indexOf('## Page content')
    const iDs = out.indexOf('## Design system')
    const iMeta = out.indexOf('## Metadata')
    expect(iContent).toBeGreaterThan(-1)
    expect(iDs).toBeGreaterThan(iContent)
    expect(iMeta).toBeGreaterThan(iDs)
  })

  it('intègre le corps Markdown de la page', () => {
    expect(out).toContain('# Hello')
    expect(out).toContain('Some body.')
  })

  it('rend la palette de couleurs en tableau', () => {
    expect(out).toContain('### Colors')
    expect(out).toContain('| Name | Hex | Category | Freq |')
    expect(out).toContain('| Brand Red | `#ff0000` | primary | 10 |')
    expect(out).toContain('| Ink | `#111111` | text | 30 |')
  })

  it('rend la typographie avec familles et métriques', () => {
    expect(out).toContain('### Typography')
    expect(out).toContain('- **"Inter", sans-serif**')
    expect(out).toContain('16px · weight 400 · line-height 1.5 · letter-spacing 0px')
  })

  it('rend spacing, shadows et border radius', () => {
    expect(out).toContain('### Spacing')
    expect(out).toContain('| Small | 8px | 20 |')
    expect(out).toContain('### Shadows')
    expect(out).toContain('- `0 2px 4px rgba(0,0,0,0.1)`')
    expect(out).toContain('### Border radius')
    expect(out).toContain('| 4px | 10 |')
  })

  it('référence la source du scan', () => {
    expect(out).toContain('Extracted from https://example.com · scanned 2026-07-01T09:00:00.000Z')
  })

  it('rend la table de métadonnées (frontmatter + stats)', () => {
    expect(out).toContain('## Metadata')
    expect(out).toContain('| Field | Value |')
    expect(out).toContain('| Title | Test Page |')
    expect(out).toContain('| Site | Example |')
    expect(out).toContain('| Language | en |')
    expect(out).toContain('| Description | A short description |')
    expect(out).toContain('| Words | 42 |')
    expect(out).toContain('| Headings | 3 |')
    expect(out).toContain('| Code blocks | 4 |')
  })
})

// --- Without design system -----------------------------------------------------------

describe('buildLlmBundle — sans design system', () => {
  it('remplace la section par une note et marque designSystem: none', () => {
    const out = buildLlmBundle({ markdown: md() })
    expect(out).toContain('designSystem: none')
    expect(out).toContain('## Design system')
    expect(out).toContain('_No scan yet — run Scan for design tokens._')
    expect(out).not.toContain('### Colors')
  })

  it('traite designSystem: null comme absent', () => {
    const out = buildLlmBundle({ markdown: md(), designSystem: null })
    expect(out).toContain('designSystem: none')
    expect(out).toContain('_No scan yet — run Scan for design tokens._')
  })

  it('conserve tout de même contenu et métadonnées', () => {
    const out = buildLlmBundle({ markdown: md() })
    expect(out).toContain('## Page content')
    expect(out).toContain('## Metadata')
    expect(out).toContain('# Hello')
  })
})

// --- Escaping / edge cases -----------------------------------------------------------

describe('buildLlmBundle — échappement & cas limites', () => {
  it('échappe les guillemets et aplatit les sauts de ligne dans le frontmatter', () => {
    const out = buildLlmBundle({ markdown: md({ title: 'Say "hi"\nagain' }) })
    expect(out).toContain('title: "Say \\"hi\\" again"')
    // Le titre H1 est aussi aplati sur une seule ligne.
    expect(out).toContain('# Say "hi" again')
  })

  it('échappe les pipes dans les cellules de tableau', () => {
    const piped: DesignSystem = {
      ...ds,
      colors: [{ name: 'Weird | Name', hex: '#abcdef', frequency: 1, category: 'accent' }],
    }
    const out = buildLlmBundle({ markdown: md(), designSystem: piped })
    expect(out).toContain('| Weird \\| Name | `#abcdef` | accent | 1 |')
  })

  it('omet les champs de métadonnées absents', () => {
    const out = buildLlmBundle({
      markdown: md({ siteName: undefined, lang: undefined, description: undefined }),
    })
    expect(out).not.toContain('| Site |')
    expect(out).not.toContain('| Language |')
    expect(out).not.toContain('| Description |')
    expect(out).toContain('| Title | Test Page |')
  })

  it('gère un corps Markdown vide', () => {
    const out = buildLlmBundle({ markdown: md({}, '   ') })
    expect(out).toContain('## Page content')
    expect(out).toContain('_(empty document)_')
  })

  it('omet les sous-sections du design system dont les collections sont vides', () => {
    const sparse: DesignSystem = {
      colors: [{ name: 'Only', hex: '#000000', frequency: 1, category: 'neutral' }],
      typography: [],
      spacing: [],
      shadows: [],
      borderRadius: [],
      metadata: ds.metadata,
    }
    const out = buildLlmBundle({ markdown: md(), designSystem: sparse })
    expect(out).toContain('### Colors')
    expect(out).not.toContain('### Typography')
    expect(out).not.toContain('### Spacing')
    expect(out).not.toContain('### Shadows')
    expect(out).not.toContain('### Border radius')
  })

  it('termine par exactement un saut de ligne', () => {
    const out = buildLlmBundle({ markdown: md(), designSystem: ds })
    expect(out.endsWith('|\n')).toBe(true)
    expect(out.endsWith('|\n\n')).toBe(false)
  })
})
