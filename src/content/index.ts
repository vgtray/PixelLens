// PixelLens — Content Script Entry Point

import { onMessage } from '@/lib/messaging'
import { MessageType } from '@/types/messages'
import type { CrawlDeps } from '@/lib/crawler'
import type { RenderPageResult } from '@/types/crawl'
import { ElementHighlighter } from './inspector/ElementHighlighter'
import { ElementSelector } from './inspector/ElementSelector'
import { DistanceMeasurer } from './inspector/DistanceMeasurer'
import { GridOverlay } from './inspector/GridOverlay'
import { PageScanner } from './scanner/PageScanner'
import { sendMessage } from '@/lib/messaging'

type ContentMode = 'off' | 'inspect' | 'measure' | 'grid'

let currentMode: ContentMode = 'off'
let highlighter: ElementHighlighter | null = null
let selector: ElementSelector | null = null
let measurer: DistanceMeasurer | null = null
let gridOverlay: GridOverlay | null = null
let scanner: PageScanner | null = null
let shadowHost: HTMLElement | null = null
let contentRoot: ShadowRoot | null = null

function ensureShadowDOM(): ShadowRoot {
  if (contentRoot) return contentRoot

  shadowHost = document.createElement('div')
  shadowHost.id = 'pixellens-host'
  shadowHost.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0; pointer-events: none;'
  document.documentElement.appendChild(shadowHost)

  contentRoot = shadowHost.attachShadow({ mode: 'open' })

  const style = document.createElement('style')
  style.textContent = getContentStyles()
  contentRoot.appendChild(style)

  return contentRoot
}

function setMode(mode: ContentMode) {
  // Cleanup previous mode
  if (currentMode === 'inspect') {
    highlighter?.destroy()
    selector?.destroy()
    highlighter = null
    selector = null
  } else if (currentMode === 'measure') {
    measurer?.destroy()
    measurer = null
  }

  currentMode = mode

  // Setup new mode
  if (mode === 'inspect') {
    highlighter = new ElementHighlighter(ensureShadowDOM())
    selector = new ElementSelector(ensureShadowDOM())
    highlighter.enable()
    selector.enable()
  } else if (mode === 'measure') {
    measurer = new DistanceMeasurer(ensureShadowDOM())
    measurer.enable()
  }

  updateToolbarMode(mode)
}

function updateToolbarMode(_mode: ContentMode) {
  // Toolbar will read this via a custom event
  document.dispatchEvent(new CustomEvent('pixellens:mode-change', { detail: { mode: _mode } }))
}

// --- Message listeners ---

onMessage(MessageType.TOGGLE_INSPECT, (payload) => {
  if (payload.active) {
    setMode('inspect')
  } else {
    setMode('off')
  }
})

onMessage(MessageType.TOGGLE_MEASURE, (payload) => {
  if (payload.active) {
    setMode('measure')
  } else {
    setMode('off')
  }
})

onMessage(MessageType.TOGGLE_GRID, (payload) => {
  if (!gridOverlay) {
    gridOverlay = new GridOverlay(ensureShadowDOM())
  }
  if (payload.visible) {
    gridOverlay.show(payload.size)
  } else {
    gridOverlay.hide()
  }
})

onMessage(MessageType.SCAN_PAGE, (_payload, _sender, _sendResponse) => {
  if (!scanner) {
    scanner = new PageScanner()
  }

  scanner
    .scan((progress, phase) => {
      sendMessage(MessageType.SCAN_PROGRESS, { progress, phase }).catch(() => {})
    })
    .then((designSystem) => {
      sendMessage(MessageType.SCAN_COMPLETE, { designSystem }).catch(() => {})
    })
    .catch((err) => {
      // Without this .catch a scanner rejection (broken page, extractor throwing)
      // never emitted SCAN_COMPLETE, leaving the panel stuck on the spinner forever.
      // Surface an explicit error state so it can drop the spinner and offer retry.
      console.debug('[PixelLens]', (err as Error).message)
      sendMessage(MessageType.SCAN_ERROR, undefined).catch(() => {})
    })

  // Return true to keep the message channel open for async response
  return true
})

