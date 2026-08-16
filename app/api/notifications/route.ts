// app/api/notifications/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — le notifiche non si potevano né segnare come lette né
// cancellare.
//
// Entrambe le operazioni venivano fatte dal browser con la chiave anonima.
// La tabella "notifications" ha la RLS attiva senza policy di UPDATE né di
// DELETE: le richieste NON danno errore, rispondono 200 e toccano ZERO righe.
// Verificato sul database di produzione con un utente vero, su una notifica
// SUA:
//
//     UPDATE is_read=true (propria) -> 200, righe toccate: 0
//     DELETE               (propria) -> 200, righe toccate: 0
//
// Conseguenza visibile: il pallino rosso dei "non letti" tornava sempre al
// numero di prima a ogni ricaricamento, perché "segna come letta" non
// scriveva mai nulla. E cancellarle non era proprio previsto.
//
// Qui le operazioni passano dalla chiave di servizio, ma solo su righe che
// appartengono davvero a chi le chiede - l'identità viene dal token di
// sessione firmato, mai dal corpo della richiesta.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

type Azione = 'segna-lette' | 'elimina' | 'elimina-tutte'

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    }

    const { azione, notificationId } = (await req.json()) as {
      azione?: Azione
      notificationId?: string
    }

    // Ogni ramo filtra SEMPRE per user_id dell'utente verificato: anche
    // passando l'id di una notifica altrui non si tocca nulla.
    if (azione === 'segna-lette') {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', utente.id)
        .eq('is_read', false)
        .select('id')

      if (error) {
        console.error('[Notifications] Errore segna-lette:', error)
        return NextResponse.json({ error: 'Errore aggiornamento.' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, aggiornate: data?.length || 0 })
    }

    if (azione === 'elimina') {
      if (!notificationId) {
        return NextResponse.json({ error: 'Notifica mancante.' }, { status: 400 })
      }
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', utente.id)
        .select('id')

      if (error) {
        console.error('[Notifications] Errore elimina:', error)
        return NextResponse.json({ error: "Errore durante l'eliminazione." }, { status: 500 })
      }
      if (!data || data.length === 0) {
        // O non esiste più, o non è sua: in entrambi i casi non c'è nulla da
        // fare, e non diciamo quale dei due per non rivelare l'esistenza di
        // notifiche altrui.
        return NextResponse.json({ ok: true, rimosse: 0 })
      }
      return NextResponse.json({ ok: true, rimosse: data.length })
    }

    if (azione === 'elimina-tutte') {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', utente.id)
        .select('id')

      if (error) {
        console.error('[Notifications] Errore elimina-tutte:', error)
        return NextResponse.json({ error: "Errore durante l'eliminazione." }, { status: 500 })
      }
      return NextResponse.json({ ok: true, rimosse: data?.length || 0 })
    }

    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 })
  } catch (err) {
    console.error('[Notifications] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
