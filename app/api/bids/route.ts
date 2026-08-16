// app/api/bids/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — i rilanci d'asta non venivano mai registrati.
//
// Due difetti sovrapposti nella pagina annuncio:
//
//  1. La colonna scritta era "amount", ma nella tabella si chiama
//     "bid_amount": il database rispondeva 400 (colonna inesistente).
//  2. Anche con il nome giusto, la RLS rifiuta l'inserimento dal browser:
//     INSERT bids -> 403, "new row violates row-level security policy".
//
// L'insert era scritta senza controllare l'errore, quindi non se ne
// accorgeva nessuno: il prezzo dell'asta (campo "current_bid" sull'annuncio)
// veniva aggiornato, ma lo STORICO dei rilanci restava vuoto. Impossibile
// sapere chi avesse rilanciato, e quindi chi avesse vinto l'asta.
//
// Qui il rilancio viene registrato con la chiave di servizio, dopo aver
// verificato chi lo sta facendo e che l'importo sia davvero superiore
// all'offerta corrente (letta dal database, non dal browser).
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere per rilanciare.' }, { status: 401 })
    }

    const { announcementId, importo } = await req.json()
    const cifra = Number(importo)

    if (!announcementId || !isFinite(cifra) || cifra <= 0) {
      return NextResponse.json({ error: 'Dati del rilancio non validi.' }, { status: 400 })
    }

    const { data: annuncio, error: letturaErr } = await supabaseAdmin
      .from('announcements')
      .select('id, user_id, price, current_bid, is_auction, auction_end')
      .eq('id', announcementId)
      .maybeSingle()

    if (letturaErr || !annuncio) {
      return NextResponse.json({ error: 'Annuncio non trovato.' }, { status: 404 })
    }
    if (!annuncio.is_auction) {
      return NextResponse.json({ error: 'Questo annuncio non è un\'asta.' }, { status: 400 })
    }
    if (annuncio.user_id === utente.id) {
      return NextResponse.json({ error: 'Non puoi rilanciare sulla tua stessa asta.' }, { status: 400 })
    }
    if (annuncio.auction_end && new Date(annuncio.auction_end) < new Date()) {
      return NextResponse.json({ error: 'Questa asta è già scaduta.' }, { status: 400 })
    }

    // La soglia viene dal database, non da quello che dichiara il browser.
    const soglia = Number(annuncio.current_bid ?? annuncio.price ?? 0)
    if (cifra <= soglia) {
      return NextResponse.json(
        { error: `Devi rilanciare con una cifra maggiore di €${soglia.toFixed(2)}.`, offertaAttuale: soglia },
        { status: 400 }
      )
    }

    // Aggiornamento condizionato: se nel frattempo qualcun altro ha
    // rilanciato più in alto, questa update non tocca nessuna riga e il
    // rilancio viene rifiutato invece di sovrascrivere l'offerta migliore.
    const { data: aggiornati, error: updateErr } = await supabaseAdmin
      .from('announcements')
      .update({ current_bid: cifra })
      .eq('id', announcementId)
      .lt('current_bid', cifra)
      .select('id, current_bid')

    if (updateErr) {
      console.error('[Bids] Errore aggiornamento offerta:', updateErr)
      return NextResponse.json({ error: 'Errore durante il rilancio.' }, { status: 500 })
    }
    if (!aggiornati || aggiornati.length === 0) {
      return NextResponse.json(
        { error: 'Qualcuno ha rilanciato prima di te. Ricarica e riprova con una cifra più alta.' },
        { status: 409 }
      )
    }

    const { error: insertErr } = await supabaseAdmin
      .from('bids')
      .insert([{ announcement_id: announcementId, bidder_id: utente.id, bid_amount: cifra }])

    if (insertErr) {
      // L'offerta è già stata accettata: segnaliamo, ma non annulliamo.
      console.error('[Bids] Offerta accettata ma storico non registrato:', insertErr)
    }

    return NextResponse.json({ ok: true, offertaAttuale: cifra, storicoRegistrato: !insertErr })
  } catch (err) {
    console.error('[Bids] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