onMessage(MessageType.EXTRACT_MARKDOWN, (_payload, _sender, sendResponse) => {
  // Lazy-load le moteur (turndown) uniquement à la demande — hors du bundle initial.
  import('./scanner/MarkdownExtractor')
    .then(({ MarkdownExtractor }) => {
      const extractor = new MarkdownExtractor()
      sendResponse(extractor.extract())
    })
    .catch((err) => console.debug('[PixelLens]', (err as Error).message))

  // Return true to keep the message channel open for async response
  return true
})

// --- Site crawl (CRAWL_SITE / STOP_CRAWL) ---
//
// Les fetch same-origin tournent ICI, dans le content script : il partage l'origine de
// la page, donc fetch() n'est pas soumis à CORS et ne réclame aucune host_permission.
// L'orchestration (BFS/sitemap, robots, bornes, dédup, annulation) vit dans lib/crawler ;
// on lui injecte le fetch réel et la conversion HTML→Markdown (htmlDocumentToMarkdown).
// Limite V1 : si l'utilisateur quitte/recharge l'onglet, ce script meurt et le crawl
// s'arrête (le panel restera alors sur la progression jusqu'à un nouveau lancement).
let crawlAborted = false
let crawlInProgress = false
// Aborts the in-flight fetch the instant Stop is pressed (STOP_CRAWL) or the
// per-request timeout fires. Previously `crawlAborted` was only read *between*
// pages, so Stop had no effect during a pending request and a hung server froze
// the whole crawl. This controller propagates the abort down to the live fetch.
let crawlStopController: AbortController | null = null

onMessage(MessageType.CRAWL_SITE, (options, _sender, sendResponse) => {
  // Ignore un second lancement tant qu'un crawl tourne (un seul à la fois par onglet).
  if (crawlInProgress) {
    sendResponse({ success: false })
    return
  }
  crawlInProgress = true
  crawlAborted = false
  crawlStopController = new AbortController()

  // Lazy-load : crawler + moteur Markdown (turndown) + fetch borné, hors du bundle
  // content initial.
  Promise.all([
    import('@/lib/crawler'),
    import('@/lib/markdown'),
    import('@/lib/crawl-fetch'),
  ])
    .then(async ([{ crawlSite }, { htmlDocumentToMarkdown }, { fetchTextWithTimeout }]) => {
      // Le content script fait autorité sur l'URL de départ : si le panel n'a pas pu
      // fournir tab.url, on prend location.href de la page courante.
      const startUrl = options.startUrl || location.href

      const deps: CrawlDeps = {
        // Chaque requête a un timeout dur ET écoute le signal d'annulation global :
        // Stop (STOP_CRAWL) abort() le fetch en vol, un timeout coupe un serveur muet.
        // Une page en échec (timeout/abort/erreur) renvoie null → comptée « skipped »,
        // le crawl continue. En mode Full, fetchText ne sert QUE à la découverte
        // (robots.txt / sitemap.xml, statiques et rendu-indépendants).
        fetchText: (url) =>
          fetchTextWithTimeout(url, { signal: crawlStopController?.signal }),
        convert: (html, url) => {
          try {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            const md = htmlDocumentToMarkdown(doc, url)
            const body = md.markdown.trim()
            if (!body) return null
            return {
              url,
              title: md.frontmatter.title,
              markdown: body,
              wordCount: md.frontmatter.wordCount,
            }
          } catch {
            return null
          }
        },
        onProgress: (progress) => {
          sendMessage(MessageType.CRAWL_PROGRESS, progress).catch(() => {})
        },
        shouldStop: () => crawlAborted,
      }

      // Mode Full : le CONTENU de chaque page vient d'une navigation réelle. Le content
      // script ne peut pas créer d'onglets → on délègue au service worker (RENDER_PAGE),
      // qui rend la page dans un onglet arrière-plan et renvoie le Markdown du DOM rendu.
      if (options.renderMode === 'full') {
        deps.renderPage = async (url): Promise<RenderPageResult> => {
          try {
            const res = await sendMessage(MessageType.RENDER_PAGE, { url })
            if (!res || !res.ok) {
              return { ok: false, reason: res ? res.reason : 'network' }
            }
            const body = res.markdown.markdown.trim()
            if (!body) return { ok: false, reason: 'empty' }
            return {
              ok: true,
              page: {
                url,
                title: res.markdown.frontmatter.title,
                markdown: body,
                wordCount: res.markdown.frontmatter.wordCount,
              },
              links: res.links,
            }
          } catch {
            return { ok: false, reason: 'network' }
          }
        }
      }

      const result = await crawlSite({ ...options, startUrl }, deps)
      sendMessage(MessageType.CRAWL_COMPLETE, { result }).catch(() => {})
    })
    .catch((err) => console.debug('[PixelLens]', (err as Error).message))
    .finally(() => {
      crawlInProgress = false
      crawlStopController = null
    })

  // Ack immédiat de la prise en charge ; les résultats arrivent via CRAWL_PROGRESS/COMPLETE.
  sendResponse({ success: true })
  return true
})

