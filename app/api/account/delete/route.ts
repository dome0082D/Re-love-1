// app/api/account/delete/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — "Elimina Profilo" non eliminava l'account.
//
// Il pulsante nel menu faceva questo, dal browser:
//
//     await supabase.from('profiles').delete().eq('id', user.id)
//
// Due problemi:
//   1. Cancellava (o tentava di cancellare) SOLO la riga del profilo.
//      L'utente restava registrato in Supabase Auth: poteva rientrare con le
//      stesse credenziali e ritrovarsi dentro senza profilo, in uno stato
//      incoerente.
//   2. Con la RLS attiva quella DELETE può non toccare nessuna riga senza
//      restituire errore - e il codice, non trovando un errore, mostrava
//      comunque "Profilo eliminato con successo".
//
// Qui l'eliminazione è vera e completa, con una protezione in più: se ci
// sono scambi ancora aperti l'account non si può cancellare, altrimenti
// sparirebbe una delle due parti di una compravendita in corso lasciando
// l'altra senza controparte (e con dei soldi bloccati).
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

/** Stati che indicano uno scambio ancora in corso. */
const STATI_APERTI = ['held', 'Pagato', 'Spedito', 'Ricevuto', 'In Contestazione']

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    }

    // Protezione: niente cancellazione con ordini ancora aperti, da una parte
    // o dall'altra.
    const { data: ordiniAperti } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .or(`buyer_id.eq.${utente.id},seller_id.eq.${utente.id}`)
      .in('status', STATI_APERTI)
      .limit(1)

    if (ordiniAperti && ordiniAperti.length > 0) {
      return NextResponse.json({
        error: 'Hai ancora uno scambio in corso. Concludilo (o attendi che si concluda) prima di eliminare il profilo.',
      }, { status: 400 })
    }

    // Prima si prova la funzione già presente nel database, che sa meglio di
    // noi come sono legate fra loro le tabelle di questo progetto.
    let cascataRiuscita = false
    try {
      const { error } = await supabaseAdmin.rpc('delete_user_cascade', { user_id: utente.id })
      cascataRiuscita = !error
      if (error) console.warn('[Account/Delete] delete_user_cascade non riuscita:', error.message)
    } catch (err) {
      console.warn('[Account/Delete] delete_user_cascade non disponibile:', err)
    }

    // Ripiego esplicito: se la funzione non c'è o non ha funzionato,
    // ripuliamo a mano quello che appartiene a questo utente.
    if (!cascataRiuscita) {
      const pulizie: [string, string][] = [
        ['push_subscriptions', 'user_id'],
        ['notifications', 'user_id'],
        ['favorites', 'user_id'],
        ['hidden_conversations', 'user_id'],
        ['vetrina_items', 'user_id'],
        ['announcements', 'user_id'],
      ]
      for (const [tabella, colonna] of pulizie) {
        const { error } = await supabaseAdmin.from(tabella).delete().eq(colonna, utente.id)
        if (error) console.warn(`[Account/Delete] Pulizia ${tabella} non riuscita:`, error.message)
      }

      // I messaggi hanno due colonne possibili, quindi vanno fatti a parte.
      await supabaseAdmin.from('messages').delete().eq('sender_id', utente.id)
      await supabaseAdmin.from('messages').delete().eq('receiver_id', utente.id)

      await supabaseAdmin.from('profiles').delete().eq('id', utente.id)
    }

    // Il passaggio che mancava del tutto: rimuovere l'utente da Supabase
    // Auth. Senza questo l'account continuava a esistere e a permettere
    // l'accesso.
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(utente.id)
    if (authErr) {
      console.error('[Account/Delete] Eliminazione utente Auth non riuscita:', authErr)
      return NextResponse.json({
        error: "I tuoi dati sono stati rimossi, ma l'account non è stato chiuso del tutto. Scrivi allo staff per completare.",
      }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Account/Delete] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
