import { describe, it, expect } from 'vitest'
import {
  normalizeUrl,
  sameOrigin,
  parseRobots,
  robotsAllows,
  parseSitemap,
  extractLinks,
  buildSiteDocument,
  crawlSite,
  type CrawlDeps,
} from '../crawler'
import { htmlDocumentToMarkdown } from '../markdown'
import type { CrawlPageResult } from '@/types/crawl'

// --- Helpers ------------------------------------------------------------------------

// Fake fetch piloté par une table URL -> texte (null = échec / absent).
function makeFetch(pages: Record<string, string | null>) {
  const calls: string[] = []
  const fetchText = async (url: string): Promise<string | null> => {
    calls.push(url)
    return url in pages ? pages[url] : null
  }
  return { fetchText, calls }
}

const convert = (_html: string, url: string): CrawlPageResult => ({
  url,
  title: `Title ${url}`,
  markdown: `Body of ${url}`,
  wordCount: 3,
})

// Deps de base : conversion factice, délai instantané, pas d'annulation.
function baseDeps(fetchText: CrawlDeps['fetchText'], over: Partial<CrawlDeps> = {}): CrawlDeps {
  return {
    fetchText,
    convert,
    delay: () => Promise.resolve(),
    ...over,
  }
}

function page(links: string[]): string {
  const anchors = links.map((h) => `<a href="${h}">x</a>`).join('')
  return `<!doctype html><html><body><h1>Hi</h1>${anchors}</body></html>`
}

const sortedPageUrls = (pages: CrawlPageResult[]) => pages.map((p) => p.url).sort()

// --- normalizeUrl -------------------------------------------------------------------

describe('normalizeUrl', () => {
  it('retire le fragment #', () => {
    expect(normalizeUrl('https://ex.com/a#section')).toBe('https://ex.com/a')
  })
  it('retire le slash final sauf à la racine', () => {
    expect(normalizeUrl('https://ex.com/a/')).toBe('https://ex.com/a')
    expect(normalizeUrl('https://ex.com/')).toBe('https://ex.com/')
  })
  it('conserve la query string', () => {
    expect(normalizeUrl('https://ex.com/a?p=1#x')).toBe('https://ex.com/a?p=1')
  })
  it('renvoie tel quel une URL non parsable', () => {
    expect(normalizeUrl('not a url')).toBe('not a url')
  })
})

// --- sameOrigin ---------------------------------------------------------------------

describe('sameOrigin', () => {
  it('vrai pour même protocole + host + port', () => {
    expect(sameOrigin('https://ex.com/a', 'https://ex.com')).toBe(true)
  })
  it('faux pour host différent', () => {
    expect(sameOrigin('https://other.com/a', 'https://ex.com')).toBe(false)
  })
  it('faux pour protocole différent', () => {
    expect(sameOrigin('http://ex.com/a', 'https://ex.com')).toBe(false)
  })
})

// --- robots.txt ---------------------------------------------------------------------

describe('parseRobots / robotsAllows', () => {
  it('extrait les Disallow du groupe User-agent: *', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /private\nDisallow: /tmp\n')
    expect(rules).toEqual(['/private', '/tmp'])
  })

  it("ignore les Disallow des autres user-agents", () => {
    const rules = parseRobots(
      'User-agent: Googlebot\nDisallow: /nogoogle\n\nUser-agent: *\nDisallow: /private\n',
    )
    expect(rules).toEqual(['/private'])
  })

  it('ignore les commentaires et les Disallow vides', () => {
    const rules = parseRobots('User-agent: *  # tout\nDisallow:\nDisallow: /x\n')
    expect(rules).toEqual(['/x'])
  })

  it('robotsAllows applique le préfixe', () => {
    expect(robotsAllows('/private/p', ['/private'])).toBe(false)
    expect(robotsAllows('/public', ['/private'])).toBe(true)
  })

  it('robotsAllows gère le joker * et l’ancre $', () => {
    expect(robotsAllows('/files/a.pdf', ['/*.pdf$'])).toBe(false)
    expect(robotsAllows('/files/a.html', ['/*.pdf$'])).toBe(true)
  })
})

