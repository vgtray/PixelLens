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
  /**
   * Respecter robots.txt (défaut true). À false : on ne fetch pas robots.txt et on ne
   * filtre plus les chemins interdits. Justifié pour un usage HUMAIN (l'utilisateur
   * convertit des pages qu'il peut déjà voir dans sa session ; robots.txt vise les
   * crawlers d'indexation, pas cet outil manuel).
   */
  respectRobots?: boolean
  /**
   * Mode de rendu du crawl (défaut `fast`) :
   *  - `fast` : fetch du HTML initial renvoyé par le serveur (rapide, sans onglet). Les
   *    SPA rendues 100% en JS ne livrent qu'un shell vide → pages `empty`.
   *  - `full` : NAVIGATION réelle de chaque page dans un onglet en arrière-plan — le
   *    navigateur exécute le JS — puis capture du DOM RENDU. Plus lent, mais convertit
   *    les SPA (et réutilise la session/les cookies de l'utilisateur). Orchestré par le
   *    service worker (seul à avoir chrome.tabs), page par page.
   */
  renderMode?: 'fast' | 'full'
}

/**
 * Raison explicite d'une page ignorée. Rend la cause VISIBLE (au lieu d'un skip
 * anonyme) pour que l'utilisateur sache POURQUOI ça skippe :
 *  - `robots`       : bloqué par robots.txt (désactivable via `respectRobots`)
 *  - `http-<status>`: réponse non-OK (ex. `http-403` anti-bot, `http-404`)
 *  - `timeout`      : requête au-delà du timeout dur (serveur muet)
 *  - `non-text`     : content-type binaire (image, pdf…) — non converti
 *  - `cross-origin` : hors du site (autre domaine que la variante apex/www)
 *  - `network`      : fetch rejeté (erreur réseau, CORS, Stop en vol)
 *  - `empty`        : converti mais Markdown vide (page sans contenu exploitable)
 */
export type SkipReason =
  | 'robots'
  | `http-${number}`
  | 'timeout'
  | 'non-text'
  | 'cross-origin'
  | 'network'
  | 'empty'

/** Décompte des pages ignorées par raison (raisons absentes = 0). */
export type SkipReasonCounts = Partial<Record<SkipReason, number>>

/**
 * Résultat discriminé d'un fetch de crawl : texte lu, ou raison d'échec explicite.
 * Remplace l'ancien `string | null` qui écrasait toutes les causes (403/timeout/
 * binaire/CORS) en un seul `null` opaque — ce qui rendait tout skip invisible.
 */
export type FetchTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: SkipReason }

/** Progression émise pendant le crawl (relayée content → background → panel). */
export interface CrawlProgress {
  /** Pages effectivement converties jusqu'ici. */
  done: number
  /** Borne supérieure de pages à traiter (file découverte, plafonnée à maxPages). */
  total: number
  /** URL en cours de traitement. */
  currentUrl: string
  /** Pages ignorées (robots, erreur réseau, non-HTML…). */
  skipped: number
  /** Dernière raison de skip observée (feedback live ; absent si aucun skip encore). */
  lastSkipReason?: SkipReason
}

/** Markdown d'une page convertie (corps seul, sans frontmatter par page). */
export interface CrawlPageResult {
  url: string
  title: string
  /** Corps GFM de la page (sans frontmatter). */
  markdown: string
  wordCount: number
}

/**
 * Résultat du rendu d'UNE page en mode Full (navigation réelle dans un onglet). Injecté
 * dans le crawler via `CrawlDeps.renderPage`. Discriminé comme FetchTextResult :
 *  - succès : la page convertie (Markdown issu du DOM RENDU) + les liens absolus du DOM
 *    rendu (permettent au BFS de s'étendre quand il n'y a pas de sitemap) ;
 *  - échec  : une raison explicite (timeout, network, empty…) remontée au breakdown.
 */
export type RenderPageResult =
  | { ok: true; page: CrawlPageResult; links: string[] }
  | { ok: false; reason: SkipReason }

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
  /**
   * Décompte des pages ignorées PAR RAISON — c'est CE qui dit à l'utilisateur
   * pourquoi le crawl skippe (ex. `{ robots: 45, 'http-403': 3 }`). Toujours présent
   * (peut être vide `{}` si aucun skip).
   */
  skippedReasons: SkipReasonCounts
  /** Le gros .md concaténé : frontmatter global + table des matières + sections par page. */
  document: string
  /** ISO 8601 — instant de fin de crawl. */
  generatedAt: string
  stats: CrawlStats
}
