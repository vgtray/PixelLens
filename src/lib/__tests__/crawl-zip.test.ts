import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildZipEntries, buildCrawlZip, crawlZipFilename } from '../crawl-zip'
import type { CrawlResult } from '@/types/crawl'

function makeResult(): CrawlResult {
  return {
    origin: 'https://ex.com',
    host: 'ex.com',
    startUrl: 'https://ex.com',
    pages: [
      { url: 'https://ex.com/a', title: 'Alpha', markdown: '# Alpha\n\nbody a', wordCount: 2 },
      // Same title as the first page -> slug must be de-duplicated.
      { url: 'https://ex.com/b', title: 'Alpha', markdown: 'body b', wordCount: 1 },
      // Empty title -> positional fallback slug.
      { url: 'https://ex.com/c', title: '', markdown: 'body c', wordCount: 1 },
    ],
    skipped: ['https://ex.com/private'],
    skippedReasons: { robots: 1 },
    document: 'IGNORED single-file document',
    generatedAt: '2026-07-01T00:00:00.000Z',
    stats: { pageCount: 3, skippedCount: 1, bytes: 100, discovery: 'crawl' },
  }
}

describe('buildZipEntries', () => {
  it('emits index.md plus one de-duplicated file per page', () => {
    const files = buildZipEntries(makeResult())
    const paths = Object.keys(files).sort()
    expect(paths).toEqual([
      'index.md',
      'pages/alpha-1.md',
      'pages/alpha.md',
      'pages/page-3.md',
    ])
  })

  it('links every page from index.md and carries global frontmatter', () => {
    const files = buildZipEntries(makeResult())
    const index = files['index.md']
    expect(index).toContain('site: "ex.com"')
    expect(index).toContain('pages: 3')
    expect(index).toContain('skipped: 1')
    expect(index).toContain('discovery: "crawl"')
    // Table of contents references the exact file paths + source URLs.
    expect(index).toContain('[Alpha](pages/alpha.md) — https://ex.com/a')
    expect(index).toContain('[Alpha](pages/alpha-1.md) — https://ex.com/b')
    expect(index).toContain('[Untitled](pages/page-3.md) — https://ex.com/c')
  })

  it('writes each page body with per-file frontmatter', () => {
    const files = buildZipEntries(makeResult())
    const alpha = files['pages/alpha.md']
    expect(alpha).toContain('title: "Alpha"')
    expect(alpha).toContain('url: "https://ex.com/a"')
    expect(alpha).toContain('body a')
    expect(files['pages/page-3.md']).toContain('body c')
  })
})

describe('buildCrawlZip', () => {
  it('produces a real zip that round-trips through unzip', () => {
    const result = makeResult()
    const bytes = buildCrawlZip(result)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)

    const unzipped = unzipSync(bytes)
    const decoded: Record<string, string> = {}
    for (const [path, data] of Object.entries(unzipped)) decoded[path] = strFromU8(data)

    const expected = buildZipEntries(result)
    expect(Object.keys(decoded).sort()).toEqual(Object.keys(expected).sort())
    expect(decoded['index.md']).toBe(expected['index.md'])
    expect(decoded['pages/alpha-1.md']).toBe(expected['pages/alpha-1.md'])
  })
})

describe('crawlZipFilename', () => {
  it('derives a friendly archive name from the host', () => {
    expect(crawlZipFilename(makeResult())).toBe('ex.com-site.zip')
  })
})
