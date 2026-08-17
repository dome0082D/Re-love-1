// app/api/vetrina/preview/route.ts
//
// Riceve un link esterno e ne legge titolo, descrizione, immagine e PREZZO
// reali dalla pagina del prodotto.
//
// La logica di lettura vera e propria vive in lib/anteprimaLink.ts, perché
// serve identica anche a app/api/stripe/vetrina, che ricontrolla il prezzo
// al momento del salvataggio invece di fidarsi di quello arrivato dal
// browser. Tenerne una copia per route significherebbe che il secondo
// controllo smette di valere alla prima modifica fatta solo qui.

import { NextRequest, NextResponse } from 'next/server'
import { analizzaIndirizzo, leggiAnteprimaLink, isAccorciatore } from '@/lib/anteprimaLink'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    const parsedUrl = analizzaIndirizzo(url)
    if (!parsedUrl) {
      return NextResponse.json({ error: 'Indirizzo non valido.' }, { status: 400 })
    }

    const risultato = await leggiAnteprimaLink(parsedUrl)

    if (!risultato.title && !risultato.image && risultato.price === null) {
      // Messaggio diverso per i link accorciati: dire "usa l'indirizzo
      // completo" a chi ha incollato un amzn.to è l'unico consiglio utile,
      // ma va detto sapendo che quel link è accorciato - altrimenti sembra
      // un rimprovero senza senso a chi ha incollato proprio quello che
      // Amazon gli ha dato dal tasto Condividi.
      const accorciato = isAccorciatore(parsedUrl.hostname)
      return NextResponse.json(
        {
          error: accorciato
            ? "Non riesco ad aprire questo link abbreviato. Apri il prodotto su Amazon e copia l'indirizzo dalla barra del browser (quello lungo, con /dp/)."
            : "Non è stato possibile leggere questo link. Prova con l'indirizzo completo della pagina del prodotto.",
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      title: risultato.title,
      description: risultato.description,
      image: risultato.image,
      price: risultato.price,
      currency: risultato.currency,
      // null = la pagina non dichiara le spese in modo leggibile.
      // 0 = spedizione dichiarata gratuita: è un dato letto, non un dato mancante.
      shipping: risultato.shipping,
    })
  } catch (err) {
    console.error('[Vetrina/Preview] Errore:', err)
    return NextResponse.json(
      { error: "Errore durante il recupero dell'anteprima." },
      { status: 500 }
    )
  }
}
