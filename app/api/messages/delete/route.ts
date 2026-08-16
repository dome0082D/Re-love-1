// app/api/messages/delete/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — "elimina messaggio" non eliminava niente.
//
// La cancellazione veniva fatta dal browser con la chiave anonima:
//
//     await supabase.from('messages').delete().eq('id', messageId)
//
// La tabella "messages" ha la RLS attiva senza una policy di DELETE: la
// richiesta NON dà errore, restituisce 200 e cancella ZERO righe. Verificato
// sul database di produzione con un utente vero che cancellava un messaggio
// SUO:
//
//     DELETE messages (proprio) -> 200, righe toccate: 0
//
// E siccome la pagina toglieva comunque il messaggio dall'elenco a schermo,
// sembrava funzionare: spariva, e ricomparivauguale al primo ricaricamento.
//
// Qui la cancellazione avviene con la chiave di servizio, ma solo dopo aver
// verificato dal token di sessione firmato che chi chiede sia l'autore del
// messaggio (o lo staff).
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'

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

    const { messageId, utenteA, utenteB } = await req.json()

    // --- Caso 1: un singolo messaggio -------------------------------------
    if (messageId) {
      const { data: messaggio, error: letturaErr } = await supabaseAdmin
        .from('messages')
        .select('id, sender_id')
        .eq('id', messageId)
        .maybeSingle()

      if (letturaErr) {
        console.error('[Messages/Delete] Errore lettura:', letturaErr)
        return NextResponse.json({ error: 'Errore di lettura.' }, { status: 500 })
      }
      if (!messaggio) return NextResponse.json({ ok: true, giaRimosso: true })

      // Si cancella solo ciò che si ha scritto. Ricevere un messaggio non dà
      // il diritto di cancellarlo dalla conversazione anche all'altro: per
      // togliersi una conversazione di torno c'è "nascondi conversazione".
      const mio = messaggio.sender_id === utente.id
      if (!mio && !utente.isStaff) {
        return NextResponse.json(
          { error: 'Puoi eliminare solo i messaggi che hai scritto tu.' },
          { status: 403 }
        )
      }

      const { data: rimossi, error } = await supabaseAdmin
        .from('messages')
        .delete()
        .eq('id', messageId)
        .select('id')

      if (error) {
        console.error('[Messages/Delete] Errore cancellazione:', error)
        return NextResponse.json({ error: "Errore durante l'eliminazione." }, { status: 500 })
      }
      return NextResponse.json({ ok: true, rimossi: rimossi?.length || 0, comeStaff: !mio })
    }

    // --- Caso 2: un'intera conversazione (solo staff) ----------------------
    // Per un utente normale "elimina conversazione" nasconde la chat solo a
    // lui (tabella hidden_conversations, che funziona già dal browser): non
    // deve poter cancellare i messaggi scritti dall'altra persona.
    if (utenteA && utenteB) {
      if (!utente.isStaff) {
        return NextResponse.json(
          { error: 'Solo lo staff può cancellare una conversazione per entrambi.' },
          { status: 403 }
        )
      }

      const { data: rimossi, error } = await supabaseAdmin
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${utenteA},receiver_id.eq.${utenteB}),and(sender_id.eq.${utenteB},receiver_id.eq.${utenteA})`)
        .select('id')

      if (error) {
        console.error('[Messages/Delete] Errore cancellazione conversazione:', error)
        return NextResponse.json({ error: "Errore durante l'eliminazione." }, { status: 500 })
      }
      return NextResponse.json({ ok: true, rimossi: rimossi?.length || 0 })
    }

    return NextResponse.json({ error: 'Niente da eliminare.' }, { status: 400 })
  } catch (err) {
    console.error('[Messages/Delete] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
