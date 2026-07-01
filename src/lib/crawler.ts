// PixelLens — Site Crawler (découverte sitemap/BFS + robots.txt + conversion Markdown)
//
// Convertit TOUTES les pages same-origin d'un site en UN document Markdown unique.
// ARCHITECTURE — où tournent les fetch :
//   Les fetch réseau s'exécutent dans le CONTENT SCRIPT de l'onglet courant (voir
//   src/content/index.ts). Un content script partage l'origine de la page : un
//   `fetch(url)` same-origin n'est donc PAS soumis à CORS et son corps est lisible,
//   le tout SANS host_permissions (au prix d'un arrêt si l'utilisateur quitte l'onglet
//   — limite V1 assumée, documentée dans l'UI). Un fetch côté service worker aurait
//   exigé une permission d'hôte (prompt). Pour V1 borné, le content script est plus
//   simple et suffisant.
//
// Ce module est PUR & sans dépendance au navigateur autre que DOMParser (présent en
// content script ET en jsdom) : tout l'I/O (fetch) et la conversion HTML→Markdown sont
// INJECTÉS via `CrawlDeps`, ce qui rend l'orchestration entièrement testable hors réseau.
//
// LIMITE CONNUE (V1) : rendu fetch-first. On parse le HTML initial renvoyé par le serveur.
// Les SPA rendues 100% côté client (JS) ne livrent que leur HTML de démarrage (souvent
// vide) — leur contenu réel n'est pas capturé. Mode onglet = V2 (non implémenté).

import type {
  CrawlDiscovery,
  CrawlOptions,
  CrawlPageResult,
  CrawlProgress,
  CrawlResult,
} from '@/types/crawl'

/** Bornes par défaut (figées par le produit). */
export const CRAWL_DEFAULTS = { maxPages: 100, maxDepth: 3, delayMs: 150 } as const

/** Nombre max de sous-sitemaps suivis depuis un sitemap index (garde-fou). */
const MAX_SUBSITEMAPS = 50

/** I/O et conversion injectés — permettent de tester l'orchestration sans réseau. */
export interface CrawlDeps {
  /** Récupère le texte d'une URL ; `null` si échec / non-OK / non-textuel. */
  fetchText: (url: string) => Promise<string | null>
  /** Convertit le HTML d'une page en Markdown ; `null` si rien d'exploitable. */
  convert: (html: string, url: string) => CrawlPageResult | null
  onProgress?: (progress: CrawlProgress) => void
  /** Annulation coopérative : interrogé avant chaque page. */
  shouldStop?: () => boolean
  /** Délai poli entre requêtes (injectable pour des tests instantanés). */
  delay?: (ms: number) => Promise<void>
}

const realDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

// --- URL helpers --------------------------------------------------------------------

/**
 * Normalise une URL pour la déduplication : retire le fragment (#…), supprime le
 * slash final (sauf racine) et le port par défaut. La query est conservée (elle
 * distingue des pages). Renvoie l'URL d'origine si non parsable.
 */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw)
    u.hash = ''
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '')
    }
    return u.href
  } catch {
    return raw
  }
}

/** Même origine STRICTE : protocole + host + port identiques. */
export function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

function pathWithQuery(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname + u.search
  } catch {
    return url
  }
}

function dedupePreserveOrder(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

// --- robots.txt ---------------------------------------------------------------------

/**
 * Extrait les règles `Disallow` du groupe `User-agent: *` d'un robots.txt.
 * Implémentation volontairement minimale (conforme au scope produit) : on agrège les
 * chemins interdits applicables à `*`. Les motifs `*` et `$` sont gérés via regex.
 */
export function parseRobots(text: string): string[] {
  const disallow: string[] = []
  let appliesToStar = false
  let inGroup = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === 'user-agent') {
      // Un nouvel en-tête user-agent après des règles démarre un nouveau groupe.
      if (inGroup) {
        appliesToStar = false
        inGroup = false
      }
      if (value === '*') appliesToStar = true
    } else if (field === 'disallow') {
      inGroup = true
      if (appliesToStar && value) disallow.push(value)
    } else if (field === 'allow') {
      inGroup = true
    }
  }
  return disallow
}

