import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Converte un indirizzo scritto a mano ("Via Roma 12, Milano") nelle sue
// coordinate geografiche, che servono al Radar Zona e ai segnaposti sulla
// mappa.
//
// Usa Nominatim di OpenStreetMap: è lo STESSO servizio che già disegna le
// mappe dell'app, è gratuito e non richiede nessuna chiave da configurare.
//
// ⚠️ LIMITI D'USO DA CONOSCERE: le regole di OpenStreetMap consentono al
// massimo 1 richiesta al secondo e richiedono di identificarsi con un
// User-Agent riconoscibile (impostato qui sotto). Vanno benissimo per
// un'app dove ogni utente cerca un indirizzo ogni tanto, mentre NON
// basterebbero se un giorno l'app cercasse indirizzi in automatico e in
// massa. Se arriverai a quel punto, servirà passare a un servizio a
// pagamento (Google Geocoding, Mapbox) cambiando solo questo file.
export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json()

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json(
        { error: 'Scrivi un indirizzo più preciso (almeno via e città).' },
        { status: 400 }
      )
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', address.trim())
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '1')
    // Restringiamo all'Italia: evita che "Via Roma" restituisca una strada
    // in Argentina invece che quella dietro l'angolo.
    url.searchParams.set('countrycodes', 'it')

    const res = await fetch(url.toString(), {
      headers: {
        // Richiesto dalle regole d'uso di OpenStreetMap: senza, le
        // richieste vengono bloccate.
        'User-Agent': 'Re-love Marketplace (https://re-love.vercel.app)',
        'Accept-Language': 'it',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Il servizio mappe non risponde. Riprova tra poco.' },
        { status: 502 }
      )
    }

    const risultati = await res.json()

    if (!Array.isArray(risultati) || risultati.length === 0) {
      return NextResponse.json(
        { error: 'Indirizzo non trovato. Prova a scriverlo in modo diverso, es. "Via Roma 12, Milano".' },
        { status: 404 }
      )
    }

    const primo = risultati[0]
    const dettagli = primo.address || {}

    // Il nome del comune può arrivare sotto etichette diverse a seconda
    // che sia una città, un paese o una frazione: le proviamo in ordine.
    const citta =
      dettagli.city ||
      dettagli.town ||
      dettagli.village ||
      dettagli.municipality ||
      dettagli.county ||
      ''

    return NextResponse.json({
      latitude: Number(primo.lat),
      longitude: Number(primo.lon),
      city: citta,
      // L'indirizzo "ripulito e completo" come lo conosce OpenStreetMap:
      // utile da mostrare all'utente per confermare che sia quello giusto.
      displayName: primo.display_name || address,
    })
  } catch (err: any) {
    console.error('Errore geocodifica indirizzo:', err)
    return NextResponse.json(
      { error: 'Errore nel cercare l\'indirizzo. Controlla la connessione e riprova.' },
      { status: 500 }
    )
  }
}