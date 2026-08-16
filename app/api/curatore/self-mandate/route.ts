// app/api/curatore/self-mandate/route.ts
//
// ============================================================================
// REGOLA: un mandato NON va approvato se chi lo crea è anche il Proprietario.
//
// Il sistema "Curatore Locale" serve a far pubblicare a una persona (il
// Curatore) l'oggetto di un'ALTRA persona (il Proprietario): il QR e
// l'approvazione esistono proprio per raccogliere il consenso di quest'ultima.
// Quando le due persone coincidono - "l'oggetto è mio e lo pubblico io" -
// non c'è nessun consenso da chiedere: chiedere a qualcuno di approvare se
// stesso non protegge nessuno, aggiunge solo un passaggio che, tra l'altro,
// era pure impossibile da compiere (il QR va inquadrato con un secondo
// telefono, e /api/curatore/approve rifiuta esplicitamente chi approva un
// mandato di cui è anche il Curatore).
//
// Questa route crea quindi il mandato GIÀ attivo e pubblica l'annuncio
// subito, senza QR e senza approvazione.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { statoContoStripe } from '@/lib/stripeAccount'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere per pubblicare un oggetto.' }, { status: 401 })
    }

    const { title, description, price, condition, imageUrl, custodyType } = await req.json()

    if (!title || !price || Number(price) <= 0) {
      return NextResponse.json({ error: 'Servono almeno titolo e prezzo validi.' }, { status: 400 })
    }

    // Vale la stessa condizione delle vendite normali: si può mettere in
    // vendita solo se si è davvero in grado di incassare.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', utente.id)
      .maybeSingle()

    const statoConto = await statoContoStripe(profile?.stripe_account_id)
    if (!statoConto.pronto) {
      return NextResponse.json({
        error: statoConto.collegato
          ? 'Devi completare la configurazione del conto su Stripe prima di poter vendere.'
          : 'Devi prima configurare il tuo conto per ricevere pagamenti, dal tuo profilo.',
        requiresPayoutSetup: true,
      }, { status: 400 })
    }

    // L'annuncio viene creato come un annuncio NORMALE: senza curator_id,
    // owner_id e mandate_id. Non è una svista: quei campi servono a dividere
    // l'incasso fra due persone diverse (vedi app/api/orders/action), e qui
    // la persona è una sola. Lasciarli valorizzati farebbe partire due
    // bonifici Stripe verso lo stesso identico conto, uno dei quali di
    // importo potenzialmente nullo - un errore garantito al momento del
    // pagamento, per nessun beneficio.
    const { data: newAnnouncement, error: annError } = await supabaseAdmin
      .from('announcements')
      .insert([{
        user_id: utente.id,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        price: Number(price),
        condition: condition || 'Usato',
        image_url: imageUrl || null,
        quantity: 1,
      }])
      .select()
      .single()

    if (annError || !newAnnouncement) {
      console.error('[Curatore/SelfMandate] Errore creazione annuncio:', annError)
      return NextResponse.json({ error: "Errore durante la pubblicazione dell'annuncio." }, { status: 500 })
    }

    // Il mandato viene comunque registrato, già attivo, così l'oggetto
    // compare nell'elenco "I miei mandati" insieme agli altri e resta
    // revocabile dalla stessa schermata. Le percentuali sono 90/0 perché
    // l'intero ricavato (al netto del 10% ReLove) va a un'unica persona.
    const adesso = new Date().toISOString()
    const { data: mandate, error: mandateError } = await supabaseAdmin
      .from('curator_mandates')
      .insert([{
        curator_id: utente.id,
        owner_id: utente.id,
        announcement_id: newAnnouncement.id,
        custody_type: custodyType === 'in_custodia' ? 'in_custodia' : 'in_sede',
        owner_percentage: 90,
        curator_percentage: 0,
        status: 'attivo',
        approved_at: adesso,
        qr_token: crypto.randomUUID(),
        qr_expires_at: adesso, // già scaduto: per questo mandato non esiste un QR da scansionare
        draft_title: String(title).trim(),
        draft_description: description ? String(description).trim() : null,
        draft_price: Number(price),
        draft_condition: condition || 'Usato',
        draft_image_url: imageUrl || null,
      }])
      .select()
      .single()

    if (mandateError) {
      // L'annuncio è già pubblico e funzionante: non lo annulliamo per un
      // problema sulla riga di tracciamento, ma lo segnaliamo.
      console.error('[Curatore/SelfMandate] Annuncio creato ma mandato non registrato:', mandateError)
    }

    return NextResponse.json({
      ok: true,
      announcementId: newAnnouncement.id,
      mandateId: mandate?.id || null,
      senzaApprovazione: true,
    })
  } catch (err) {
    console.error('[Curatore/SelfMandate] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
