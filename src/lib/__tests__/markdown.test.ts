import { describe, it, expect, afterEach } from 'vitest'
import { htmlToMarkdown } from '../markdown'
import type { MarkdownPageContext } from '../markdown'
import { MarkdownExtractor } from '@/content/scanner/MarkdownExtractor'

// --- Helpers ------------------------------------------------------------------------

// Wraps an HTML fragment in a detached element to feed htmlToMarkdown (which expects a
// cleaned, detached clone — exactly what MarkdownExtractor produces in production).
function root(html: string): HTMLElement {
  const div = document.createElement('div')
  div.innerHTML = html
  return div
}

const BASE = 'https://example.com/docs/page.html'

function ctx(over: Partial<MarkdownPageContext> = {}): MarkdownPageContext {
  return {
    url: 'https://example.com/docs/page.html',
    baseURI: BASE,
    title: 'Test Page',
    ...over,
  }
}

function convert(html: string, over: Partial<MarkdownPageContext> = {}) {
  return htmlToMarkdown(root(html), ctx(over))
}

// --- Structure ----------------------------------------------------------------------

describe('htmlToMarkdown — block structure', () => {
  it('devrait convertir les headings h1 a h6 en ATX', () => {
    const md = convert(
      '<h1>T1</h1><h2>T2</h2><h3>T3</h3><h4>T4</h4><h5>T5</h5><h6>T6</h6>',
    ).markdown
    expect(md).toContain('# T1')
    expect(md).toContain('## T2')
    expect(md).toContain('### T3')
    expect(md).toContain('#### T4')
    expect(md).toContain('##### T5')
    expect(md).toContain('###### T6')
  })

  it('devrait convertir les paragraphes', () => {
    const md = convert('<p>First paragraph.</p><p>Second paragraph.</p>').markdown
    expect(md).toContain('First paragraph.')
    expect(md).toContain('Second paragraph.')
    expect(md).toMatch(/First paragraph\.\n\nSecond paragraph\./)
  })

  it('devrait convertir une liste non ordonnee', () => {
    // turndown aligne le contenu : marqueur `-` suivi de plusieurs espaces.
    const md = convert('<ul><li>Alpha</li><li>Beta</li></ul>').markdown
    expect(md).toMatch(/-\s+Alpha/)
    expect(md).toMatch(/-\s+Beta/)
  })

  it('devrait convertir une liste ordonnee', () => {
    const md = convert('<ol><li>First</li><li>Second</li></ol>').markdown
    expect(md).toMatch(/1\.\s+First/)
    expect(md).toMatch(/2\.\s+Second/)
  })

  it('devrait convertir une liste imbriquee avec indentation', () => {
    const md = convert('<ul><li>Parent<ul><li>Child</li></ul></li></ul>').markdown
    expect(md).toMatch(/-\s+Parent/)
    expect(md).toMatch(/\n\s{2,}-\s+Child/)
  })

  it('devrait convertir un blockquote', () => {
    const md = convert('<blockquote><p>Quoted text</p></blockquote>').markdown
    expect(md).toMatch(/^> Quoted text/m)
  })
})

// --- GFM ----------------------------------------------------------------------------

describe('htmlToMarkdown — GFM (tables, code, strikethrough, task lists)', () => {
  it('devrait convertir une table en GFM', () => {
    const md = convert(
      '<table><thead><tr><th>Name</th><th>Age</th></tr></thead>' +
        '<tbody><tr><td>Ada</td><td>36</td></tr></tbody></table>',
    ).markdown
    // turndown-gfm pad les colonnes : on tolere les espaces de cadrage.
    expect(md).toMatch(/\|\s*Name\s*\|\s*Age\s*\|/)
    expect(md).toMatch(/\|\s*-{3,}\s*\|/)
    expect(md).toMatch(/\|\s*Ada\s*\|\s*36\s*\|/)
  })

  it('devrait convertir un bloc de code fence avec son langage', () => {
    const md = convert('<pre><code class="language-js">const x = 1;</code></pre>').markdown
    expect(md).toContain('```js')
    expect(md).toContain('const x = 1;')
  })

  it('devrait convertir un bloc de code sans langage', () => {
    const md = convert('<pre><code>plain code</code></pre>').markdown
    expect(md).toContain('```')
    expect(md).toContain('plain code')
  })

  it('devrait convertir le strikethrough', () => {
    const md = convert('<p>This is <del>removed</del> text</p>').markdown
    expect(md).toContain('~~removed~~')
  })

  it('devrait convertir une task list cochee et non cochee', () => {
    const md = convert(
      '<ul>' +
        '<li><input type="checkbox" checked> Done</li>' +
        '<li><input type="checkbox"> Todo</li>' +
        '</ul>',
    ).markdown
    expect(md).toMatch(/\[x\]\s*Done/)
    expect(md).toMatch(/\[ \]\s*Todo/)
  })
})

