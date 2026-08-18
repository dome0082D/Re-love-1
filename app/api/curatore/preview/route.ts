// app/api/curatore/preview/route.ts
// Dato il codice di una delega, restituisce un'anteprima del mandato (cosa
// sta per approvare il Proprietario) SENZA approvare nulla - serve per
// mostrare i dettagli prima del tap di conferma finale.
//
// ============================================================================
// COSA È STATO CORRETTO
//
// Accettava soltanto il codice nudo. Chi incollava il contenuto del QR
// ("RELOVE_MANDATE:...") o il link di approvazione si vedeva rispondere
// "Codice QR non riconosciuto" - il problema segnalato. Ora il codice viene
// riconosciuto in tutte le forme (vedi lib/mandato.ts).
//
// In più la risposta dice apertamente se chi sta guardando può approvare o
// no, e perché: prima il Curatore che apriva il proprio link vedeva
// un'anteprima perfetta e scopriva solo premendo "Approva" che non poteva.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { estraiTokenMandato } from '@/lib/mandato'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const { qrToken } = await req.json()
    if (!qrToken) {
      return NextResponse.json({ error: 'Codice mancante.' }, { status: 400 })
    }

    const token = estraiTokenMandato(String(qrToken), true)
    if (!token) {
      return NextResponse.json({
        error: 'Questo non è un codice di delega Re-love. Incolla il link ricevuto dal Curatore, oppure il codice mostrato sotto il QR.',
      }, { status: 400 })
    }

    const { data: mandate, error } = await supabaseAdmin
      .from('curator_mandates')
      .select('id, status, qr_expires_at, custody_type, owner_percentage, curator_percentage, draft_title, draft_description, draft_price, draft_condition, draft_image_url, curator_id')
      .eq('qr_token', token)
      .maybeSingle()

    if (error || !mandate) {
      return NextResponse.json({ error: 'Codice non riconosciuto: potrebbe essere stato rigenerato dal Curatore.' }, { status: 404 })
    }

    if (mandate.status !== 'in_attesa_qr') {
      return NextResponse.json({
        error: mandate.status === 'attivo'
          ? 'Questa delega è già stata approvata.'
          : 'Questa delega non è più in attesa di approvazione.',
      }, { status: 400 })
    }

    if (new Date(mandate.qr_expires_at) < new Date()) {
      return NextResponse.json({
        error: 'Questo codice è scaduto. Chiedi al Curatore di rigenerarlo: ne bastano pochi secondi.',
      }, { status: 400 })
    }

    const { data: curatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, nickname')
      .eq('id', mandate.curator_id)
      .maybeSingle()

    // Chi sta guardando può davvero approvare? Lo diciamo subito, invece di
    // farglielo scoprire dopo aver premuto il pulsante.
    const utente = await verificaUtente(req)
    const bloccante = !utente
      ? 'Per approvare questa delega devi prima accedere a Re-love.'
      : utente.id === mandate.curator_id
      ? "Questa delega l'hai creata tu: va approvata dal Proprietario dell'oggetto, non da te. Mandagli il link."
      : null

    return NextResponse.json({
      token, // il codice normalizzato: la pagina userà questo, non quello incollato
      title: mandate.draft_title,
      description: mandate.draft_description,
      price: mandate.draft_price,
      condition: mandate.draft_condition,
      imageUrl: mandate.draft_image_url,
      custodyType: mandate.custody_type,
      ownerPercentage: mandate.owner_percentage,
      curatorPercentage: mandate.curator_percentage,
      curatorName: curatorProfile?.nickname || curatorProfile?.first_name || 'Un Curatore',
      scadeIl: mandate.qr_expires_at,
      bloccante,
    })
  } catch (err) {
    console.error('[Curatore/Preview] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
