// app/api/chat/report-violation/route.ts
// Quando la chat rileva un tentativo di scambiare link/contatti/accordi
// fuori piattaforma, questo endpoint NON blocca più subito gli utenti -
// li mette invece "sotto osservazione" per qualche giorno (vedi
// GRACE_PERIOD_DAYS). Il vero blocco, se scatta, avviene più tardi tramite
// il controllo automatico programmato (vedi
// app/api/cron/check-suspicious-exchanges/route.ts), solo se nel
// frattempo NON risulta una transazione vera conclusa tra i due utenti.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: NextRequest) {
  try {
    const { senderId, receiverId, messageContent } = await req.json()

    if (!senderId || !receiverId || !messageContent) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('suspicious_exchanges')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        message_content: messageContent,
      }])

    if (error) {
      console.error('[ChatSecurity] Errore registrazione caso sospetto:', error)
      return NextResponse.json({ error: 'Errore durante la registrazione.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ChatSecurity] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}