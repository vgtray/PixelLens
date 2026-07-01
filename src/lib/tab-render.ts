// PixelLens — Rendu d'une page dans un onglet réel (mode crawl "Full")
//
// POURQUOI : le mode Fast fetch le HTML initial du serveur. Sur une SPA (rendue 100% en
// JS), ce HTML est un shell quasi-vide → conversion `empty`. Le mode Full NAVIGUE
// réellement chaque page dans un onglet en arrière-plan : le navigateur exécute le JS,
// puis on capture le DOM RENDU (via EXTRACT_MARKDOWN, le même MarkdownExtractor que la
// vue Markdown). Bonus : c'est le navigateur de l'utilisateur → sa session/ses cookies
// passent les challenges JS passifs.
//
// OÙ : seul le service worker a chrome.tabs (le content script ne peut pas créer
// d'onglets). Ce module isole l'orchestration d'UNE page — tout l'I/O chrome.* est
// INJECTÉ via TabRenderDeps, ce qui rend le cycle create→wait→extract→close entièrement
// testable hors navigateur (mocks). Le service worker câble les vraies implémentations.
//
// GARANTIES : séquentiel (une page à la fois, piloté par le crawler), timeout dur global
// par page (un onglet qui ne charge/rend jamais ne fige pas le crawl), et nettoyage
// TOUJOURS effectué (finally) — aucun onglet orphelin, même sur timeout/erreur.

import type { MarkdownResult } from '@/types/markdown'
import type { RenderPageResponse } from '@/types/messages'

/** Délai (ms) après `complete` pour laisser le JS de la SPA finir de peindre le DOM. */
export const DEFAULT_RENDER_DELAY_MS = 1200
/** Timeout dur global par page (ms) : dépassé → outcome `timeout`, onglet fermé. */
export const DEFAULT_RENDER_TIMEOUT_MS = 20_000

/** I/O chrome.* injecté — permet de tester l'orchestration sans navigateur. */
export interface TabRenderDeps {
  /** Ouvre un onglet EN ARRIÈRE-PLAN (active:false) sur `url` ; résout avec son id. */
  createTab: (url: string) => Promise<number>
  /** Résout quand l'onglet a fini de charger ('complete') — ou quand il est fermé. */
  waitForComplete: (tabId: number) => Promise<void>
  /** Envoie EXTRACT_MARKDOWN au content script de l'onglet ; résout le MarkdownResult. */
  extractMarkdown: (tabId: number) => Promise<MarkdownResult | undefined>
  /** Collecte les liens absolus (href) du DOM RENDU de l'onglet (pour le BFS Full). */
  collectLinks: (tabId: number) => Promise<string[]>
  /** Ferme l'onglet. TOUJOURS appelé (même sur timeout/erreur) → pas d'orphelin. */
  removeTab: (tabId: number) => Promise<void>
  /** Délai après `complete` avant capture (défaut DEFAULT_RENDER_DELAY_MS). */
  renderDelayMs?: number
  /** Timeout dur global par page (défaut DEFAULT_RENDER_TIMEOUT_MS). */
  timeoutMs?: number
  /** Délai injectable (tests instantanés). */
  delay?: (ms: number) => Promise<void>
}

const realDelay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Rend UNE page dans un onglet arrière-plan et renvoie le Markdown de son DOM RENDU.
 *
 * Séquence : createTab (active:false) → waitForComplete → délai de rendu JS →
 * EXTRACT_MARKDOWN → collecte des liens → removeTab. L'onglet est créé EN PREMIER (op.
 * rapide) pour que son id soit toujours connu avant les étapes lentes : le finally peut
 * alors le fermer quoi qu'il arrive. Les étapes lentes courent contre un timeout dur
 * global ; ne rejette jamais (renvoie une raison discriminée).
 */
export async function renderPageInTab(
  url: string,
  deps: TabRenderDeps,
): Promise<RenderPageResponse> {
  const renderDelayMs = deps.renderDelayMs ?? DEFAULT_RENDER_DELAY_MS
  const timeoutMs = deps.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS
  const delay = deps.delay ?? realDelay

  let tabId: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // Onglet ouvert EN PREMIER : `tabId` est ainsi connu avant l'attente longue, donc le
    // finally sait toujours quel onglet fermer (aucun orphelin sur timeout/erreur).
    tabId = await deps.createTab(url)
    const id = tabId

    // Étapes lentes isolées + `.catch` de secours : si le timeout gagne la course, cette
    // promesse est ABANDONNÉE (l'onglet est déjà fermé par le finally) ; le catch évite
    // qu'un extract/collectLinks sur un onglet fermé ne finisse en rejection non gérée.
    const work: Promise<RenderPageResponse> = (async (): Promise<RenderPageResponse> => {
      await deps.waitForComplete(id)
      await delay(renderDelayMs) // laisse le JS de la SPA finir de peindre le DOM
      const markdown = await deps.extractMarkdown(id)
      if (!markdown) return { ok: false, reason: 'empty' }
      const links = await deps.collectLinks(id).catch((): string[] => [])
      return { ok: true, markdown, links }
    })().catch((): RenderPageResponse => ({ ok: false, reason: 'network' }))

    // Timeout dur global : un onglet qui ne charge/rend jamais ne doit pas figer le crawl.
    const timeout = new Promise<RenderPageResponse>((resolve) => {
      timer = setTimeout(() => resolve({ ok: false, reason: 'timeout' }), timeoutMs)
    })

    return await Promise.race([work, timeout])
  } catch {
    // createTab a échoué : aucun onglet ouvert (tabId undefined) → rien à fermer.
    return { ok: false, reason: 'network' }
  } finally {
    if (timer) clearTimeout(timer)
    // Nettoyage GARANTI : ferme l'onglet même sur timeout/erreur.
    if (tabId !== undefined) await deps.removeTab(tabId).catch(() => {})
  }
}
