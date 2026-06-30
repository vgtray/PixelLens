// PixelLens — HTML → Markdown (GFM) conversion engine
//
// Lib choisie : turndown 7.2.4 (publiée 2026-04-03, activement maintenue, 0 CVE HIGH/CRITICAL)
//   + @joplin/turndown-plugin-gfm 1.0.67 (2026-05-08) — fork GFM maintenu
//     (tables, strikethrough, task lists, highlighted code blocks).
// Le plugin officiel `turndown-plugin-gfm` (1.0.2) est figé depuis 2022 ; on retient le
// fork Joplin, plus frais. `defuddle` écarté : c'est un extracteur d'article (reader mode),
// incompatible avec le mode FULL voulu (on garde 100% du contenu sémantique).
// Build browser-friendly : turndown expose un champ `browser` qui mappe sa dépendance Node
// `@mixmark-io/domino` à `false` → en content script le DOM natif est utilisé.
// Vérifié 2026-06-30 via `npm audit` : AUCUNE vuln sur turndown / le plugin / domino.

import TurndownService from 'turndown'
import { gfm } from '@joplin/turndown-plugin-gfm'
import type { MarkdownFrontmatter, MarkdownResult, MarkdownStats } from '@/types/markdown'

/** Contexte d'une page nécessaire pour produire le frontmatter et résoudre les URLs. */
export interface MarkdownPageContext {
  url: string
  baseURI: string
  title: string
  description?: string
  siteName?: string
  lang?: string
  capturedAt?: string // ISO 8601 ; défaut = maintenant
}

/**
 * Convertit un élément DOM (déjà nettoyé : voir MarkdownExtractor) en Markdown GFM fidèle.
 * Résout les URLs relatives en absolues, génère un frontmatter YAML et calcule les stats.
 * Mutation : opère sur `root` (qui doit être un CLONE détaché, jamais le DOM live).
 */
export function htmlToMarkdown(root: HTMLElement, ctx: MarkdownPageContext): MarkdownResult {
  // 1. Liens en absolu sur le clone (les images sont gérées dans la règle turndown).
  resolveLinkUrls(root, ctx.baseURI)

  // 2. Stats calculées sur le contenu nettoyé AVANT conversion (turndown peut lire/altérer le noeud).
  const stats = computeStats(root)

  // 3. Conversion.
  const service = createTurndownService(ctx.baseURI)
  const markdown = normalizeMarkdown(service.turndown(root))

  // 4. Frontmatter + assemblage.
  const frontmatter: MarkdownFrontmatter = {
    title: ctx.title.trim() || 'Untitled',
    url: ctx.url,
    capturedAt: ctx.capturedAt ?? new Date().toISOString(),
    ...(ctx.description ? { description: ctx.description.trim() } : {}),
    ...(ctx.siteName ? { siteName: ctx.siteName.trim() } : {}),
    ...(ctx.lang ? { lang: ctx.lang.trim() } : {}),
    wordCount: countWords(markdown),
  }

  const yaml = renderFrontmatterYaml(frontmatter)
  const fullDocument = `---\n${yaml}\n---\n\n${markdown}`

  return { frontmatter, markdown, fullDocument, stats }
}

// --- Turndown setup -----------------------------------------------------------------

function createTurndownService(baseURI: string): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    fence: '```',
    emDelimiter: '_',
    strongDelimiter: '**',
    linkStyle: 'inlined',
  })

  // GFM : tables, strikethrough, task lists, highlighted code blocks.
  service.use(gfm)

  // Images : URLs absolues, jamais de base64/blob, fallback srcset, titre conservé.
  service.addRule('pixellensImage', {
    filter: 'img',
    replacement: (_content, node) => {
      const alt = (node.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim()
      const src = resolveImageSrc(node, baseURI)
      if (!src) return '' // placeholder / data: / blob: → on n'émet rien
      const titleAttr = node.getAttribute('title')
      const title = titleAttr ? ` "${titleAttr.replace(/"/g, '\\"')}"` : ''
      return `![${alt}](${src}${title})`
    },
  })

  return service
}

// --- URL resolution -----------------------------------------------------------------

// Protocoles d'URL dangereux : neutralises sur les liens (meme politique que les images
// data:/blob:). On compare apres avoir retire les caracteres de codepoint <= 0x20
// (espaces + controles ASCII) pour couvrir les contournements type tab/newline.
const DANGEROUS_HREF = /^(javascript|vbscript|data):/i

function resolveLinkUrls(root: HTMLElement, baseURI: string): void {
  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')
    if (!href) return
    // Defense-in-depth : on retire le href dangereux mais on conserve le texte du lien
    // (turndown rend alors un simple texte, plus aucun lien cliquable).
    const stripped = Array.from(href).filter((ch) => ch.charCodeAt(0) > 0x20).join('')
    if (DANGEROUS_HREF.test(stripped)) {
      a.removeAttribute('href')
      return
    }
    if (href.startsWith('#')) return // ancre interne : on laisse tel quel
    try {
      a.setAttribute('href', new URL(href, baseURI).href)
    } catch {
      // href non résolvable — laissé inchangé
    }
  })
}

function resolveImageSrc(node: Element, baseURI: string): string | null {
  let raw = node.getAttribute('src')?.trim()
  if (!raw) {
    const srcset = node.getAttribute('srcset')?.trim()
    if (srcset) raw = pickFromSrcset(srcset)
  }
  if (!raw || /^(data:|blob:)/i.test(raw)) return null
  try {
    const abs = new URL(raw, baseURI).href
    return /^(data:|blob:)/i.test(abs) ? null : abs
  } catch {
    return null
  }
}

/** "url1 1x, url2 2x" / "url1 320w, url2 640w" → dernière (plus haute densité) candidate. */
function pickFromSrcset(srcset: string): string | undefined {
  const parts = srcset
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length === 0) return undefined
  return parts[parts.length - 1].split(/\s+/)[0]
}

// --- Stats / word count -------------------------------------------------------------

function computeStats(root: HTMLElement): MarkdownStats {
  return {
    headings: root.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    links: root.querySelectorAll('a[href]').length,
    images: root.querySelectorAll('img').length,
    tables: root.querySelectorAll('table').length,
    codeBlocks: root.querySelectorAll('pre').length,
  }
}

function countWords(markdown: string): number {
  const text = markdown.trim()
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

// --- Frontmatter --------------------------------------------------------------------

function renderFrontmatterYaml(fm: MarkdownFrontmatter): string {
  const lines = [
    `title: ${yamlString(fm.title)}`,
    `url: ${yamlString(fm.url)}`,
    `capturedAt: ${yamlString(fm.capturedAt)}`,
  ]
  if (fm.description) lines.push(`description: ${yamlString(fm.description)}`)
  if (fm.siteName) lines.push(`siteName: ${yamlString(fm.siteName)}`)
  if (fm.lang) lines.push(`lang: ${yamlString(fm.lang)}`)
  lines.push(`wordCount: ${fm.wordCount}`)
  return lines.join('\n')
}

/** Scalaire YAML entre guillemets doubles : échappe \ et " et aplatit les sauts de ligne. */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  return `"${escaped}"`
}

// --- Markdown cleanup ---------------------------------------------------------------

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}
