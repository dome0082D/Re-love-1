// app/api/vetrina/preview/route.ts
// Riceve un link esterno e prova a leggerne titolo, descrizione e immagine
// reali.
//
// STRATEGIA A DUE LIVELLI:
// 1. Prima proviamo a leggere noi la pagina direttamente (veloce, nessuna
//    dipendenza esterna) - funziona per la maggior parte dei siti.
// 2. Se il sito blocca la richiesta (es. Amazon riconosce e respinge le
//    richieste provenienti da server/datacenter come Vercel), ripieghiamo
//    su microlink.io: un servizio pubblico che apre la pagina con un vero
//    browser headless, riuscendo a leggere anteprime anche dove il nostro
//    tentativo diretto viene bloccato. Nessuna chiave richiesta per il
//    volume di richieste di un sito come questo.
//
// NOTA: le spese di spedizione NON vengono recuperate qui - non esiste un
// modo affidabile per leggerle da una pagina prodotto (dipendono da
// indirizzo, metodo di consegna, soglie di spedizione gratuita, ecc.).
// Restano sempre da inserire a mano nel form.

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
  // I meta tag arrivano spesso con entità HTML codificate (&amp;, &#39;,
  // ecc.) - le più comuni le sistemiamo qui senza tirare in ballo una
  // libreria in più solo per questo.
  return testo
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
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
      `https://api.microlink.io/?url=${encodeURIComponent(parsedUrl.toString())}`,
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

    let risultato = await provaLetturaDiretta(parsedUrl)

    if (!risultato) {
      risultato = await provaViaMicrolink(parsedUrl)
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