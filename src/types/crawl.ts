// PixelLens — Site Crawl Types
//
// Contrat partagé entre l'orchestrateur de crawl (lib/crawler), le content script
// qui exécute les fetch same-origin, et l'UI (CrawlView) qui pilote et affiche.
// Le crawl convertit TOUTES les pages same-origin d'un site en UN seul document
// Markdown destiné à une IA.

/** Options de lancement d'un crawl. Bornes par défaut figées par le produit. */
export interface CrawlOptions {
  startUrl: string
  /** Plafond dur de pages converties (défaut 100). */
  maxPages?: number
  /** Profondeur BFS max depuis la page de départ (défaut 3). Ignoré en mode sitemap. */
  maxDepth?: number
  /** Délai poli entre deux requêtes réseau, en ms (défaut 150). */
  delayMs?: number
}

/** Progression émise pendant le crawl (relayée content → background → panel). */
export interface CrawlProgress {
  /** Pages effectivement converties jusqu'ici. */
  done: number
  /** Borne supérieure de pages à traiter (file découverte, plafonnée à maxPages). */
  total: number
  /** URL en cours de traitement. */
  currentUrl: string
  /** Pages ignorées (robots, erreur réseau, non-HTML). */
  skipped: number
}

/** Markdown d'une page convertie (corps seul, sans frontmatter par page). */
export interface CrawlPageResult {
  url: string
  title: string
  /** Corps GFM de la page (sans frontmatter). */
  markdown: string
  wordCount: number
}

/** Stratégie de découverte des URLs effectivement employée. */
export type CrawlDiscovery = 'sitemap' | 'crawl'

/** Statistiques globales d'un crawl terminé. */
export interface CrawlStats {
  pageCount: number
  skippedCount: number
  /** Taille du document concaténé, en octets (UTF-8). */
  bytes: number
  discovery: CrawlDiscovery
}

/** Résultat final d'un crawl : pages + document Markdown unique concaténé. */
export interface CrawlResult {
  origin: string
  host: string
  startUrl: string
  pages: CrawlPageResult[]
  /** URLs ignorées (robots / erreur / non-HTML). */
  skipped: string[]
  /** Le gros .md concaténé : frontmatter global + table des matières + sections par page. */
  document: string
  /** ISO 8601 — instant de fin de crawl. */
  generatedAt: string
  stats: CrawlStats
}
