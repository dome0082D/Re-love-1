// app/api/staff/azione/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — quasi nessuna azione dello staff funzionava davvero.
//
// Il pannello eseguiva le azioni di moderazione dal browser con la chiave
// anonima. Con la RLS attiva, lo staff per il database è un utente come gli
// altri: quelle scritture non toccavano nessuna riga, e siccome PostgREST
// risponde 200 (non un errore) il pannello mostrava "fatto" ogni volta.
// Verificato in produzione con una sessione autenticata:
//
//     UPDATE profiles (bloccare un utente)  -> 200, righe toccate: 0
//     UPDATE transactions (forzare stato)   -> 200, righe toccate: 0
//     UPDATE disputes (risolvere)           -> 200, righe toccate: 0
//     DELETE reviews (recensione altrui)    -> 200, righe toccate: 0
//
// Cioè: nessun utente è mai stato bloccato, nessuna controversia è mai stata
// chiusa, nessuna recensione è mai stata rimossa. Il pannello era di fatto
// decorativo.
//
// Qui ogni azione passa dalla chiave di servizio, ma solo dopo aver
// verificato dal token di sessione firmato che chi chiede sia lo staff, e
// ogni risposta dice QUANTE righe ha toccato: un fallimento non può più
// passare per un successo.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente, STAFF_EMAIL } from '@/lib/serverAuth'
import { notificaUtente } from '@/lib/pushServer'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

type Azione =
  | 'blocca-utente' | 'sblocca-utente' | 'elimina-utente' | 'cambia-ruolo' | 'modifica-profilo'
  | 'elimina-annuncio' | 'modifica-annuncio'
  | 'elimina-recensione'
  | 'elimina-voce-vetrina'
  | 'stato-ordine' | 'spedizione'
  | 'risolvi-controversia' | 'archivia-segnalazione' | 'elimina-segnalazione'

