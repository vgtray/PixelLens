// PixelLens — Fetch borné pour le crawl (timeout par requête + annulation)
//
// Extrait du content script pour être testable hors réseau. Chaque requête :
//   - a un timeout dur (un serveur muet ne doit pas figer le crawl à vie) ;
//   - écoute un signal d'annulation externe (Stop) pour couper le fetch EN VOL,
//     au lieu de n'agir qu'entre deux pages.
// Renvoie un RÉSULTAT DISCRIMINÉ ({ ok:true, text } | { ok:false, reason }) au lieu
// d'un `null` opaque : le status HTTP réel (ex. 403 anti-bot), le timeout, le binaire
// et l'erreur réseau/CORS deviennent des RAISONS explicites. L'orchestrateur
// (lib/crawler) agrège ces raisons pour dire à l'utilisateur POURQUOI ça skippe.

import type { FetchTextResult } from '@/types/crawl'

/** Timeout par défaut d'une requête de crawl (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000

export interface FetchTextOptions {
  /** Implémentation de fetch (injectable pour les tests). Défaut : global. */
  fetch?: typeof fetch
  /** Timeout par requête, en ms. Défaut : DEFAULT_FETCH_TIMEOUT_MS. */
  timeoutMs?: number
  /** Signal d'annulation externe (Stop) — son abort() coupe la requête en vol. */
  signal?: AbortSignal
}

/**
 * Récupère le texte d'une URL avec timeout + annulation. Ne lit que du contenu
 * textuel (text/html/xml/json/plain). Ne rejette jamais : renvoie un résultat
 * discriminé — `{ ok:true, text }` en cas de succès, sinon `{ ok:false, reason }`
 * avec la raison réelle (`http-<status>`, `timeout`, `non-text`, `network`).
 */
export async function fetchTextWithTimeout(
  url: string,
  options: FetchTextOptions = {},
): Promise<FetchTextResult> {
  const doFetch = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS

  // Un contrôleur par requête agrège les deux sources d'annulation : le timeout
  // ET le signal externe (Stop). fetch reçoit son signal ; abort() le rejette.
  const controller = new AbortController()
  const external = options.signal
  const onExternalAbort = (): void => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onExternalAbort)
  }
  // Distingue un abort déclenché par le timeout (raison `timeout`) d'une autre
  // rupture (Stop externe / erreur réseau / CORS → raison `network`).
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const res = await doFetch(url, {
      credentials: 'same-origin',
      redirect: 'follow',
      signal: controller.signal,
    })
    // Status HTTP réel exposé comme raison (ex. `http-403` = anti-bot, `http-404`).
    if (!res.ok) return { ok: false, reason: `http-${res.status}` }
    const ct = res.headers.get('content-type') ?? ''
    // Évite le binaire : on ne lit que du texte/HTML/XML/JSON.
    if (ct && !/(text|html|xml|json|plain)/i.test(ct)) return { ok: false, reason: 'non-text' }
    return { ok: true, text: await res.text() }
  } catch {
    // Timeout → `timeout` ; abort (Stop) / erreur réseau / CORS → `network`.
    return { ok: false, reason: timedOut ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', onExternalAbort)
  }
}
