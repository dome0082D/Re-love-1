// app/api/favorites/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — il cuoricino "preferiti" non salvava niente.
//
// L'inserimento veniva fatto dal browser con la chiave anonima. La tabella
// "favorites" ha la RLS attiva senza una policy di INSERT, quindi il
// database rifiutava proprio la scrittura. Verificato in produzione con un
// utente vero che salvava un annuncio nei PROPRI preferiti:
//
//     INSERT favorites -> 403
//     {"code":"42501","message":"new row violates row-level security policy
//      for table \"favorites\""}
//
// Il cuore si colorava lo stesso, perché la pagina aggiornava comunque il
// proprio elenco a schermo: al ricaricamento tornava grigio e il preferito
// non esisteva da nessuna parte.
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
      return NextResponse.json({ error: 'Devi accedere per salvare nei preferiti.' }, { status: 401 })
    }

    const { announcementId } = await req.json()
    if (!announcementId) {
      return NextResponse.json({ error: 'Annuncio mancante.' }, { status: 400 })
    }

    // Il preferito è sempre e solo dell'utente verificato: l'id non viene mai
    // preso dal corpo della richiesta.
    const { data: esistente } = await supabaseAdmin
      .from('favorites')
      .select('id')
      .eq('user_id', utente.id)
      .eq('announcement_id', announcementId)
      .maybeSingle()

    if (esistente) {
      const { error } = await supabaseAdmin.from('favorites').delete().eq('id', esistente.id)
      if (error) {
        console.error('[Favorites] Errore rimozione:', error)
        return NextResponse.json({ error: 'Errore durante la rimozione.' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, preferito: false })
    }

    const { error } = await supabaseAdmin
      .from('favorites')
      .insert([{ user_id: utente.id, announcement_id: announcementId }])

    if (error) {
      console.error('[Favorites] Errore salvataggio:', error)
      return NextResponse.json({ error: 'Errore durante il salvataggio.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, preferito: true })
  } catch (err) {
    console.error('[Favorites] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