// --- sitemap ------------------------------------------------------------------------

describe('parseSitemap', () => {
  it('parse un urlset', () => {
    const xml =
      '<?xml version="1.0"?><urlset><url><loc>https://ex.com/a</loc></url>' +
      '<url><loc>https://ex.com/b</loc></url></urlset>'
    const { urls, isIndex } = parseSitemap(xml)
    expect(isIndex).toBe(false)
    expect(urls).toEqual(['https://ex.com/a', 'https://ex.com/b'])
  })

  it('parse un sitemapindex', () => {
    const xml =
      '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://ex.com/s1.xml</loc></sitemap>' +
      '<sitemap><loc>https://ex.com/s2.xml</loc></sitemap></sitemapindex>'
    const { urls, isIndex } = parseSitemap(xml)
    expect(isIndex).toBe(true)
    expect(urls).toEqual(['https://ex.com/s1.xml', 'https://ex.com/s2.xml'])
  })

  it('renvoie vide sur XML invalide', () => {
    expect(parseSitemap('<<<not xml').urls).toEqual([])
  })
})

// --- extractLinks -------------------------------------------------------------------

describe('extractLinks', () => {
  it('résout les liens relatifs en absolu et ignore les ancres pures', () => {
    const html = '<a href="/a">A</a><a href="#top">T</a><a href="b">B</a>'
    expect(extractLinks(html, 'https://ex.com/dir/')).toEqual([
      'https://ex.com/a',
      'https://ex.com/dir/b',
    ])
  })

  it('ignore mailto: / tel: / javascript:', () => {
    const html = '<a href="mailto:x@y.z">m</a><a href="javascript:void(0)">j</a><a href="/ok">o</a>'
    expect(extractLinks(html, 'https://ex.com/')).toEqual(['https://ex.com/ok'])
  })
})

// --- buildSiteDocument --------------------------------------------------------------

describe('buildSiteDocument', () => {
  const pages: CrawlPageResult[] = [
    { url: 'https://ex.com/', title: 'Home', markdown: '# Home\n\nWelcome', wordCount: 2 },
    { url: 'https://ex.com/about', title: 'About', markdown: '## About us', wordCount: 2 },
  ]
  const doc = buildSiteDocument({
    host: 'ex.com',
    startUrl: 'https://ex.com/',
    pages,
    skippedCount: 1,
    discovery: 'sitemap',
    generatedAt: '2026-07-01T00:00:00.000Z',
  })

  it('contient un frontmatter global avec host, date et nombre de pages', () => {
    expect(doc.startsWith('---\n')).toBe(true)
    expect(doc).toContain('site: "ex.com"')
    expect(doc).toContain('crawledAt: "2026-07-01T00:00:00.000Z"')
    expect(doc).toContain('pages: 2')
    expect(doc).toContain('discovery: "sitemap"')
  })

  it('contient une table des matières avec une entrée par page', () => {
    expect(doc).toContain('## Table of contents')
    expect(doc).toContain('1. [Home](#home) — https://ex.com/')
    expect(doc).toContain('2. [About](#about) — https://ex.com/about')
  })

  it('génère une section ancrée par page séparée par ---', () => {
    expect(doc).toContain('<a id="home"></a>')
    expect(doc).toContain('<a id="about"></a>')
    expect(doc).toContain('Welcome')
    expect(doc).toContain('About us')
    expect(doc).toContain('\n---\n')
  })

  it('déduplique les ancres de titres identiques', () => {
    const dup = buildSiteDocument({
      host: 'ex.com',
      startUrl: 'https://ex.com/',
      pages: [
        { url: 'https://ex.com/a', title: 'Doc', markdown: 'a', wordCount: 1 },
        { url: 'https://ex.com/b', title: 'Doc', markdown: 'b', wordCount: 1 },
      ],
      skippedCount: 0,
      discovery: 'crawl',
      generatedAt: '2026-07-01T00:00:00.000Z',
    })
    expect(dup).toContain('<a id="doc"></a>')
    expect(dup).toContain('<a id="doc-1"></a>')
  })
})

