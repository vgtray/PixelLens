// PixelLens — Crawl → multi-file ZIP export
//
// Alternative to the single concatenated .md document produced by the crawler:
// packages each crawled page as its own Markdown file plus a linking `index.md`,
// all bundled into a .zip via fflate. Purely additive — the single-file path in
// CrawlView is untouched. The page bodies come straight from `CrawlResult.pages`
// (already exposed by the crawler), so no crawler change is needed to zip them.

import { zipSync, strToU8 } from 'fflate'
import type { CrawlResult, CrawlPageResult } from '@/types/crawl'

/** Folder holding the individual page files inside the archive. */
const PAGES_DIR = 'pages'

/** Slugify a title into a filesystem-safe stem (mirrors the crawler's anchors). */
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

/** YAML double-quoted scalar: escape `\` and `"`, flatten newlines. */
function yamlString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim()
  return `"${escaped}"`
}

/** Per-page Markdown file: minimal frontmatter + title + URL + body. */
function pageFile(page: CrawlPageResult): string {
  const frontmatter = [
    '---',
    `title: ${yamlString(page.title || 'Untitled')}`,
    `url: ${yamlString(page.url)}`,
    `words: ${page.wordCount}`,
    '---',
  ].join('\n')
  return [frontmatter, '', `# ${page.title || 'Untitled'}`, '', `\`${page.url}\``, '', page.markdown.trim(), ''].join('\n')
}

/** `index.md`: global frontmatter + a table of contents linking each page file. */
function indexFile(result: CrawlResult, entries: { page: CrawlPageResult; path: string }[]): string {
  const { host, startUrl, stats, generatedAt } = result
  const frontmatter = [
    '---',
    `site: ${yamlString(host)}`,
    `url: ${yamlString(startUrl)}`,
    `crawledAt: ${yamlString(generatedAt)}`,
    `pages: ${entries.length}`,
    `skipped: ${stats.skippedCount}`,
    `discovery: ${yamlString(stats.discovery)}`,
    'generator: "PixelLens"',
    '---',
  ].join('\n')

  const header = [
    `# ${host} — full site`,
    '',
    `> ${entries.length} page${entries.length === 1 ? '' : 's'} crawled` +
      (stats.skippedCount > 0 ? ` · ${stats.skippedCount} skipped` : '') +
      ` · discovered via ${stats.discovery}`,
  ].join('\n')

  const toc = [
    '## Pages',
    '',
    ...entries.map((e, i) => `${i + 1}. [${e.page.title || 'Untitled'}](${e.path}) — ${e.page.url}`),
  ].join('\n')

  return [frontmatter, '', header, '', toc, ''].join('\n')
}

/**
 * Build the archive's file map: `index.md` at the root plus one
 * `pages/<slug>.md` per crawled page. Slugs are de-duplicated with a `-N`
 * suffix so no two pages collide on the same filename. Exposed (not just the
 * zipped bytes) so the structure can be asserted directly in tests.
 */
export function buildZipEntries(result: CrawlResult): Record<string, string> {
  const seen = new Map<string, number>()
  const entries = result.pages.map((page, i) => {
    const base = slugify(page.title) || `page-${i + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    const stem = count === 0 ? base : `${base}-${count}`
    return { page, path: `${PAGES_DIR}/${stem}.md` }
  })

  const files: Record<string, string> = { 'index.md': indexFile(result, entries) }
  for (const { page, path } of entries) files[path] = pageFile(page)
  return files
}

/** Zip the crawl result into `.zip` bytes: one Markdown file per page + index. */
export function buildCrawlZip(result: CrawlResult): Uint8Array {
  const files = buildZipEntries(result)
  const zippable: Record<string, Uint8Array> = {}
  for (const [path, content] of Object.entries(files)) zippable[path] = strToU8(content)
  return zipSync(zippable, { level: 6 })
}

/** A friendly `.zip` filename for a crawl result, e.g. `example.com-site.zip`. */
export function crawlZipFilename(result: CrawlResult): string {
  return `${result.host}-site.zip`
}

/** Build the zip and trigger a browser download (blob URL + transient anchor). */
export function downloadCrawlZip(result: CrawlResult): void {
  const bytes = buildCrawlZip(result)
  // Copy into a fresh ArrayBuffer-backed view so Blob gets a plain ArrayBuffer
  // (not fflate's possibly pooled/shared buffer).
  const blob = new Blob([bytes.slice()], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = crawlZipFilename(result)
  a.click()
  URL.revokeObjectURL(url)
}
