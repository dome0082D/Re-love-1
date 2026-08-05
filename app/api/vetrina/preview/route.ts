import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Recupera titolo e immagine di un link esterno leggendo i suoi tag Open
// Graph (gli stessi che usano WhatsApp/Facebook per mostrare l'anteprima di
// un link condiviso). REGOLA IMPORTANTE: questa route non legge e non
// restituisce MAI un prezzo - solo titolo, immagine e descrizione. Il
// prezzo di una voce di Vetrina Esterna deve venire sempre e solo da quello
// che l'utente scrive a mano nel modulo.
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Indirizzo mancante.' }, { status: 400 })
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Indirizzo non valido.' }, { status: 400 })
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Indirizzo non valido.' }, { status: 400 })
    }

    const res = await fetch(parsed.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RelovePreviewBot/1.0; +https://re-love-rouge.vercel.app)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: 'Impossibile leggere la pagina collegata.' }, { status: 502 })
    }

    const html = await res.text()

    const getMeta = (prop: string) => {
      const re1 = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i')
      const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${prop}["']`, 'i')
      const m = html.match(re1) || html.match(re2)
      return m ? m[1] : null
    }
    const getTitleTag = () => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      return m ? m[1].trim() : null
    }

    const rawTitle = getMeta('og:title') || getTitleTag() || ''
    const rawImage = getMeta('og:image') || ''
    const rawDescription = getMeta('og:description') || ''

    // Le immagini og:image sono spesso relative al dominio, non URL complete
    let image = rawImage
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, parsed.origin).toString()
      } catch {
        image = ''
      }
    }

    return NextResponse.json({
      title: decodeHtmlEntities(rawTitle).slice(0, 200),
      image,
      description: decodeHtmlEntities(rawDescription).slice(0, 300),
    })
  } catch (err: any) {
    console.error('Errore fetch anteprima link Vetrina:', err)
    return NextResponse.json({ error: "Impossibile recuperare l'anteprima del link. Puoi comunque compilare i campi a mano." }, { status: 500 })
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}