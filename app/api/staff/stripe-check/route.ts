// app/api/staff/stripe-check/route.ts
//
// ============================================================================
// DIAGNOSI DEI PAGAMENTI.
//
// Nata da un problema reale e difficile da vedere: in .env la variabile
// STRIPE_SECRET_KEY conteneva la chiave PUBBLICABILE (pk_live_...), lo stesso
// valore di NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Con quella chiave Stripe
// rifiuta ogni chiamata dal server:
//
//     403 {"code":"secret_key_required"}
//
// Cioè non funzionavano: creazione dei conti venditore, pagine di pagamento,
// verifica dei conti, bonifici. Ma l'unico segno era un 403 generico nei log
// del server, che nessuno guarda finché qualcosa non si rompe in modo
// evidente. Questa route rende il problema visibile in un colpo d'occhio dal
// pannello staff, e mostra anche quali venditori risultano davvero pronti a
// incassare e quali no.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { getStripe, problemaChiaveStripe, statoContoStripe } from '@/lib/stripeAccount'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    if (!utente.isStaff) return NextResponse.json({ error: 'Area riservata allo staff.' }, { status: 403 })

    const problemaChiave = problemaChiaveStripe()

    // Prova concreta: una chiamata banale a Stripe. Se la chiave è sbagliata
    // o revocata, si scopre qui e non al primo pagamento di un cliente.
    let stripeRaggiungibile = false
    let dettaglioStripe: string | null = null
    if (!problemaChiave) {
      try {
        await getStripe().balance.retrieve()
        stripeRaggiungibile = true
      } catch (err: unknown) {
        const e = err as { message?: string; code?: string }
        dettaglioStripe = e?.message || e?.code || 'errore sconosciuto'
      }
    }

    // Altre variabili senza le quali metà del sistema non funziona.
    const configurazione = {
      chiaveSegreta: problemaChiave ? 'NON VALIDA' : 'ok',
      problemaChiave,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'ok' : 'MANCANTE',
      indirizzoSito: process.env.NEXT_PUBLIC_SITE_URL ? 'ok' : 'mancante (si usa un ripiego)',
      chiaviPush: process.env.VAPID_PRIVATE_KEY && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? 'ok' : 'MANCANTI',
      chiaveEmail: process.env.RESEND_API_KEY ? 'ok' : 'MANCANTE',
      chiaveAI: process.env.GEMINI_API_KEY ? 'ok' : 'mancante',
    }

    // Stato reale dei conti venditore, per capire chi può incassare.
    const { data: profili } = await supabaseAdmin
      .from('profiles')
      .select('id, email, stripe_account_id')
      .not('stripe_account_id', 'is', null)
      .limit(60)

    const venditori: { email: string; stato: string; mancante: string | null }[] = []
    if (!problemaChiave && stripeRaggiungibile) {
      for (const p of profili || []) {
        const s = await statoContoStripe(p.stripe_account_id)
        venditori.push({
          email: p.email || p.id,
          stato: s.pronto ? 'pronto' : s.collegato ? 'incompleto' : 'non collegato',
          mancante: s.mancante,
        })
      }
    }

    return NextResponse.json({
      configurazione,
      stripeRaggiungibile,
      dettaglioStripe,
      contiCollegati: (profili || []).length,
      venditoriPronti: venditori.filter(v => v.stato === 'pronto').length,
      venditori,
    })
  } catch (err) {
    console.error('[Staff/StripeCheck] Errore:', err)
    return NextResponse.json({ error: 'Errore durante la diagnosi.' }, { status: 500 })
  }
}
