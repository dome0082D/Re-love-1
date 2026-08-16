// app/api/vetrina/delete/route.ts
//
// FIX: la cancellazione di una voce della Vetrina veniva fatta direttamente
// dal browser con la chiave anonima:
//
//     supabase.from('vetrina_items').delete().eq('id', id)
//
// Con le policy RLS tipiche di Supabase, quella DELETE non cancella nulla
// quando la riga appartiene a un altro utente - ma non restituisce nemmeno
// un errore: PostgREST considera "0 righe cancellate" un esito riuscito. La
// pagina mostrava quindi "Voce eliminata dalla Vetrina", ricaricava, e il
// link era ancora lì. Esattamente il sintomo segnalato: né il proprietario
// né lo staff riuscivano a togliere i link esterni pubblicati da altri.
//
// Questa route esegue la cancellazione con la chiave di servizio (che
// scavalca la RLS) ma SOLO dopo aver verificato con il token di sessione
// firmato chi sta chiedendo: o è il proprietario della voce, o è lo staff.
// L'id dell'utente non viene mai preso dal corpo della richiesta, che
// chiunque potrebbe falsificare.

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
      return NextResponse.json({ error: 'Devi accedere per eliminare una voce.' }, { status: 401 })
    }

    const { itemId } = await req.json()
    if (!itemId) {
      return NextResponse.json({ error: 'Voce mancante.' }, { status: 400 })
    }

    const { data: item, error: readError } = await supabaseAdmin
      .from('vetrina_items')
      .select('id, user_id, title')
      .eq('id', itemId)
      .maybeSingle()

    if (readError) {
      console.error('[Vetrina/Delete] Errore lettura voce:', readError)
      return NextResponse.json({ error: 'Errore di lettura.' }, { status: 500 })
    }
    if (!item) {
      // Già cancellata da qualcun altro: per chi ha chiesto il risultato è
      // quello desiderato, quindi non lo trattiamo come errore.
      return NextResponse.json({ ok: true, giaRimossa: true })
    }

    const proprietario = item.user_id === utente.id
    if (!proprietario && !utente.isStaff) {
      return NextResponse.json(
        { error: 'Puoi eliminare solo le voci che hai pubblicato tu.' },
        { status: 403 }
      )
    }

    // ".select()" è necessario per sapere quante righe sono state davvero
    // cancellate: senza, un DELETE a vuoto sarebbe di nuovo indistinguibile
    // da uno riuscito - lo stesso equivoco che ha causato il problema.
    const { data: rimosse, error: deleteError } = await supabaseAdmin
      .from('vetrina_items')
      .delete()
      .eq('id', itemId)
      .select('id')

    if (deleteError) {
      console.error('[Vetrina/Delete] Errore cancellazione:', deleteError)
      return NextResponse.json({ error: "Errore durante l'eliminazione." }, { status: 500 })
    }
    if (!rimosse || rimosse.length === 0) {
      return NextResponse.json({ error: 'La voce non è stata eliminata. Riprova.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      // Utile allo staff per capire se ha rimosso roba altrui.
      comeStaff: !proprietario,
    })
  } catch (err) {
    console.error('[Vetrina/Delete] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
