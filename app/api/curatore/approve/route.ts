// app/api/curatore/approve/route.ts
// Endpoint che gestisce l'APPROVAZIONE (o il rifiuto) di un mandato di
// delega da parte del Proprietario, dopo che ha scansionato il QR
// generato dal Curatore.
//
// Gira sul server con la chiave di servizio di proposito: è il momento
// esatto in cui "owner_id" viene assegnato per la prima volta a un
// mandato - un'operazione delicata che non vogliamo lasciare a una
// scrittura diretta dal browser.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const { qrToken, ownerId, azione } = await req.json()

    if (!qrToken || !ownerId || !azione) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }
    if (azione !== 'approva' && azione !== 'rifiuta') {
      return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 })
    }

    const { data: mandate, error: mandateError } = await supabaseAdmin
      .from('curator_mandates')
      .select('*')
      .eq('qr_token', qrToken)
      .single()

    if (mandateError || !mandate) {
      return NextResponse.json({ error: 'Codice QR non riconosciuto.' }, { status: 404 })
    }

    if (mandate.status !== 'in_attesa_qr') {
      return NextResponse.json({ error: 'Questo mandato è già stato approvato, rifiutato o non è più valido.' }, { status: 400 })
    }

    if (new Date(mandate.qr_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Questo QR è scaduto. Chiedi al Curatore di generarne uno nuovo.' }, { status: 400 })
    }

    // Il Proprietario non può approvare un mandato per un oggetto proprio
    // pubblicato da se stesso come "Curatore" (non avrebbe senso).
    if (mandate.curator_id === ownerId) {
      return NextResponse.json({ error: 'Non puoi approvare un tuo stesso mandato.' }, { status: 400 })
    }

    if (azione === 'rifiuta') {
      const { error: updateError } = await supabaseAdmin
        .from('curator_mandates')
        .update({ status: 'revocato', revoked_at: new Date().toISOString() })
        .eq('id', mandate.id)

      if (updateError) {
        return NextResponse.json({ error: 'Errore durante il rifiuto.' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, rifiutato: true })
    }

    // azione === 'approva' da qui in poi.

    // Verifica dei requisiti di incasso: il Proprietario deve avere un
    // conto pronto a ricevere pagamenti PRIMA di poter approvare un
    // mandato che prevede una divisione di denaro - stessa richiesta
    // fatta al Curatore quando crea il mandato, riusa lo stesso campo
    // già in uso per le vendite normali (stripe_account_id), senza
    // costruire un sistema di verifica identità nuovo da zero.
    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', ownerId)
      .single()

    if (!ownerProfile?.stripe_account_id) {
      return NextResponse.json({
        error: 'Prima di approvare un mandato devi configurare il tuo conto per ricevere pagamenti, dal tuo profilo.',
        requiresPayoutSetup: true,
      }, { status: 400 })
    }

    // Crea l'annuncio pubblico vero e proprio, copiando i dati della
    // bozza inserita dal Curatore. NOTA: "user_id" resta il Curatore -
    // così tutto il resto del sito (modifica annuncio, chat come
    // mittente, dashboard "i miei annunci") continua a funzionare senza
    // bisogno di essere riscritto: il Curatore è a tutti gli effetti chi
    // "gestisce" l'annuncio, il Proprietario è tracciato separatamente
    // in "owner_id" per la divisione dei pagamenti e la revoca.
    const { data: newAnnouncement, error: annError } = await supabaseAdmin
      .from('announcements')
      .insert([{
        user_id: mandate.curator_id,
        title: mandate.draft_title,
        description: mandate.draft_description,
        price: mandate.draft_price,
        condition: mandate.draft_condition,
        image_url: mandate.draft_image_url,
        quantity: 1,
        curator_id: mandate.curator_id,
        owner_id: ownerId,
        mandate_id: mandate.id,
      }])
      .select()
      .single()

    if (annError || !newAnnouncement) {
      console.error('[Curatore/Approve] Errore creazione annuncio:', annError)
      return NextResponse.json({ error: "Errore durante la pubblicazione dell'annuncio." }, { status: 500 })
    }

    const { error: mandateUpdateError } = await supabaseAdmin
      .from('curator_mandates')
      .update({
        status: 'attivo',
        owner_id: ownerId,
        announcement_id: newAnnouncement.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', mandate.id)

    if (mandateUpdateError) {
      console.error('[Curatore/Approve] Errore aggiornamento mandato:', mandateUpdateError)
      // L'annuncio è comunque stato creato - non blocchiamo la risposta
      // per questo, ma lo segnaliamo chiaramente per un controllo manuale.
    }

    // Notifica in-app al Curatore: il Proprietario ha approvato, l'oggetto
    // è ora pubblico e gestibile.
    await supabaseAdmin.from('notifications').insert([{
      user_id: mandate.curator_id,
      message: `✅ Il Proprietario ha approvato il mandato per "${mandate.draft_title}". L'annuncio è ora pubblico.`,
      is_read: false,
    }])

    return NextResponse.json({ ok: true, announcementId: newAnnouncement.id })
  } catch (err) {
    console.error('[Curatore/Approve] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}