/** Convertit un motif robots (`*` joker, `$` ancre de fin) en RegExp ancrée au début. */
function robotsPatternToRegExp(pattern: string): RegExp {
  let body = ''
  for (const ch of pattern) {
    if (ch === '*') body += '.*'
    else if (ch === '$') body += '$'
    else body += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp('^' + body)
}

/** `true` si le chemin n'est interdit par aucune règle Disallow applicable à `*`. */
export function robotsAllows(path: string, disallow: string[]): boolean {
  return !disallow.some((rule) => robotsPatternToRegExp(rule).test(path))
}

// --- sitemap.xml --------------------------------------------------------------------

export interface ParsedSitemap {
  urls: string[]
  isIndex: boolean
}

/** Parse un sitemap (urlset → urls de pages, sitemapindex → urls de sous-sitemaps). */
export function parseSitemap(xml: string): ParsedSitemap {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) return { urls: [], isIndex: false }

  const sitemapLocs = Array.from(doc.querySelectorAll('sitemapindex > sitemap > loc'))
  if (sitemapLocs.length > 0) {
    return { urls: collectLocText(sitemapLocs), isIndex: true }
  }
  const urlLocs = Array.from(doc.querySelectorAll('urlset > url > loc'))
  return { urls: collectLocText(urlLocs), isIndex: false }
}

function collectLocText(nodes: Element[]): string[] {
  return nodes
    .map((n) => (n.textContent ?? '').trim())
    .filter(Boolean)
}

// --- Extraction de liens ------------------------------------------------------------

/** Liens absolus http(s) extraits d'un HTML, résolus contre `baseUrl`. */
export function extractLinks(html: string, baseUrl: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  doc.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href || href.startsWith('#')) return
    try {
      const abs = new URL(href, baseUrl)
      if (abs.protocol === 'http:' || abs.protocol === 'https:') out.push(abs.href)
    } catch {
      // href non résolvable — ignoré
    }
  })
  return out
}

// --- Document Markdown concaténé ----------------------------------------------------

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
}

/** Scalaire YAML entre guillemets : échappe \ et " et aplatit les sauts de ligne. */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  return `"${escaped}"`
}

interface BuildDocInput {
  host: string
  startUrl: string
  pages: CrawlPageResult[]
  skippedCount: number
  discovery: CrawlDiscovery
  generatedAt: string
}

/**
 * Assemble le document final : frontmatter global + titre + résumé + table des matières
 * (ancres) + une section par page (ancre HTML + titre + URL + markdown), séparées par `---`.
 */
