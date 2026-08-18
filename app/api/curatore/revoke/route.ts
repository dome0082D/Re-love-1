// app/api/curatore/revoke/route.ts
// Il Proprietario revoca la delega. L'annuncio pubblico sparisce subito
// (viene cancellato) e il suo contenuto torna in "owner_drafts" - una
// bozza privata visibile solo al Proprietario, da cui potrà ripartire con
// un altro Curatore o pubblicarlo lui stesso in futuro.
//
// Gira sul server con la chiave di servizio: cancellare un annuncio
// pubblico è un'azione delicata che merita gli stessi controlli di
// sicurezza già usati per l'approvazione del mandato.
//
// ============================================================================
// COSA È STATO CORRETTO
//
// Questa route prendeva "ownerId" dal corpo della richiesta e lo confrontava
// con il proprietario del mandato. Ma nessuno verificava che chi chiamava
// FOSSE quell'utente: bastava scrivere nel corpo l'id giusto - e "owner_id"
// è una colonna leggibile di "announcements" - per far sparire l'annuncio di
// chiunque, senza nemmeno aver fatto accesso. Ora l'identità viene dal token
// di sessione firmato; l'"ownerId" del corpo non viene più letto.
//
// Lo staff può revocare comunque: serve per sbloccare le situazioni in cui il
// Proprietario non riesce a farlo da solo.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificaUtente } from '@/lib/pushServer'
import { verificaUtente } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    }

    const { mandateId } = await req.json()
    if (!mandateId) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }

    const { data: mandate, error: mandateError } = await supabaseAdmin
      .from('curator_mandates')
      .select('*')
      .eq('id', mandateId)
      .maybeSingle()

    if (mandateError || !mandate) {
      return NextResponse.json({ error: 'Mandato non trovato.' }, { status: 404 })
    }

    if (mandate.owner_id !== utente.id && !utente.isStaff) {
      return NextResponse.json({ error: 'Non sei il Proprietario di questo mandato.' }, { status: 403 })
    }
    const ownerId = mandate.owner_id

    if (mandate.status !== 'attivo') {
      return NextResponse.json({ error: 'Questo mandato non è più attivo.' }, { status: 400 })
    }

    // Protezione: se c'è una vendita in corso (pagata ma non ancora
    // confermata ricevuta) su questo annuncio, non permettiamo la revoca
    // in questo momento - l'oggetto sparirebbe mentre un compratore ha
    // già pagato per riceverlo, un pasticcio molto peggiore di aspettare
    // che l'ordine si concluda prima di poter revocare.
    if (mandate.announcement_id) {
      const { data: venditaInCorso } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('announcement_id', mandate.announcement_id)
        .in('status', ['held', 'Pagato', 'Spedito'])
        .limit(1)
        .maybeSingle()

      if (venditaInCorso) {
        return NextResponse.json({
          error: "C'è una vendita in corso su questo oggetto (già pagata, in attesa di consegna). Non puoi revocare finché l'ordine non si conclude o viene annullato dallo staff.",
        }, { status: 400 })
      }
    }

    // Leggiamo l'annuncio pubblico (se esiste ancora) per copiarne i dati
    // nella bozza privata prima di cancellarlo.
    let datiOggetto = {
      title: mandate.draft_title,
      description: mandate.draft_description,
      price: mandate.draft_price,
      condition: mandate.draft_condition,
      image_url: mandate.draft_image_url,
    }

    if (mandate.announcement_id) {
      const { data: annuncio } = await supabaseAdmin
        .from('announcements')
        .select('title, description, price, condition, image_url')
        .eq('id', mandate.announcement_id)
        .single()
      if (annuncio) {
        datiOggetto = annuncio
      }
    }

    const { error: draftError } = await supabaseAdmin
      .from('owner_drafts')
      .insert([{
        owner_id: ownerId,
        title: datiOggetto.title,
        description: datiOggetto.description,
        price: datiOggetto.price,
        condition: datiOggetto.condition,
        image_url: datiOggetto.image_url,
        previous_mandate_id: mandate.id,
      }])

    if (draftError) {
      console.error('[Curatore/Revoke] Errore creazione bozza:', draftError)
      return NextResponse.json({ error: 'Errore durante il salvataggio della bozza.' }, { status: 500 })
    }

    // Cancella l'annuncio pubblico - sparisce subito da Home, ricerca,
    // profilo del Curatore, ovunque, perché semplicemente non esiste più.
    if (mandate.announcement_id) {
      await supabaseAdmin.from('announcements').delete().eq('id', mandate.announcement_id)
    }

    await supabaseAdmin
      .from('curator_mandates')
      .update({ status: 'revocato', revoked_at: new Date().toISOString() })
      .eq('id', mandate.id)

    // La notifica in-app funzionava gia' (chiave di servizio), ma la push
    // non partiva: nessuno la mandava. Ora entrambe, in una sola chiamata.
    await notificaUtente(
      mandate.curator_id,
      `⚠️ Il Proprietario ha revocato la delega per "${datiOggetto.title}". L'annuncio non è più pubblico.`,
      'Delega revocata ⚠️',
      '/curatore',
      true // il Curatore perde un annuncio che gestiva: va avvisato davvero
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Curatore/Revoke] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}