onMessage(MessageType.STOP_CRAWL, (_payload, _sender, sendResponse) => {
  crawlAborted = true
  // Interrompt immédiatement le fetch en cours (sinon Stop n'agit qu'entre deux
  // pages, et reste sans effet pendant une requête pendante).
  crawlStopController?.abort()
  sendResponse({ success: true })
})

// Liveness probe used by the service worker before forwarding a scan: lets it
// detect a tab where this content script was never (re)injected (e.g. tabs
// restored after a Chrome restart) and re-inject it before sending SCAN_PAGE.
onMessage(MessageType.PING, (_payload, _sender, sendResponse) => {
  sendResponse({ alive: true })
})

// Listen for mode changes dispatched from the toolbar UI (ContentApp)
document.addEventListener('pixellens:toolbar-mode-change', (e: Event) => {
  const detail = (e as CustomEvent).detail as { mode: ContentMode }
  setMode(detail.mode)
})

// --- Mount UI ---

function mountUI() {
  const root = ensureShadowDOM()

  // Create toolbar container
  const toolbarContainer = document.createElement('div')
  toolbarContainer.id = 'pixellens-toolbar-root'
  toolbarContainer.style.cssText = 'position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 2147483647; pointer-events: auto;'
  root.appendChild(toolbarContainer)

  // Dynamic import for React UI — loaded only when needed
  import('./ui/ContentApp').then(({ mountContentApp }) => {
    mountContentApp(toolbarContainer)
  })
}

// --- Inline critical styles for overlays (non-React) ---

function getContentStyles(): string {
  return `
    .pixellens-overlay-content {
      position: absolute;
      background: rgba(59, 130, 246, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483645;
    }
    .pixellens-overlay-padding {
      position: absolute;
      background: rgba(34, 197, 94, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483644;
    }
    .pixellens-overlay-margin {
      position: absolute;
      background: rgba(249, 115, 22, 0.15);
      pointer-events: none;
      transition: opacity 100ms ease-out;
      z-index: 2147483643;
    }
    .pixellens-badge {
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 2147483646;
    }
    .pixellens-pulse-ring {
      position: absolute;
      border: 2px solid #6366F1;
      border-radius: 4px;
      pointer-events: none;
      animation: pixellens-pulse 0.6s ease-out forwards;
      z-index: 2147483646;
    }
    @keyframes pixellens-pulse {
      0% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.08); }
    }
    .pixellens-measure-line {
      position: absolute;
      pointer-events: none;
      z-index: 2147483646;
    }
    .pixellens-measure-label {
      position: absolute;
      background: rgba(0, 0, 0, 0.85);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      z-index: 2147483647;
    }
    .pixellens-measure-outline {
      position: absolute;
      border: 1px dashed #6366F1;
      border-radius: 2px;
      pointer-events: none;
      z-index: 2147483644;
    }
    .pixellens-grid-canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 2147483640;
    }
    .pixellens-tooltip {
      position: fixed;
      background: rgba(12, 12, 14, 0.95);
      color: #EDEDEF;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 100ms ease-out;
    }
    .pixellens-tooltip.visible {
      opacity: 1;
    }
  `
}

// Auto-init
mountUI()
