// app/api/stripe/account-status/route.ts
//
// Dice alla pagina profilo (e a chiunque altro serva) se l'utente collegato
// può DAVVERO incassare, chiedendolo a Stripe invece di dedurlo dalla sola
// presenza di "stripe_account_id" nel profilo - che veniva scritto prima
// ancora che l'utente iniziasse la configurazione su Stripe.
//
// L'identità viene dal token di sessione firmato, non dal corpo della
// richiesta: nessuno deve poter chiedere lo stato del conto di un altro.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { statoContoUtente, invalidaCacheConto } from '@/lib/stripeAccount'

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

    // Al rientro da Stripe la pagina passa "forza: true": in quel momento la
    // risposta in cache è quasi certamente quella vecchia (di pochi secondi
    // prima, quando l'account non era ancora abilitato), e mostrerebbe
    // "non completato" proprio a chi ha appena finito.
    let forza = false
    try {
      const body = await req.json()
      forza = !!body?.forza
    } catch {
      // corpo assente: va benissimo, nessun refresh forzato
    }

    if (forza) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', utente.id)
        .maybeSingle()
      if (profile?.stripe_account_id) invalidaCacheConto(profile.stripe_account_id)
    }

    const stato = await statoContoUtente(supabaseAdmin, utente.id)

    return NextResponse.json({
      collegato: stato.collegato,
      datiInviati: stato.datiInviati,
      incassiAttivi: stato.incassiAttivi,
      bonificiAttivi: stato.bonificiAttivi,
      pronto: stato.pronto,
      mancante: stato.mancante,
      // Dettaglio di cosa Stripe sta ancora aspettando, così il profilo può
      // dirlo voce per voce invece di un generico "da completare".
      daCompletare: stato.daCompletare || [],
      scadenza: stato.scadenza || null,
      inVerifica: !!stato.inVerifica,
    })
  } catch (err) {
    console.error('[Stripe/AccountStatus] Errore:', err)
    return NextResponse.json({ error: 'Errore di verifica.' }, { status: 500 })
  }
}
