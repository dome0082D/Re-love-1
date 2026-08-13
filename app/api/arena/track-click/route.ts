// app/api/arena/track-click/route.ts
// Incrementa il contatore di click di un link di promozione, quando
// qualcuno apre l'annuncio partendo da quel link (?arena=CODICE). Passa
// dal server con la chiave di servizio perché aggiorna una riga che non
// appartiene a chi sta facendo la richiesta (il visitatore non è il
// promotore) - lo stesso principio già seguito per il blocco automatico
// della chat.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const { trackingCode } = await req.json()

    if (!trackingCode) {
      return NextResponse.json({ error: 'Codice mancante.' }, { status: 400 })
    }

    const { data: promo } = await supabaseAdmin
      .from('arena_promotions')
      .select('id, clicks')
      .eq('tracking_code', trackingCode)
      .maybeSingle()

    if (!promo) {
      // Codice non riconosciuto (link vecchio, manomesso, o scaduto per
      // qualche motivo) - non è un errore grave, semplicemente non
      // conteggiamo nulla, ma non blocchiamo la visita dell'annuncio.
      return NextResponse.json({ ok: true, contato: false })
    }

    await supabaseAdmin
      .from('arena_promotions')
      .update({ clicks: (promo.clicks || 0) + 1 })
      .eq('id', promo.id)

    return NextResponse.json({ ok: true, contato: true })
  } catch (err) {
    console.error('[Arena/TrackClick] Errore:', err)
    // Non blocchiamo mai la visita dell'annuncio per un errore qui - il
    // conteggio dei click è un dato accessorio, non deve rovinare
    // l'esperienza di chi sta solo guardando un oggetto.
    return NextResponse.json({ ok: true, contato: false })
  }
}