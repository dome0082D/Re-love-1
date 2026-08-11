// app/api/vetrina/preview/route.ts
// Riceve un link esterno e prova a leggerne titolo, descrizione e immagine
// reali.
//
// STRATEGIA:
// 0. Se il link è un accorciatore (amzn.eu, amzn.to...), lo risolviamo
//    PRIMA seguendo i redirect fino all'indirizzo vero e completo del
//    prodotto. Necessario perché questi accorciatori spesso mostrano una
//    schermata intermedia (scelta paese, cookie) che non ha metadati del
//    prodotto - leggere quella invece della pagina vera produce un
//    risultato "vuoto ma senza errori", esattamente il sintomo osservato.
// 1. Proviamo a leggere noi la pagina (risolta) direttamente.
// 2. Se il sito blocca la richiesta (es. Amazon riconosce le richieste da
//    datacenter come Vercel), ripieghiamo su microlink.io, che apre la
//    pagina con un vero browser headless.

import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface Anteprima {
  title: string | null
  description: string | null
  image: string | null
}

function estraiMetaTag(html: string, proprieta: string): string | null {
  const pattern1 = new RegExp(
    `<meta[^>]+property=["']${proprieta}["'][^>]+content=["']([^"']+)["']`,
    'i'
  )
  const pattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${proprieta}["']`,
    'i'
  )
  const match = html.match(pattern1) || html.match(pattern2)
  return match ? match[1] : null
}

function estraiTitoloFallback(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : null
}

function decodificaEntitaHtml(testo: string): string {
  return testo
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Se l'URL è un accorciatore Amazon (amzn.eu, amzn.to), lo risolve
 * seguendo i redirect fino all'indirizzo finale e completo. Per qualsiasi
 * altro sito restituisce l'URL originale invariato.
 */
async function risolviLinkAccorciato(parsedUrl: URL): Promise<URL> {
  const accorciatori = ['amzn.eu', 'amzn.to']
  const isAccorciato = accorciatori.some(d => parsedUrl.hostname === d || parsedUrl.hostname.endsWith('.' + d))

  if (!isAccorciato) return parsedUrl

  try {
    const res = await fetch(parsedUrl.toString(), {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    })
    // "res.url" e' l'indirizzo finale dopo tutti i redirect seguiti da fetch.
    if (res.url) {
      return new URL(res.url)
    }
    return parsedUrl
  } catch (err) {
    console.warn('[Vetrina/Preview] Impossibile risolvere il link accorciato, uso quello originale:', err)
    return parsedUrl
  }
}

async function provaLetturaDiretta(parsedUrl: URL): Promise<Anteprima | null> {
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

    if (!res.ok) return null

    const html = await res.text()
    const title = estraiMetaTag(html, 'og:title') || estraiTitoloFallback(html)
    const description = estraiMetaTag(html, 'og:description')
    let image = estraiMetaTag(html, 'og:image')

    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, parsedUrl.origin).toString()
      } catch {
        image = null
      }
    }

    if (!title && !image && !description) return null

    return {
      title: title ? decodificaEntitaHtml(title) : null,
      description: description ? decodificaEntitaHtml(description) : null,
      image,
    }
  } catch {
    return null
  }
}

async function provaViaMicrolink(parsedUrl: URL): Promise<Anteprima | null> {
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(parsedUrl.toString())}&headers.userAgent=${encodeURIComponent(USER_AGENT)}`,
      { headers: { Accept: 'application/json' } }
    )

    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 'success' || !data.data) return null

    const title: string | null = data.data.title || null
    const description: string | null = data.data.description || null
    const image: string | null = data.data.image?.url || data.data.screenshot?.url || null

    if (!title && !image && !description) return null
    return { title, description, image }
  } catch (err) {
    console.error('[Vetrina/Preview] Errore fallback microlink:', err)
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Indirizzo mancante.' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error('protocollo non valido')
      }
    } catch {
      return NextResponse.json({ error: 'Indirizzo non valido.' }, { status: 400 })
    }

    // Passo 0: risolvi eventuali link accorciati PRIMA di tutto, così sia
    // il tentativo diretto sia microlink lavorano sull'indirizzo vero e
    // completo del prodotto, non su una schermata intermedia.
    const urlRisolto = await risolviLinkAccorciato(parsedUrl)

    let risultato = await provaLetturaDiretta(urlRisolto)

    if (!risultato) {
      risultato = await provaViaMicrolink(urlRisolto)
    }

    if (!risultato) {
      return NextResponse.json(
        { error: "Non è stato possibile leggere un'anteprima da questo link. Compila i campi a mano." },
        { status: 200 }
      )
    }

    return NextResponse.json({
      title: risultato.title,
      description: risultato.description,
      image: risultato.image,
    })
  } catch (err) {
    console.error('[Vetrina/Preview] Errore:', err)
    return NextResponse.json(
      { error: "Errore durante il recupero dell'anteprima." },
      { status: 500 }
    )
  }
}