export function buildSiteDocument(input: BuildDocInput): string {
  const { host, startUrl, pages, skippedCount, discovery, generatedAt } = input

  const frontmatter = [
    '---',
    `site: ${yamlString(host)}`,
    `url: ${yamlString(startUrl)}`,
    `crawledAt: ${yamlString(generatedAt)}`,
    `pages: ${pages.length}`,
    `skipped: ${skippedCount}`,
    `discovery: ${yamlString(discovery)}`,
    'generator: "PixelLens"',
    '---',
  ].join('\n')

  // Ancres uniques (dédup par suffixe -N) partagées entre TOC et sections.
  const seen = new Map<string, number>()
  const anchors = pages.map((p, i) => {
    const base = slugify(p.title) || `page-${i + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  })

  const toc = [
    '## Table of contents',
    '',
    ...pages.map((p, i) => `${i + 1}. [${p.title || 'Untitled'}](#${anchors[i]}) — ${p.url}`),
  ].join('\n')

  const sections = pages.map((p, i) => {
    return [
      `<a id="${anchors[i]}"></a>`,
      '',
      `## ${p.title || 'Untitled'}`,
      '',
      `\`${p.url}\``,
      '',
      p.markdown.trim(),
    ].join('\n')
  })

  const header = [
    `# ${host} — full site`,
    '',
    `> ${pages.length} page${pages.length === 1 ? '' : 's'} crawled` +
      (skippedCount > 0 ? ` · ${skippedCount} skipped` : '') +
      ` · discovered via ${discovery}`,
  ].join('\n')

  return [frontmatter, '', header, '', toc, '', '---', '', sections.join('\n\n---\n\n')].join('\n')
}

// --- Orchestration ------------------------------------------------------------------

/**
 * Crawl complet : robots.txt → découverte (sitemap d'abord, sinon BFS same-origin) →
 * conversion page par page → document concaténé. Respecte profondeur, plafond de pages,
 * délai poli, déduplication et annulation coopérative.
 */
export async function crawlSite(options: CrawlOptions, deps: CrawlDeps): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? CRAWL_DEFAULTS.maxPages
  const maxDepth = options.maxDepth ?? CRAWL_DEFAULTS.maxDepth
  const delayMs = options.delayMs ?? CRAWL_DEFAULTS.delayMs
  const onProgress = deps.onProgress ?? (() => {})
  const shouldStop = deps.shouldStop ?? (() => false)
  const delay = deps.delay ?? realDelay

  const startNorm = normalizeUrl(options.startUrl)
  const origin = safeOrigin(options.startUrl)
  const host = safeHost(options.startUrl)

  // robots.txt (best-effort : un échec n'interrompt pas le crawl, il autorise tout).
  const robotsTxt = await deps.fetchText(origin + '/robots.txt').catch(() => null)
  const disallow = robotsTxt ? parseRobots(robotsTxt) : []

  const pages: CrawlPageResult[] = []
  const skipped: string[] = []
  const visited = new Set<string>()
  const counters = { skipped: 0 }

  const emit = (currentUrl: string, total: number): void =>
    onProgress({ done: pages.length, total, currentUrl, skipped: counters.skipped })

  const skip = (url: string): void => {
    counters.skipped++
    skipped.push(url)
  }

  // Traite une URL : garde same-origin + robots, fetch, convert. Renvoie le HTML
  // (pour l'expansion de liens en BFS) ou null si la page a été ignorée.
  const processOne = async (url: string, total: number): Promise<string | null> => {
    if (!sameOrigin(url, origin)) {
      skip(url)
      return null
    }
    if (!robotsAllows(pathWithQuery(url), disallow)) {
      skip(url)
      return null
    }
    emit(url, total)
    const html = await deps.fetchText(url).catch(() => null)
    if (!html) {
      skip(url)
      return null
    }
    const page = deps.convert(html, url)
    if (!page || !page.markdown.trim()) {
      skip(url)
      return null
    }
    pages.push(page)
    emit(url, total)
    await delay(delayMs)
    return html
  }

  // --- Découverte : sitemap.xml d'abord ---
  let discovery: CrawlDiscovery = 'crawl'
  let sitemapSeeds: string[] = []
  const sitemapXml = await deps.fetchText(origin + '/sitemap.xml').catch(() => null)
  if (sitemapXml) {
    sitemapSeeds = await collectSitemapUrls(sitemapXml, origin, deps, maxPages, delay, delayMs)
    if (sitemapSeeds.length > 0) discovery = 'sitemap'
  }

  if (discovery === 'sitemap') {
    // File plate issue du sitemap (la page de départ d'abord), sans expansion de liens.
    const queue = dedupePreserveOrder([startNorm, ...sitemapSeeds.map(normalizeUrl)]).slice(
      0,
      maxPages,
    )
    const total = queue.length
    for (const url of queue) {
      if (shouldStop() || pages.length >= maxPages) break
      if (visited.has(url)) continue
      visited.add(url)
      await processOne(url, total)
    }
  } else {
    // BFS same-origin depuis la page courante, borné en profondeur et en pages.
    const queue: { url: string; depth: number }[] = [{ url: startNorm, depth: 0 }]
    while (queue.length > 0) {
      if (shouldStop() || pages.length >= maxPages) break
      const next = queue.shift()
      if (!next) break
      const { url, depth } = next
      if (visited.has(url)) continue
      visited.add(url)
      const total = Math.min(pages.length + queue.length + 1, maxPages)
      const html = await processOne(url, total)
      if (html && depth < maxDepth) {
        for (const link of extractLinks(html, url)) {
          const n = normalizeUrl(link)
          if (sameOrigin(n, origin) && !visited.has(n)) {
            queue.push({ url: n, depth: depth + 1 })
          }
        }
      }
    }
  }

  const generatedAt = new Date().toISOString()
  const document = buildSiteDocument({
    host,
    startUrl: options.startUrl,
    pages,
    skippedCount: skipped.length,
    discovery,
    generatedAt,
  })

  return {
    origin,
    host,
    startUrl: options.startUrl,
    pages,
    skipped,
    document,
    generatedAt,
    stats: {
      pageCount: pages.length,
      skippedCount: skipped.length,
      bytes: byteLength(document),
      discovery,
    },
  }
}

// Agrège les URLs d'un sitemap ; suit les sous-sitemaps d'un index (borné), filtre
// same-origin, normalise et déduplique, plafonné à maxPages.
async function collectSitemapUrls(
  xml: string,
  origin: string,
  deps: CrawlDeps,
  maxPages: number,
  delay: (ms: number) => Promise<void>,
  delayMs: number,
): Promise<string[]> {
  const parsed = parseSitemap(xml)
  const out: string[] = []

  const pushSameOrigin = (urls: string[]): void => {
    for (const u of urls) {
      if (sameOrigin(u, origin)) out.push(normalizeUrl(u))
      if (out.length >= maxPages) break
    }
  }

  if (!parsed.isIndex) {
    pushSameOrigin(parsed.urls)
    return dedupePreserveOrder(out).slice(0, maxPages)
  }

  // Sitemap index : on récupère les sous-sitemaps (bornés) et on fusionne leurs URLs.
  const subSitemaps = parsed.urls.filter((u) => sameOrigin(u, origin)).slice(0, MAX_SUBSITEMAPS)
  for (const sub of subSitemaps) {
    if (out.length >= maxPages) break
    const subXml = await deps.fetchText(sub).catch(() => null)
    if (subXml) pushSameOrigin(parseSitemap(subXml).urls)
    await delay(delayMs)
  }
  return dedupePreserveOrder(out).slice(0, maxPages)
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return ''
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function byteLength(str: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(str).length : str.length
}
