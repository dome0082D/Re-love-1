// app/api/curatore/track-click/route.ts
//
// Conta una visita arrivata dal link personale di un curatore.
//
// Serve al curatore per sapere se il link che ha messo in giro sta portando
// gente: senza questo dato saprebbe solo se ha venduto o no, senza capire se
// il problema è che nessuno clicca o che chi clicca non compra.
//
// Passa dal server con la chiave di servizio perché aggiorna una riga che non
// appartiene a chi sta visitando (il visitatore non è il curatore, e spesso
// non ha nemmeno fatto accesso).

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STATI_CANDIDATURA } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const { trackingCode } = await req.json()
    if (!trackingCode) {
      return NextResponse.json({ ok: true, contato: false })
    }

    const { data: incarico } = await supabaseAdmin
      .from('curator_candidature')
      .select('id, clicks, stato')
      .eq('tracking_code', trackingCode)
      .maybeSingle()

    // Codice non riconosciuto, o incarico non più attivo: non è un errore
    // grave, semplicemente non conteggiamo nulla. La visita all'annuncio non
    // deve mai essere disturbata da questo.
    if (!incarico || incarico.stato !== STATI_CANDIDATURA.accettata) {
      return NextResponse.json({ ok: true, contato: false })
    }

    await supabaseAdmin
      .from('curator_candidature')
      .update({ clicks: (incarico.clicks || 0) + 1 })
      .eq('id', incarico.id)

    return NextResponse.json({ ok: true, contato: true })
  } catch (err) {
    console.error('[Curatore/TrackClick] Errore:', err)
    // Il conteggio è un dato accessorio: non deve mai rovinare la visita.
    return NextResponse.json({ ok: true, contato: false })
  }
}