// --- crawlSite : découverte sitemap -------------------------------------------------

describe('crawlSite — découverte via sitemap', () => {
  it('utilise les URLs du sitemap et marque discovery=sitemap', async () => {
    const { fetchText } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml':
        '<urlset><url><loc>https://ex.com/</loc></url>' +
        '<url><loc>https://ex.com/a</loc></url>' +
        '<url><loc>https://ex.com/b</loc></url></urlset>',
      'https://ex.com/': page([]),
      'https://ex.com/a': page([]),
      'https://ex.com/b': page([]),
    })
    const res = await crawlSite({ startUrl: 'https://ex.com/' }, baseDeps(fetchText))
    expect(res.stats.discovery).toBe('sitemap')
    expect(sortedPageUrls(res.pages)).toEqual([
      'https://ex.com/',
      'https://ex.com/a',
      'https://ex.com/b',
    ])
  })

  it('suit les sous-sitemaps d’un sitemap index', async () => {
    const { fetchText, calls } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml':
        '<sitemapindex><sitemap><loc>https://ex.com/s1.xml</loc></sitemap>' +
        '<sitemap><loc>https://ex.com/s2.xml</loc></sitemap></sitemapindex>',
      'https://ex.com/s1.xml': '<urlset><url><loc>https://ex.com/a</loc></url></urlset>',
      'https://ex.com/s2.xml': '<urlset><url><loc>https://ex.com/b</loc></url></urlset>',
      'https://ex.com/': page([]),
      'https://ex.com/a': page([]),
      'https://ex.com/b': page([]),
    })
    const res = await crawlSite({ startUrl: 'https://ex.com/' }, baseDeps(fetchText))
    expect(res.stats.discovery).toBe('sitemap')
    expect(calls).toContain('https://ex.com/s1.xml')
    expect(calls).toContain('https://ex.com/s2.xml')
    expect(sortedPageUrls(res.pages)).toEqual([
      'https://ex.com/',
      'https://ex.com/a',
      'https://ex.com/b',
    ])
  })
})

// --- crawlSite : BFS ----------------------------------------------------------------