// --- Liens & images -----------------------------------------------------------------

describe('htmlToMarkdown — liens et images', () => {
  it('devrait resoudre les liens relatifs en absolus', () => {
    const md = convert('<a href="../about">About</a>').markdown
    expect(md).toContain('[About](https://example.com/about)')
  })

  it('devrait laisser les ancres internes inchangees', () => {
    const md = convert('<a href="#section">Jump</a>').markdown
    expect(md).toContain('[Jump](#section)')
  })

  it('devrait resoudre les images relatives en absolues avec alt et title', () => {
    const md = convert('<img src="pic.png" alt="My pic" title="Tip">').markdown
    expect(md).toContain('![My pic](https://example.com/docs/pic.png "Tip")')
  })

  it('devrait resoudre la srcset (plus haute densite) quand src absent', () => {
    const md = convert('<img srcset="small.png 320w, large.png 640w" alt="resp">').markdown
    expect(md).toContain('https://example.com/docs/large.png')
    expect(md).not.toContain('small.png')
  })

  it('devrait dropper les images base64 (data:)', () => {
    const md = convert(
      '<p>before</p><img src="data:image/png;base64,iVBORw0KGgo=" alt="inline"><p>after</p>',
    ).markdown
    expect(md).not.toContain('data:image')
    expect(md).not.toContain('![inline]')
    expect(md).toContain('before')
    expect(md).toContain('after')
  })

  it('devrait dropper les images blob:', () => {
    const md = convert('<img src="blob:https://example.com/abc" alt="b">').markdown
    expect(md).not.toContain('blob:')
    expect(md).not.toContain('![b]')
  })

  it('devrait neutraliser un lien javascript: en conservant le texte', () => {
    const md = convert('<a href="javascript:alert(1)">Click me</a>').markdown
    expect(md).toContain('Click me')
    expect(md).not.toContain('javascript:')
    expect(md).not.toContain('[Click me]')
  })

  it('devrait neutraliser vbscript: et data: dans les hrefs', () => {
    const vb = convert('<a href="vbscript:msgbox(1)">V</a>').markdown
    expect(vb).toContain('V')
    expect(vb).not.toContain('vbscript:')
    const data = convert('<a href="data:text/html,hello">D</a>').markdown
    expect(data).toContain('D')
    expect(data).not.toContain('data:')
  })

  it('devrait preserver un lien http normal', () => {
    const md = convert('<a href="https://example.com/page">Normal</a>').markdown
    expect(md).toContain('[Normal](https://example.com/page)')
  })
})

// --- Frontmatter --------------------------------------------------------------------

