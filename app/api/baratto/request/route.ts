// app/api/baratto/request/route.ts
//
// ============================================================================
// PROPOSTA DI BARATTO — passo 1 di 3.
//
// Flusso completo:
//   1. (qui)                A propone un baratto sull'oggetto di B e
//                           pre-autorizza 2,50 € (soldi congelati, non presi).
//   2. webhook Stripe       incassato l'ok della carta, la richiesta diventa
//                           visibile a B, che riceve una notifica.
//   3. /api/baratto/process B accetta (paga a sua volta 2,50 €, e a quel
//                           punto i 2,50 € di A vengono davvero prelevati)
//                           oppure rifiuta (la pre-autorizzazione di A viene
//                           annullata e i suoi soldi si sbloccano subito).
//
// ============================================================================
// COSA È STATO CORRETTO
//
// Questa route esisteva già ma non era raggiungibile da nessuna pagina del
// sito: il pulsante "Inizia Baratto" apriva semplicemente una chat. In più
// aveva due problemi seri:
//
//   - Prendeva "userA_id" dal corpo della richiesta e si fidava. Chiunque
//     poteva quindi creare richieste di baratto a nome di un altro utente.
//   - Creava un PaymentIntent "nudo", che richiede un modulo di pagamento
//     con carta costruito a mano nel sito. Tutto il resto di Re-love usa
//     Stripe Checkout (la pagina di pagamento ospitata da Stripe): qui si
//     allinea a quello, così i dati della carta non passano mai da noi.
//     La pre-autorizzazione resta identica grazie a capture_method manuale.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripeAccount'
import { verificaUtente } from '@/lib/serverAuth'
import { QUOTA_BARATTO_CENT, STATI_BARATTO } from '@/lib/baratto'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    // L'identità di chi propone viene dal token di sessione firmato, mai dal
    // corpo della richiesta.
    const proponente = await verificaUtente(req)
    if (!proponente) {
      return NextResponse.json({ error: 'Devi accedere per proporre un baratto.' }, { status: 401 })
    }

    const { itemId } = await req.json()
    if (!itemId) {
      return NextResponse.json({ error: 'Oggetto mancante.' }, { status: 400 })
    }

    const { data: oggetto, error: letturaErr } = await supabaseAdmin
      .from('announcements')
      .select('id, user_id, title, condition, quantity')
      .eq('id', itemId)
      .maybeSingle()

    if (letturaErr || !oggetto) {
      return NextResponse.json({ error: 'Oggetto non trovato.' }, { status: 404 })
    }
    if (oggetto.condition !== 'Baratto') {
      return NextResponse.json({ error: 'Questo oggetto non è offerto in baratto.' }, { status: 400 })
    }
    if (oggetto.user_id === proponente.id) {
      return NextResponse.json({ error: 'Non puoi barattare un tuo stesso oggetto.' }, { status: 400 })
    }
    if ((oggetto.quantity ?? 1) <= 0) {
      return NextResponse.json({ error: 'Questo oggetto non è più disponibile.' }, { status: 400 })
    }

    // Una sola richiesta per volta fra le stesse due persone sullo stesso
    // oggetto: senza questo controllo, premere due volte il pulsante creava
    // due pre-autorizzazioni da 2,50 € a carico dello stesso utente.
    const { data: giaEsistente } = await supabaseAdmin
      .from('baratti')
      .select('id, status')
      .eq('item_id', itemId)
      .eq('user_a_id', proponente.id)
      .in('status', [STATI_BARATTO.attesaPagamentoA, STATI_BARATTO.attesaRispostaB, STATI_BARATTO.attivo])
      .maybeSingle()

    if (giaEsistente) {
      return NextResponse.json({
        error: giaEsistente.status === STATI_BARATTO.attivo
          ? 'Hai già un baratto attivo su questo oggetto.'
          : 'Hai già una richiesta in corso su questo oggetto.',
        barattoId: giaEsistente.id,
      }, { status: 409 })
    }

    // La riga nasce PRIMA del pagamento, in stato di attesa: così il webhook
    // ha già qualcosa da aggiornare quando Stripe conferma, e non deve
    // inventarsi nulla a pagamento avvenuto.
    const { data: baratto, error: insertErr } = await supabaseAdmin
      .from('baratti')
      .insert([{
        item_id: itemId,
        user_a_id: proponente.id,
        user_b_id: oggetto.user_id,
        status: STATI_BARATTO.attesaPagamentoA,
      }])
      .select()
      .single()

    if (insertErr || !baratto) {
      console.error('[Baratto/Request] Errore creazione richiesta:', insertErr)
      return NextResponse.json({ error: 'Errore durante la creazione della richiesta.' }, { status: 500 })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Attivazione baratto - "${oggetto.title}"`,
            description: 'Quota di attivazione. Ti viene addebitata solo se l\'altra persona accetta lo scambio.',
          },
          unit_amount: QUOTA_BARATTO_CENT,
        },
        quantity: 1,
      }],
      // Pre-autorizzazione: i soldi vengono congelati sulla carta ma
      // prelevati solo quando (e se) l'altra persona accetta.
      payment_intent_data: { capture_method: 'manual' },
      metadata: {
        type: 'baratto_auth',
        barattoId: baratto.id,
        itemId,
        userA: proponente.id,
        userB: oggetto.user_id,
      },
      success_url: `${siteUrl}/baratti?inviata=true`,
      cancel_url: `${siteUrl}/announcement/${itemId}?baratto=annullato`,
    })

    if (!session.url) {
      // Niente pagamento avviato: togliamo la riga, altrimenti resterebbe una
      // richiesta fantasma bloccante per i tentativi successivi.
      await supabaseAdmin.from('baratti').delete().eq('id', baratto.id)
      return NextResponse.json({ error: "Errore nell'avvio del pagamento." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url, barattoId: baratto.id })
  } catch (err: unknown) {
    console.error('[Baratto/Request] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
