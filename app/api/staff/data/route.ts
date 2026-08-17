// app/api/staff/data/route.ts
//
// ============================================================================
// PERCHÉ ESISTE — metà del pannello staff era sempre vuota.
//
// Il pannello leggeva tutto dal browser con la chiave anonima. Con la RLS
// attiva, un utente (staff compreso: per il database è un utente come gli
// altri) non vede le righe che non lo riguardano. Verificato in produzione
// con una sessione autenticata:
//
//     SELECT transactions     -> 200, 0 righe
//     SELECT chat_violations  -> 200, 0 righe
//
// Nessun errore, solo elenchi vuoti: la sezione Ordini e quella Segnalazioni
// risultavano perennemente "nessun dato", anche con ordini e segnalazioni
// realmente presenti nel database.
//
// Qui la lettura avviene con la chiave di servizio, dopo aver verificato che
// chi chiede sia davvero lo staff (dal token di sessione firmato).
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    if (!utente.isStaff) return NextResponse.json({ error: 'Area riservata allo staff.' }, { status: 403 })

    const [
      profiliRes, transazioniRes, recensioniRes, controversieRes,
      segnalazioniRes, annunciRes, vetrinaRes, barattiRes,
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').order('created_at', { ascending: false }),
      supabaseAdmin.from('transactions').select('*, announcements(*)').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('reviews').select('*').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('disputes').select('*, transaction:transactions(*, announcements(*))').order('created_at', { ascending: false }),
      supabaseAdmin.from('chat_violations').select('*').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('announcements').select('*').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('vetrina_items').select('*').order('created_at', { ascending: false }).limit(300),
      supabaseAdmin.from('baratti').select('*').order('created_at', { ascending: false }).limit(200),
    ])

    const profili = profiliRes.data || []
    const perId = new Map(profili.map(p => [p.id, p]))
    const etichetta = (id: string | null | undefined) => {
      if (!id) return 'N/D'
      const p = perId.get(id)
      return p ? (p.nickname || p.first_name || p.email || id) : id
    }
    const emailDi = (id: string | null | undefined) => (id ? perId.get(id)?.email || 'N/D' : 'N/D')

    // Le associazioni fra id e persone le facciamo qui, una volta sola,
    // invece che nel browser a ogni render.
    const transazioni = (transazioniRes.data || []).map(t => ({
      ...t,
      buyerEmail: emailDi(t.buyer_id),
      sellerEmail: emailDi(t.seller_id),
    }))

    const recensioni = (recensioniRes.data || []).map(r => ({
      ...r,
      reviewerEmail: emailDi(r.reviewer_id),
      reviewedEmail: emailDi(r.reviewed_id),
    }))

    const segnalazioni = (segnalazioniRes.data || []).map(v => ({
      ...v,
      senderEmail: emailDi(v.sender_id),
      receiverEmail: emailDi(v.receiver_id),
      senderBanned: !!perId.get(v.sender_id)?.is_banned,
      receiverBanned: !!perId.get(v.receiver_id)?.is_banned,
    }))

    const annunci = (annunciRes.data || []).map(a => ({ ...a, autore: etichetta(a.user_id) }))
    const vetrina = (vetrinaRes.data || []).map(v => ({ ...v, autore: etichetta(v.user_id) }))
    const baratti = (barattiRes.data || []).map(b => ({
      ...b,
      proponente: etichetta(b.user_a_id),
      destinatario: etichetta(b.user_b_id),
    }))

    // Numeri di riepilogo calcolati sul server, sui dati completi.
    const conclusi = transazioni.filter(t => t.status === 'Ricevuto' || t.status === 'Concluso')
    const riepilogo = {
      utenti: profili.length,
      utentiBloccati: profili.filter(p => p.is_banned).length,
      annunciAttivi: annunci.filter(a => (a.quantity ?? 1) > 0).length,
      annunciTotali: annunci.length,
      ordiniTotali: transazioni.length,
      ordiniInCorso: transazioni.filter(t => ['held', 'Pagato', 'Spedito'].includes(t.status)).length,
      ordiniInContestazione: transazioni.filter(t => t.status === 'In Contestazione').length,
      controversieAperte: (controversieRes.data || []).filter((d: { status?: string }) => !String(d.status || '').startsWith('Risolta')).length,
      segnalazioniDaEsaminare: segnalazioni.filter(v => !v.reviewed).length,
      // La commissione del 10% sul valore degli ordini davvero conclusi.
      incassoCommissioni: Math.round(
        conclusi.reduce((acc, t) => acc + (Number(t.announcements?.price) || 0) * 0.10, 0) * 100
      ) / 100,
    }

    return NextResponse.json({
      riepilogo,
      profili,
      transazioni,
      recensioni,
      controversie: controversieRes.data || [],
      segnalazioni,
      annunci,
      vetrina,
      baratti,
    })
  } catch (err) {
    console.error('[Staff/Data] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
