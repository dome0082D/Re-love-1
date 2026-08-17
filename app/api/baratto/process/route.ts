// app/api/baratto/process/route.ts
//
// ============================================================================
// PROPOSTA DI BARATTO — passo 3 di 3: la risposta di B.
//
//   accetta  -> B va a pagare la sua quota di 2,50 €. Solo quando quel
//               pagamento riesce (vedi webhook) i 2,50 € pre-autorizzati di A
//               vengono davvero prelevati e lo scambio si apre.
//   rifiuta  -> la pre-autorizzazione di A viene annullata: i suoi soldi si
//               sbloccano subito, senza che gli venga addebitato nulla.
//
// ============================================================================
// COSA È STATO CORRETTO
//
// La versione precedente non verificava CHI stesse rispondendo: bastava
// conoscere (o indovinare) l'id di un baratto per accettarlo o rifiutarlo al
// posto di un altro utente - e "accetta" fa scattare un prelievo di denaro
// vero. Ora chi risponde deve essere il destinatario della proposta, e
// l'identità viene dal token di sessione firmato.
//
// Inoltre l'incasso della quota di A avveniva subito dentro "accept", prima
// ancora che B avesse pagato la sua: se il pagamento di B falliva, ad A erano
// già stati presi i soldi per uno scambio mai avviato. Ora la cattura
// avviene solo a pagamento di B riuscito.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripeAccount'
import { verificaUtente } from '@/lib/serverAuth'
import { notificaUtente } from '@/lib/pushServer'
import { QUOTA_BARATTO_CENT, STATI_BARATTO } from '@/lib/baratto'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    }

    const { baratto_id, action } = await req.json()
    if (!baratto_id || (action !== 'accept' && action !== 'reject')) {
      return NextResponse.json({ error: 'Dati mancanti o azione non valida.' }, { status: 400 })
    }

    const { data: baratto, error: dbError } = await supabaseAdmin
      .from('baratti')
      .select('*')
      .eq('id', baratto_id)
      .maybeSingle()

    if (dbError || !baratto) {
      return NextResponse.json({ error: 'Richiesta di baratto non trovata.' }, { status: 404 })
    }

    // Solo il destinatario della proposta può accettarla o rifiutarla.
    if (baratto.user_b_id !== utente.id) {
      return NextResponse.json(
        { error: 'Solo chi ha ricevuto la proposta può rispondere.' },
        { status: 403 }
      )
    }

    if (baratto.status !== STATI_BARATTO.attesaRispostaB) {
      return NextResponse.json({
        error: baratto.status === STATI_BARATTO.attesaPagamentoA
          ? "Chi ha proposto lo scambio non ha ancora completato l'attivazione."
          : 'Questa richiesta è già stata gestita.',
      }, { status: 400 })
    }

    const { data: oggetto } = await supabaseAdmin
      .from('announcements')
      .select('id, title')
      .eq('id', baratto.item_id)
      .maybeSingle()

    const titoloOggetto = oggetto?.title || 'oggetto'

    // ---------------------------------------------------------------- RIFIUTO
    if (action === 'reject') {
      if (baratto.stripe_pi_user_a) {
        try {
          await getStripe().paymentIntents.cancel(baratto.stripe_pi_user_a)
        } catch (errStripe) {
          // Se era già annullato o scaduto va benissimo lo stesso: l'importante
          // è che ad A non venga addebitato nulla, e in questo caso non lo è.
          console.warn('[Baratto/Process] Annullamento pre-autorizzazione non riuscito:', errStripe)
        }
      }

      await supabaseAdmin.from('baratti').update({ status: STATI_BARATTO.rifiutato }).eq('id', baratto_id)

      await notificaUtente(
        baratto.user_a_id,
        `La tua proposta di baratto per "${titoloOggetto}" è stata rifiutata. Non ti è stato addebitato nulla.`,
        'Proposta rifiutata',
        '/baratti'
      )

      return NextResponse.json({ ok: true, rifiutato: true })
    }

    // -------------------------------------------------------------- ACCETTAZIONE
    // B paga la sua quota. La cattura dei 2,50 € di A avviene nel webhook,
    // solo a pagamento di B riuscito.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Attivazione baratto - "${titoloOggetto}"`,
            description: 'La tua quota di attivazione dello scambio.',
          },
          unit_amount: QUOTA_BARATTO_CENT,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'baratto_accept',
        barattoId: baratto.id,
        itemId: baratto.item_id,
        userA: baratto.user_a_id,
        userB: baratto.user_b_id,
      },
      success_url: `${siteUrl}/baratti?accettata=true`,
      cancel_url: `${siteUrl}/baratti?annullata=true`,
    })

    if (!session.url) {
      return NextResponse.json({ error: "Errore nell'avvio del pagamento." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    console.error('[Baratto/Process] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
