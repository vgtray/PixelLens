// PixelLens — Markdown Extraction Types
//
// Contrat partagé entre le moteur de conversion (content script) et l'UI consommatrice.

export interface MarkdownFrontmatter {
  title: string
  url: string
  capturedAt: string // ISO 8601
  description?: string
  siteName?: string
  lang?: string
  wordCount: number
}

export interface MarkdownStats {
  headings: number
  links: number
  images: number
  tables: number
  codeBlocks: number
}

export interface MarkdownResult {
  frontmatter: MarkdownFrontmatter
  markdown: string // corps GFM seul (SANS le frontmatter)
  fullDocument: string // frontmatter YAML + "\n\n" + markdown, prêt à enregistrer en .md
  stats: MarkdownStats
}