describe('crawlSite — fallback BFS same-origin', () => {
  it('suit les liens same-origin et ignore les externes', async () => {
    const { fetchText } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null, // pas de sitemap -> BFS
      'https://ex.com/': page(['/about', 'https://external.com/x', '/about/']),
      'https://ex.com/about': page(['/team']),
      'https://ex.com/team': page([]),
    })
    const res = await crawlSite({ startUrl: 'https://ex.com/' }, baseDeps(fetchText))
    expect(res.stats.discovery).toBe('crawl')
    expect(sortedPageUrls(res.pages)).toEqual([
      'https://ex.com/',
      'https://ex.com/about',
      'https://ex.com/team',
    ])
  })

  it('déduplique les URLs (slash final, fragment, doublons)', async () => {
    const { fetchText, calls } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/about', '/about/', '/about#x', '/about']),
      'https://ex.com/about': page(['/']),
    })
    const res = await crawlSite({ startUrl: 'https://ex.com/' }, baseDeps(fetchText))
    expect(sortedPageUrls(res.pages)).toEqual(['https://ex.com/', 'https://ex.com/about'])
    // /about n'est fetché qu'une fois malgré ses 4 variantes de lien.
    expect(calls.filter((u) => u === 'https://ex.com/about')).toHaveLength(1)
  })

  it('respecte robots.txt (Disallow * ) en ignorant les chemins interdits', async () => {
    const { fetchText, calls } = makeFetch({
      'https://ex.com/robots.txt': 'User-agent: *\nDisallow: /private\n',
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/public', '/private']),
      'https://ex.com/public': page([]),
      'https://ex.com/private': page([]),
    })
    const res = await crawlSite({ startUrl: 'https://ex.com/' }, baseDeps(fetchText))
    expect(sortedPageUrls(res.pages)).toEqual(['https://ex.com/', 'https://ex.com/public'])
    expect(res.skipped).toContain('https://ex.com/private')
    expect(calls).not.toContain('https://ex.com/private')
  })

  it('respecte la profondeur maximale', async () => {
    const { fetchText, calls } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/a', '/b']),
      'https://ex.com/a': page(['/c']),
      'https://ex.com/b': page([]),
      'https://ex.com/c': page([]),
    })
    const res = await crawlSite(
      { startUrl: 'https://ex.com/', maxDepth: 1 },
      baseDeps(fetchText),
    )
    expect(sortedPageUrls(res.pages)).toEqual([
      'https://ex.com/',
      'https://ex.com/a',
      'https://ex.com/b',
    ])
    expect(calls).not.toContain('https://ex.com/c')
  })

  it('respecte le plafond de pages (maxPages)', async () => {
    const { fetchText } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/a', '/b', '/c', '/d']),
      'https://ex.com/a': page([]),
      'https://ex.com/b': page([]),
      'https://ex.com/c': page([]),
      'https://ex.com/d': page([]),
    })
    const res = await crawlSite(
      { startUrl: 'https://ex.com/', maxPages: 2 },
      baseDeps(fetchText),
    )
    expect(res.pages).toHaveLength(2)
    expect(res.stats.pageCount).toBe(2)
  })

  it('s’arrête proprement sur annulation (shouldStop)', async () => {
    let stop = false
    const { fetchText } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/a', '/b', '/c']),
      'https://ex.com/a': page([]),
      'https://ex.com/b': page([]),
      'https://ex.com/c': page([]),
    })
    const res = await crawlSite(
      { startUrl: 'https://ex.com/' },
      baseDeps(fetchText, {
        // Annule dès la première page convertie.
        onProgress: (p) => {
          if (p.done >= 1) stop = true
        },
        shouldStop: () => stop,
      }),
    )
    // Une seule page traitée avant l'annulation, et un document quand même produit.
    expect(res.pages).toHaveLength(1)
    expect(res.document).toContain('# ex.com — full site')
  })

  it('émet une progression et produit un document concaténé valide', async () => {
    const progresses: number[] = []
    const { fetchText } = makeFetch({
      'https://ex.com/robots.txt': null,
      'https://ex.com/sitemap.xml': null,
      'https://ex.com/': page(['/a']),
      'https://ex.com/a': page([]),
    })
    const res = await crawlSite(
      { startUrl: 'https://ex.com/' },
      baseDeps(fetchText, { onProgress: (p) => progresses.push(p.done) }),
    )
    expect(progresses.length).toBeGreaterThan(0)
    expect(res.document).toContain('## Table of contents')
    expect(res.stats.bytes).toBeGreaterThan(0)
  })
})

// --- Réutilisation du moteur Markdown sur un Document fetché -------------------------

describe('htmlDocumentToMarkdown (page fetchée via DOMParser)', () => {
  const html =
    '<!doctype html><html lang="en"><head><title>Doc Title</title>' +
    '<meta name="description" content="Desc"></head>' +
    '<body><h1>Heading</h1><p>Para with <a href="/rel">link</a>.</p>' +
    '<script>ignore()</script><style>.x{}</style></body></html>'
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const res = htmlDocumentToMarkdown(doc, 'https://ex.com/docs/page')

  it('réutilise le moteur et produit le frontmatter + le corps', () => {
    expect(res.frontmatter.title).toBe('Doc Title')
    expect(res.frontmatter.description).toBe('Desc')
    expect(res.markdown).toContain('# Heading')
  })

  it('résout les liens relatifs en absolu', () => {
    expect(res.markdown).toContain('https://ex.com/rel')
  })

  it('élimine le bruit (script/style)', () => {
    expect(res.markdown).not.toContain('ignore()')
    expect(res.markdown).not.toContain('.x{')
  })
})
