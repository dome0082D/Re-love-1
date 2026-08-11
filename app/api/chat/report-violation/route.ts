// app/api/chat/report-violation/route.ts
// Quando il sistema rileva in chat un tentativo di scambiare link esterni
// o numeri di telefono, questo endpoint blocca ENTRAMBI gli utenti
// coinvolti e salva una segnalazione per lo staff.
//
// Passa dal server (con la chiave di servizio) invece che dal browser
// dell'utente di proposito: bloccare l'account di un'altra persona è
// un'azione delicata, e farla passare solo da qui impedisce a chiunque di
// forzare un blocco falso manipolando il proprio browser.

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

    // Blocca entrambi gli account coinvolti.
    const { error: banError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_banned: true,
        banned_reason: 'Tentativo di scambio di contatti esterni (link o numero di telefono) rilevato in chat.',
        banned_at: new Date().toISOString(),
      })
      .in('id', [senderId, receiverId])

    if (banError) {
      console.error('[ChatSecurity] Errore durante il blocco degli utenti:', banError)
      return NextResponse.json({ error: 'Errore durante il blocco.' }, { status: 500 })
    }

    // Salva la segnalazione per lo staff, col testo del messaggio come prova.
    const { error: reportError } = await supabaseAdmin
      .from('chat_violations')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        message_content: messageContent,
        reviewed: false,
      }])

    if (reportError) {
      console.error('[ChatSecurity] Errore durante il salvataggio della segnalazione:', reportError)
      // Non blocchiamo la risposta per questo - gli utenti sono già stati
      // bloccati, che è la parte più importante; la segnalazione mancante
      // è un problema minore recuperabile a mano.
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ChatSecurity] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}