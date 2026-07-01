import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchTextWithTimeout, DEFAULT_FETCH_TIMEOUT_MS } from '../crawl-fetch'

// Reponse minimale facon `Response` pour piloter ok / status / content-type / body.
function fakeResponse(body: string, ct = 'text/html', ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? ct : null) },
    text: () => Promise.resolve(body),
  } as unknown as Response
}

// fetch factice qui respecte le signal : rejette si (deja) aborte, sinon reste
// pendant jusqu'a l'abort -- reproduit un serveur muet / une requete en vol.
function hangingFetch() {
  return vi.fn<typeof fetch>((_input, init) => {
    const signal = init?.signal
    return new Promise<Response>((_resolve, reject) => {
      const fail = () => reject(new DOMException('Aborted', 'AbortError'))
      if (signal?.aborted) return fail()
      signal?.addEventListener('abort', fail, { once: true })
    })
  })
}

afterEach(() => {
  vi.useRealTimers()
})

describe('fetchTextWithTimeout', () => {
  it('renvoie { ok:true, text } sur une reponse OK et textuelle', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(fakeResponse('<html>hi</html>')))
    const res = await fetchTextWithTimeout('https://ex.com/', { fetch: fetchImpl })
    expect(res).toEqual({ ok: true, text: '<html>hi</html>' })
    // Le signal transmis a fetch n'a pas ete aborte sur un succes.
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(false)
  })

  it('renvoie la raison http-<status> reelle sur reponse non-OK (ex. anti-bot 403)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(fakeResponse('forbidden', 'text/html', false, 403)),
    )
    expect(await fetchTextWithTimeout('https://ex.com/', { fetch: fetchImpl })).toEqual({
      ok: false,
      reason: 'http-403',
    })
  })

  it('renvoie { ok:false, reason:non-text } sur contenu non textuel (binaire)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(fakeResponse(' ', 'image/png')))
    expect(await fetchTextWithTimeout('https://ex.com/', { fetch: fetchImpl })).toEqual({
      ok: false,
      reason: 'non-text',
    })
  })

  it('renvoie reason:timeout et aborte la requete au depassement du timeout (serveur muet)', async () => {
    vi.useFakeTimers()
    const fetchImpl = hangingFetch()
    const p = fetchTextWithTimeout('https://ex.com/', { fetch: fetchImpl, timeoutMs: 1000 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await p).toEqual({ ok: false, reason: 'timeout' })
    // Le fetch en vol a bien recu l'abort declenche par le timeout.
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })

  it('coupe le fetch en vol et renvoie reason:network quand le signal externe (Stop) est aborte', async () => {
    const external = new AbortController()
    const fetchImpl = hangingFetch()
    const p = fetchTextWithTimeout('https://ex.com/', {
      fetch: fetchImpl,
      signal: external.signal,
      // Timeout large : c'est bien l'abort externe qui doit interrompre.
      timeoutMs: 999_999,
    })
    external.abort()
    expect(await p).toEqual({ ok: false, reason: 'network' })
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true)
  })

  it('renvoie reason:network immediatement si le signal externe est deja aborte', async () => {
    const external = new AbortController()
    external.abort()
    const fetchImpl = hangingFetch()
    expect(
      await fetchTextWithTimeout('https://ex.com/', { fetch: fetchImpl, signal: external.signal }),
    ).toEqual({ ok: false, reason: 'network' })
  })

  it('expose un timeout par defaut de 15000 ms', () => {
    expect(DEFAULT_FETCH_TIMEOUT_MS).toBe(15_000)
  })
})