describe('htmlToMarkdown — frontmatter YAML', () => {
  it('devrait inclure title, url, capturedAt et wordCount', () => {
    const { frontmatter, fullDocument } = convert('<p>hello world here</p>', {
      capturedAt: '2026-06-30T10:00:00.000Z',
    })
    expect(frontmatter.title).toBe('Test Page')
    expect(frontmatter.url).toBe('https://example.com/docs/page.html')
    expect(frontmatter.capturedAt).toBe('2026-06-30T10:00:00.000Z')
    expect(frontmatter.wordCount).toBe(3)
    expect(fullDocument).toContain('title: "Test Page"')
    expect(fullDocument).toContain('url: "https://example.com/docs/page.html"')
    expect(fullDocument).toContain('capturedAt: "2026-06-30T10:00:00.000Z"')
    expect(fullDocument).toContain('wordCount: 3')
  })

  it('devrait inclure description, siteName et lang quand presents', () => {
    const { fullDocument } = convert('<p>x</p>', {
      description: 'A description',
      siteName: 'Example',
      lang: 'en',
    })
    expect(fullDocument).toContain('description: "A description"')
    expect(fullDocument).toContain('siteName: "Example"')
    expect(fullDocument).toContain('lang: "en"')
  })

  it('devrait omettre les champs optionnels absents', () => {
    const { frontmatter, fullDocument } = convert('<p>x</p>')
    expect(frontmatter.description).toBeUndefined()
    expect(fullDocument).not.toContain('description:')
    expect(fullDocument).not.toContain('siteName:')
    expect(fullDocument).not.toContain('lang:')
  })

  it('devrait echapper les guillemets et deux-points dans les valeurs YAML', () => {
    const { fullDocument } = convert('<p>x</p>', {
      title: 'Quote: "hello" world',
    })
    expect(fullDocument).toContain('title: "Quote: \\"hello\\" world"')
  })

  it('devrait aplatir les sauts de ligne dans une valeur YAML', () => {
    const { fullDocument } = convert('<p>x</p>', {
      description: 'line one\nline two',
    })
    expect(fullDocument).toContain('description: "line one line two"')
  })

  it('devrait retomber sur "Untitled" quand le title est vide', () => {
    const { frontmatter } = convert('<p>x</p>', { title: '   ' })
    expect(frontmatter.title).toBe('Untitled')
  })

  it('devrait generer un capturedAt ISO par defaut', () => {
    const { frontmatter } = convert('<p>x</p>')
    expect(frontmatter.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

// --- Stats --------------------------------------------------------------------------

describe('htmlToMarkdown — stats', () => {
  it('devrait compter exactement headings/links/images/tables/codeBlocks', () => {
    const { stats } = convert(
      '<h1>A</h1><h2>B</h2>' +
        '<a href="https://x.test/1">l1</a><a href="https://x.test/2">l2</a><a href="#anchor">l3</a>' +
        '<img src="a.png"><img src="data:image/png;base64,AAAA">' +
        '<table><tr><td>c</td></tr></table>' +
        '<pre><code>code</code></pre>',
    )
    expect(stats).toEqual({
      headings: 2,
      links: 3,
      images: 2,
      tables: 1,
      codeBlocks: 1,
    })
  })

  it('devrait compter une image base64 dans les stats mais l exclure du markdown', () => {
    const { stats, markdown } = convert(
      '<img src="real.png" alt="real"><img src="data:image/png;base64,AAAA" alt="b64">',
    )
    expect(stats.images).toBe(2)
    expect((markdown.match(/!\[/g) ?? []).length).toBe(1)
  })
})

// --- fullDocument -------------------------------------------------------------------

describe('htmlToMarkdown — fullDocument', () => {
  it('devrait assembler frontmatter + corps markdown', () => {
    const result = convert('<h1>Title</h1><p>Body content</p>')
    expect(result.fullDocument.startsWith('---\n')).toBe(true)
    expect(result.fullDocument).toContain('\n---\n\n')
    expect(result.fullDocument).toContain(result.markdown)
    expect(result.fullDocument.endsWith(result.markdown)).toBe(true)
  })
})

// --- MarkdownExtractor : nettoyage FULL (clone + suppression du bruit) ----------------

describe('MarkdownExtractor — nettoyage du DOM', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('devrait retirer script, style et noscript', () => {
    document.body.innerHTML =
      '<p>Visible content</p>' +
      "<script>console.log('secret-token')</script>" +
      '<style>.x{color:red}</style>' +
      '<noscript>no script here</noscript>'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Visible content')
    expect(markdown).not.toContain('secret-token')
    expect(markdown).not.toContain('color:red')
    expect(markdown).not.toContain('no script here')
  })

  it('devrait retirer les elements caches (display:none, hidden, aria-hidden, visibility:hidden)', () => {
    document.body.innerHTML =
      '<p>Keep me</p>' +
      '<p style="display:none">display none</p>' +
      '<p hidden>hidden attr</p>' +
      '<p aria-hidden="true">aria hidden</p>' +
      '<p style="visibility:hidden">visibility hidden</p>'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Keep me')
    expect(markdown).not.toContain('display none')
    expect(markdown).not.toContain('hidden attr')
    expect(markdown).not.toContain('aria hidden')
    expect(markdown).not.toContain('visibility hidden')
  })

  it('devrait retirer les commentaires HTML', () => {
    document.body.innerHTML = '<p>Real text</p><!-- a hidden comment -->'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Real text')
    expect(markdown).not.toContain('a hidden comment')
  })

  it('devrait retirer les svg et iframe (non representables en Markdown)', () => {
    document.body.innerHTML =
      '<p>Around</p>' +
      '<svg><text>vector label</text></svg>' +
      '<iframe src="https://ads.test"></iframe>'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Around')
    expect(markdown).not.toContain('vector label')
  })

  it('devrait inliner le contenu des open shadow roots dans le markdown', () => {
    document.body.innerHTML = '<p>Light content</p><div id="host"></div>'
    const host = document.getElementById('host')!
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<h2>Shadow heading</h2><p>Shadow body</p>'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Light content')
    expect(markdown).toContain('Shadow heading')
    expect(markdown).toContain('Shadow body')
  })

  it('ne devrait jamais capturer la propre UI de PixelLens (host + shadow root)', () => {
    document.body.innerHTML = '<p>Page content</p><div id="pixellens-host"></div>'
    const host = document.getElementById('pixellens-host')!
    host.attachShadow({ mode: 'open' }).innerHTML = '<p>extension internal ui</p>'
    const { markdown } = new MarkdownExtractor().extract()
    expect(markdown).toContain('Page content')
    expect(markdown).not.toContain('extension internal ui')
  })
})
