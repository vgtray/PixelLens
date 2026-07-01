// PixelLens — Fetch borné pour le crawl (timeout par requête + annulation)
//
// Extrait du content script pour être testable hors réseau. Chaque requête :
//   - a un timeout dur (un serveur muet ne doit pas figer le crawl à vie) ;
//   - écoute un signal d'annulation externe (Stop) pour couper le fetch EN VOL,
//     au lieu de n'agir qu'entre deux pages.
// Renvoie `null` sur timeout / annulation / erreur réseau / contenu non textuel :
// l'orchestrateur (lib/crawler) compte alors la page comme « skipped » et poursuit.

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
 * textuel (text/html/xml/json/plain). Renvoie `null` sur réponse non-OK, contenu
 * binaire, timeout, abort (Stop) ou erreur réseau — jamais de rejet propagé.
 */
export async function fetchTextWithTimeout(
  url: string,
  options: FetchTextOptions = {},
): Promise<string | null> {
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
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await doFetch(url, {
      credentials: 'same-origin',
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    // Évite le binaire : on ne lit que du texte/HTML/XML/JSON.
    if (ct && !/(text|html|xml|json|plain)/i.test(ct)) return null
    return await res.text()
  } catch {
    // Timeout, abort (Stop), erreur réseau, CORS… → page ignorée, crawl poursuivi.
    return null
  } finally {
    clearTimeout(timer)
    external?.removeEventListener('abort', onExternalAbort)
  }
}
