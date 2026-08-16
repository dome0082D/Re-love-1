// app/api/arena/promote/route.ts
// Genera (o restituisce, se esiste già) il link di promozione univoco di
// un utente per un oggetto in Arena. Un promotore ha sempre UN solo
// link per oggetto - richiederlo di nuovo restituisce lo stesso.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { statoContoStripe } from '@/lib/stripeAccount'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

function generaCodiceTracciamento(): string {
  // 8 caratteri alfanumerici, sufficienti per non avere collisioni
  // pratiche su un numero di promotori realistico per questo sito.
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

export async function POST(req: NextRequest) {
  try {
    const { announcementId, promoterId } = await req.json()

    if (!announcementId || !promoterId) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }

    const { data: announcement, error: annError } = await supabaseAdmin
      .from('announcements')
      .select('id, user_id, is_arena, price, title')
      .eq('id', announcementId)
      .single()

    if (annError || !announcement) {
      return NextResponse.json({ error: 'Annuncio non trovato.' }, { status: 404 })
    }

    if (!announcement.is_arena) {
      return NextResponse.json({ error: 'Questo oggetto non è in Arena.' }, { status: 400 })
    }

    if (announcement.user_id === promoterId) {
      return NextResponse.json({ error: 'Non puoi promuovere un tuo stesso oggetto.' }, { status: 400 })
    }

    // Il promotore deve avere un conto pronto a ricevere pagamenti - stessa
    // verifica già richiesta ovunque nel sito (Curatore Locale, vendite
    // normali), riusata qui invece di inventare un controllo nuovo.
    const { data: promoterProfile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', promoterId)
      .single()

    // FIX: prima bastava che stripe_account_id esistesse. Quel campo viene
    // scritto sul profilo appena si preme "Attiva ricezione pagamenti", cioe'
    // PRIMA della configurazione vera su Stripe: si poteva quindi diventare
    // promotore Arena senza poter incassare nulla. Ora si chiede a Stripe.
    const statoPromotore = await statoContoStripe(promoterProfile?.stripe_account_id)
    if (!statoPromotore.pronto) {
      return NextResponse.json({
        error: statoPromotore.collegato
          ? 'Devi completare la configurazione del conto su Stripe prima di poter promuovere un oggetto.'
          : 'Prima di promuovere un oggetto devi configurare il tuo conto per ricevere pagamenti, dal tuo profilo.',
        requiresPayoutSetup: true,
      }, { status: 400 })
    }

    // Se esiste già una promozione di questo utente per questo oggetto,
    // la restituiamo invece di crearne una seconda.
    const { data: esistente } = await supabaseAdmin
      .from('arena_promotions')
      .select('tracking_code')
      .eq('announcement_id', announcementId)
      .eq('promoter_id', promoterId)
      .maybeSingle()

    if (esistente) {
      return NextResponse.json({ trackingCode: esistente.tracking_code })
    }

    let tentativi = 0
    let trackingCode = generaCodiceTracciamento()

    // In teoria una collisione di codice è quasi impossibile con 8
    // caratteri casuali, ma la gestiamo comunque invece di ignorarla -
    // riproviamo con un nuovo codice fino a 5 volte prima di arrenderci.
    while (tentativi < 5) {
      const { error: insertError } = await supabaseAdmin
        .from('arena_promotions')
        .insert([{
          announcement_id: announcementId,
          promoter_id: promoterId,
          tracking_code: trackingCode,
        }])

      if (!insertError) {
        return NextResponse.json({ trackingCode })
      }

      // Codice 23505 = violazione di unicità in Postgres - solo in quel
      // caso riproviamo con un codice diverso, qualsiasi altro errore lo
      // segnaliamo subito.
      if (insertError.code !== '23505') {
        console.error('[Arena/Promote] Errore creazione promozione:', insertError)
        return NextResponse.json({ error: 'Errore durante la creazione del link.' }, { status: 500 })
      }

      trackingCode = generaCodiceTracciamento()
      tentativi++
    }

    return NextResponse.json({ error: 'Errore temporaneo, riprova.' }, { status: 500 })
  } catch (err) {
    console.error('[Arena/Promote] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}