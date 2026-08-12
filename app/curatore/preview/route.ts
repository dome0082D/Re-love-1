// app/api/curatore/preview/route.ts
// Dato il token letto dal QR, restituisce un'anteprima del mandato (cosa
// sta per approvare il Proprietario) SENZA approvare nulla - serve per
// mostrare i dettagli prima del tap di conferma finale.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const { qrToken } = await req.json()
    if (!qrToken) {
      return NextResponse.json({ error: 'Token mancante.' }, { status: 400 })
    }

    const { data: mandate, error } = await supabaseAdmin
      .from('curator_mandates')
      .select('id, status, qr_expires_at, custody_type, owner_percentage, curator_percentage, draft_title, draft_description, draft_price, draft_condition, draft_image_url, curator_id')
      .eq('qr_token', qrToken)
      .single()

    if (error || !mandate) {
      return NextResponse.json({ error: 'Codice QR non riconosciuto.' }, { status: 404 })
    }

    if (mandate.status !== 'in_attesa_qr') {
      return NextResponse.json({ error: 'Questo mandato non è più in attesa di approvazione.' }, { status: 400 })
    }

    if (new Date(mandate.qr_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Questo QR è scaduto.' }, { status: 400 })
    }

    const { data: curatorProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, nickname')
      .eq('id', mandate.curator_id)
      .single()

    return NextResponse.json({
      title: mandate.draft_title,
      description: mandate.draft_description,
      price: mandate.draft_price,
      condition: mandate.draft_condition,
      imageUrl: mandate.draft_image_url,
      custodyType: mandate.custody_type,
      ownerPercentage: mandate.owner_percentage,
      curatorPercentage: mandate.curator_percentage,
      curatorName: curatorProfile?.nickname || curatorProfile?.first_name || 'Un Curatore',
    })
  } catch (err) {
    console.error('[Curatore/Preview] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}