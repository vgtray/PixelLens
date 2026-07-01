// PixelLens — Markdown Extractor (clone DOM live + nettoyage FULL + conversion)
//
// Mode FULL : on convertit TOUT le contenu sémantique de la page (nav/header/footer/aside
// inclus). On ne retire QUE le bruit non-contenu (scripts, styles, éléments cachés, etc.).
// Le DOM live n'est JAMAIS muté : tout le nettoyage opère sur un clone détaché.

import { htmlToMarkdown } from '@/lib/markdown'
import type { MarkdownPageContext } from '@/lib/markdown'
import type { MarkdownResult } from '@/types/markdown'

// Balises sans valeur de contenu pour une lecture Markdown par une IA.
const NOISE_SELECTOR = [
  'script',
  'style',
  'noscript',
  'template',
  'svg', // icônes/illustrations inline : non représentables en Markdown
  'iframe', // embeds / pub / tracking : ne produisent aucun Markdown utile
  'object',
  'embed',
].join(', ')

export class MarkdownExtractor {
  extract(): MarkdownResult {
    const clone = this.buildCleanClone()
    return htmlToMarkdown(clone, this.pageContext())
  }

  // --- Nettoyage --------------------------------------------------------------------

  private buildCleanClone(): HTMLElement {
    const source = (document.body ?? document.documentElement) as HTMLElement
    const clone = source.cloneNode(true) as HTMLElement

    // Correspondance live<->clone etablie sur le clone VIERGE (structures 1:1) ; sert a
    // inliner les shadow roots dans les bons noeuds clones, meme apres le retrait des
    // elements caches (un noeud retire reste une reference detachee, inlining alors no-op).
    const liveToClone = this.mapLiveToClone(source, clone)

    // Le clone est structurellement identique au live tant qu'on ne l'a pas modifié :
    // on détecte d'abord les éléments réellement cachés (computed style dispo sur le live
    // uniquement), puis on retire le bruit statique.
    this.removeHiddenElements(source, clone)

    // Web components : on inline le contenu des OPEN shadow roots dans le clone (cloneNode
    // ne clone PAS les shadow roots) pour que le markup des composants atteigne le Markdown.
    // Doit preceder le retrait du bruit/host pour que les scripts/styles internes au shadow
    // et la propre UI de PixelLens soient ensuite elimines comme le reste.
    this.inlineOpenShadowRoots(liveToClone)

    clone.querySelectorAll('#pixellens-host').forEach((n) => n.remove())
    clone.querySelectorAll(NOISE_SELECTOR).forEach((n) => n.remove())
    this.removeComments(clone)

    return clone
  }

  /**
   * Parcours synchronisé live↔clone (lecture seule) : collecte les noeuds du clone dont le
   * pendant live est caché (display:none / visibility:hidden / [hidden] / aria-hidden),
   * puis les retire. Aucune mutation du DOM live.
   */
  private removeHiddenElements(liveRoot: HTMLElement, cloneRoot: HTMLElement): void {
    const liveWalker = document.createTreeWalker(liveRoot, NodeFilter.SHOW_ELEMENT)
    const cloneWalker = document.createTreeWalker(cloneRoot, NodeFilter.SHOW_ELEMENT)
    const toRemove: Element[] = []

    let liveNode = liveWalker.nextNode()
    let cloneNode = cloneWalker.nextNode()
    while (liveNode && cloneNode) {
      if (this.isHidden(liveNode as Element)) {
        toRemove.push(cloneNode as Element)
      }
      liveNode = liveWalker.nextNode()
      cloneNode = cloneWalker.nextNode()
    }

    // Retrait après collecte : retirer un noeud déjà détaché (ancêtre supprimé) est un no-op.
    toRemove.forEach((n) => n.remove())
  }

  /**
   * Map live->clone construite par parcours synchronise du clone VIERGE (structures 1:1).
   * Reste exploitable apres mutation du clone : un noeud retire demeure une reference
   * detachee, et y inliner du contenu de shadow root est alors un no-op silencieux.
   */
  private mapLiveToClone(liveRoot: HTMLElement, cloneRoot: HTMLElement): Map<Element, Element> {
    const map = new Map<Element, Element>([[liveRoot, cloneRoot]])
    const liveWalker = document.createTreeWalker(liveRoot, NodeFilter.SHOW_ELEMENT)
    const cloneWalker = document.createTreeWalker(cloneRoot, NodeFilter.SHOW_ELEMENT)
    let liveNode = liveWalker.nextNode()
    let cloneNode = cloneWalker.nextNode()
    while (liveNode && cloneNode) {
      map.set(liveNode as Element, cloneNode as Element)
      liveNode = liveWalker.nextNode()
      cloneNode = cloneWalker.nextNode()
    }
    return map
  }

  /**
   * Inline le contenu des OPEN shadow roots dans le clone correspondant. Les CLOSED shadow
   * roots renvoient `null` sur `element.shadowRoot` : non capturables (limite par
   * conception). Lecture seule du DOM live ; seul le clone est mute.
   */
  private inlineOpenShadowRoots(liveToClone: Map<Element, Element>): void {
    liveToClone.forEach((cloneEl, liveEl) => {
      const shadow = liveEl.shadowRoot
      if (!shadow) return
      shadow.childNodes.forEach((child) => {
        cloneEl.appendChild(this.cloneWithShadow(child))
      })
    })
  }

  /**
   * Clone profond d'un noeud en expansant recursivement ses OPEN shadow roots, ce qui
   * couvre les web components imbriques dans le contenu d'un shadow root.
   */
  private cloneWithShadow(node: Node): Node {
    const clone = node.cloneNode(false)
    node.childNodes.forEach((child) => clone.appendChild(this.cloneWithShadow(child)))
    if (node.nodeType === Node.ELEMENT_NODE) {
      const shadow = (node as Element).shadowRoot
      if (shadow) {
        shadow.childNodes.forEach((child) => clone.appendChild(this.cloneWithShadow(child)))
      }
    }
    return clone
  }

  private isHidden(el: Element): boolean {
    if (el.hasAttribute('hidden')) return true
    if (el.getAttribute('aria-hidden') === 'true') return true
    const style = window.getComputedStyle(el)
    if (style.display === 'none') return true
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return true
    return false
  }

  private removeComments(root: HTMLElement): void {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
    const comments: Comment[] = []
    let node = walker.nextNode()
    while (node) {
      comments.push(node as Comment)
      node = walker.nextNode()
    }
    comments.forEach((c) => c.remove())
  }

  // --- Métadonnées ------------------------------------------------------------------

  private pageContext(): MarkdownPageContext {
    const meta = (selector: string): string | undefined =>
      document.querySelector(selector)?.getAttribute('content')?.trim() || undefined

    const ogTitle = meta('meta[property="og:title"]')
    const title = (document.title || ogTitle || '').trim() || 'Untitled'
    const description =
      meta('meta[name="description"]') || meta('meta[property="og:description"]')
    const siteName = meta('meta[property="og:site_name"]')
    const lang = document.documentElement.getAttribute('lang')?.trim() || undefined

    return {
      url: location.href,
      baseURI: document.baseURI,
      title,
      description,
      siteName,
      lang,
      capturedAt: new Date().toISOString(),
    }
  }
}