/** Risposta uniforme: dice sempre quante righe sono state davvero toccate. */
function esito(righe: number, messaggio: string) {
  if (righe === 0) {
    return NextResponse.json(
      { error: `${messaggio} non ha avuto effetto: la riga non esiste più o è già in quello stato.` },
      { status: 409 }
    )
  }
  return NextResponse.json({ ok: true, righe })
}

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    if (!utente.isStaff) return NextResponse.json({ error: 'Area riservata allo staff.' }, { status: 403 })

    const corpo = await req.json()
    const azione = corpo?.azione as Azione

    switch (azione) {
      // ------------------------------------------------------------- UTENTI
      case 'blocca-utente':
      case 'sblocca-utente': {
        const { userId, motivo } = corpo
        if (!userId) return NextResponse.json({ error: 'Utente mancante.' }, { status: 400 })

        // Protezione: lo staff non può bloccare se stesso e restare fuori.
        if (userId === utente.id) {
          return NextResponse.json({ error: 'Non puoi bloccare il tuo stesso account.' }, { status: 400 })
        }

        const blocca = azione === 'blocca-utente'
        const { data, error } = await supabaseAdmin
          .from('profiles')
          .update({
            is_banned: blocca,
            banned_reason: blocca ? (motivo || 'Bloccato dallo staff.') : null,
            banned_at: blocca ? new Date().toISOString() : null,
          })
          .eq('id', userId)
          .select('id')

        if (error) throw error

        if ((data?.length || 0) > 0) {
          await notificaUtente(
            userId,
            blocca
              ? `⛔ Il tuo account è stato sospeso dallo staff. Motivo: ${motivo || 'violazione delle regole'}. Scrivi al supporto se ritieni ci sia un errore.`
              : `✅ Il tuo account è stato riattivato. Bentornato su Re-love.`,
            blocca ? 'Account sospeso ⛔' : 'Account riattivato ✅',
            '/supporto',
            true
          )
        }
        return esito(data?.length || 0, blocca ? 'Il blocco' : 'Lo sblocco')
      }

      case 'cambia-ruolo': {
        const { userId, ruolo } = corpo
        if (!userId || !ruolo) return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
        if (!['staff', 'user'].includes(ruolo)) {
          return NextResponse.json({ error: 'Ruolo non valido.' }, { status: 400 })
        }
        const { data, error } = await supabaseAdmin
          .from('profiles').update({ role: ruolo }).eq('id', userId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'Il cambio di ruolo')
      }

      case 'modifica-profilo': {
        const { userId, campi } = corpo
        if (!userId || !campi) return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })

        // Solo i campi anagrafici che ha senso correggere in moderazione.
        // Restano fuori di proposito: role (ha un'azione dedicata),
        // is_banned (idem) e stripe_account_id (romperebbe i pagamenti).
        const consentiti = ['first_name', 'last_name', 'nickname', 'city', 'full_address', 'phone', 'bio']
        const aggiornamento: Record<string, unknown> = {}
        for (const c of consentiti) if (c in campi) aggiornamento[c] = campi[c]
        if (Object.keys(aggiornamento).length === 0) {
          return NextResponse.json({ error: 'Nessun campo modificabile nella richiesta.' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
          .from('profiles').update(aggiornamento).eq('id', userId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'La modifica')
      }

      case 'elimina-utente': {
        const { userId } = corpo
        if (!userId) return NextResponse.json({ error: 'Utente mancante.' }, { status: 400 })
        if (userId === utente.id) {
          return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account da qui.' }, { status: 400 })
        }
        // Non si cancella un utente coinvolto in uno scambio ancora aperto:
        // l'altra parte resterebbe senza controparte e con soldi bloccati.
        const { data: aperti } = await supabaseAdmin
          .from('transactions').select('id')
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .in('status', ['held', 'Pagato', 'Spedito', 'Ricevuto', 'In Contestazione'])
          .limit(1)
        if (aperti && aperti.length > 0) {
          return NextResponse.json({ error: 'Questo utente ha uno scambio ancora aperto: chiudilo prima di eliminarlo.' }, { status: 400 })
        }

        for (const [tab, col] of [
          ['push_subscriptions', 'user_id'], ['notifications', 'user_id'],
          ['favorites', 'user_id'], ['hidden_conversations', 'user_id'],
          ['vetrina_items', 'user_id'], ['announcements', 'user_id'],
        ] as [string, string][]) {
          await supabaseAdmin.from(tab).delete().eq(col, userId)
        }
        await supabaseAdmin.from('messages').delete().eq('sender_id', userId)
        await supabaseAdmin.from('messages').delete().eq('receiver_id', userId)
        await supabaseAdmin.from('profiles').delete().eq('id', userId)

        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authErr) {
          console.error('[Staff/Azione] Utente Auth non rimosso:', authErr)
          return NextResponse.json({ error: "Dati rimossi, ma l'account non è stato chiuso del tutto." }, { status: 500 })
        }
        return NextResponse.json({ ok: true, righe: 1 })
      }

      // ---------------------------------------------------------- CONTENUTI
      case 'elimina-annuncio': {
        const { announcementId } = corpo
        if (!announcementId) return NextResponse.json({ error: 'Annuncio mancante.' }, { status: 400 })

        const { data: ann } = await supabaseAdmin
          .from('announcements').select('user_id, title').eq('id', announcementId).maybeSingle()

        const { data, error } = await supabaseAdmin
          .from('announcements').delete().eq('id', announcementId).select('id')
        if (error) throw error

        if ((data?.length || 0) > 0 && ann?.user_id) {
          await notificaUtente(
            ann.user_id,
            `⚠️ Il tuo annuncio "${ann.title}" è stato rimosso dallo staff perché non conforme alle regole.`,
            'Annuncio rimosso ⚠️', '/dashboard/annunci', true
          )
        }
        return esito(data?.length || 0, 'La rimozione')
      }

      case 'modifica-annuncio': {
        const { announcementId, campi } = corpo
        if (!announcementId || !campi) return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })

        // Solo i campi che ha senso correggere in moderazione: nessuna
        // possibilità di riscrivere l'annuncio a piacere.
        const consentiti = ['title', 'description', 'price', 'quantity', 'condition', 'city', 'is_sponsored', 'cerca_curatore', 'curator_percentage']
        const aggiornamento: Record<string, unknown> = {}
        for (const c of consentiti) if (c in campi) aggiornamento[c] = campi[c]
        if (Object.keys(aggiornamento).length === 0) {
          return NextResponse.json({ error: 'Nessun campo modificabile nella richiesta.' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
          .from('announcements').update(aggiornamento).eq('id', announcementId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'La modifica')
      }

      case 'elimina-recensione': {
        const { reviewId } = corpo
        if (!reviewId) return NextResponse.json({ error: 'Recensione mancante.' }, { status: 400 })
        const { data, error } = await supabaseAdmin
          .from('reviews').delete().eq('id', reviewId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'La rimozione')
      }

      case 'elimina-voce-vetrina': {
        const { itemId } = corpo
        if (!itemId) return NextResponse.json({ error: 'Voce mancante.' }, { status: 400 })
        const { data, error } = await supabaseAdmin
          .from('vetrina_items').delete().eq('id', itemId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'La rimozione')
      }

      // ------------------------------------------------------------- ORDINI
      case 'stato-ordine': {
        const { transactionId, stato } = corpo
        if (!transactionId || !stato) return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })

        const { data, error } = await supabaseAdmin
          .from('transactions').update({ status: stato }).eq('id', transactionId).select('id, buyer_id, seller_id')
        if (error) throw error

        const riga = data?.[0]
        if (riga) {
          const avviso = `📦 Lo staff ha aggiornato lo stato del tuo ordine: ${stato}.`
          await notificaUtente(riga.buyer_id, avviso, 'Ordine aggiornato 📦', '/dashboard/acquisti')
          await notificaUtente(riga.seller_id, avviso, 'Ordine aggiornato 📦', '/orders')
        }
        return esito(data?.length || 0, "L'aggiornamento")
      }

      case 'spedizione': {
        const { transactionId, corriere, tracking, codicePacco } = corpo
        if (!transactionId) return NextResponse.json({ error: 'Ordine mancante.' }, { status: 400 })

        const { data, error } = await supabaseAdmin
          .from('transactions')
          .update({
            courier_name: corriere || null,
            tracking_number: tracking || null,
            package_id_code: codicePacco || null,
            status: 'Spedito',
          })
          .eq('id', transactionId)
          .select('id, buyer_id')
        if (error) throw error

        if (data?.[0]?.buyer_id) {
          await notificaUtente(
            data[0].buyer_id,
            `🚚 Il tuo pacco è stato spedito${corriere ? ` con ${corriere}` : ''}${tracking ? ` (tracking ${tracking})` : ''}.`,
            'Pacco spedito 🚚', '/dashboard/acquisti', true
          )
        }
        return esito(data?.length || 0, "L'aggiornamento della spedizione")
      }

      // ------------------------------------------------------- CONTROVERSIE
      case 'risolvi-controversia': {
        const { disputeId, esitoScelto, buyerId, sellerId } = corpo
        if (!disputeId || !esitoScelto) return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })

        const { data, error } = await supabaseAdmin
          .from('disputes').update({ status: `Risolta (${esitoScelto})` }).eq('id', disputeId).select('id')
        if (error) throw error

        if ((data?.length || 0) > 0) {
          const messaggio = `⚖️ Lo staff ha chiuso la controversia: ${esitoScelto}.`
          await notificaUtente(buyerId, messaggio, 'Esito controversia ⚖️', '/dashboard/controversie', true)
          await notificaUtente(sellerId, messaggio, 'Esito controversia ⚖️', '/dashboard/controversie', true)
        }
        return esito(data?.length || 0, 'La chiusura della pratica')
      }

      // ------------------------------------------------------- SEGNALAZIONI
      case 'archivia-segnalazione': {
        const { violationId } = corpo
        if (!violationId) return NextResponse.json({ error: 'Segnalazione mancante.' }, { status: 400 })
        const { data, error } = await supabaseAdmin
          .from('chat_violations').update({ reviewed: true }).eq('id', violationId).select('id')
        if (error) throw error
        return esito(data?.length || 0, "L'archiviazione")
      }

      case 'elimina-segnalazione': {
        const { violationId } = corpo
        if (!violationId) return NextResponse.json({ error: 'Segnalazione mancante.' }, { status: 400 })
        const { data, error } = await supabaseAdmin
          .from('chat_violations').delete().eq('id', violationId).select('id')
        if (error) throw error
        return esito(data?.length || 0, 'La rimozione')
      }

      default:
        return NextResponse.json({ error: `Azione "${azione}" non riconosciuta.` }, { status: 400 })
    }
  } catch (err) {
    console.error('[Staff/Azione] Errore:', err, '(staff:', STAFF_EMAIL, ')')
    return NextResponse.json({ error: 'Errore durante l\'operazione.' }, { status: 500 })
  }
}
