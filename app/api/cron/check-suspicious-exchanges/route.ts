// app/api/cron/check-suspicious-exchanges/route.ts
// Gira una volta al giorno (vedi vercel.json). Per ogni caso sospetto la
// cui finestra di osservazione è scaduta:
//   - se nel frattempo risulta una transazione VERA conclusa tra i due
//     utenti coinvolti, il caso si chiude senza conseguenze
//   - altrimenti, entrambi vengono bloccati e il caso finisce nella
//     stessa tabella "chat_violations" già usata dal pannello staff
//     (Segnalazioni Chat), con gli stessi tasti blocca/sblocca già
//     costruiti - nessuna interfaccia nuova da costruire per lo staff.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

// Considerati "scambio vero concluso" - gli stessi stati finali già usati
// nel resto del progetto per vendite e baratti conclusi con successo.
const STATI_SCAMBIO_CONCLUSO = ['Ricevuto', 'Concluso']

export async function GET(req: NextRequest) {
  // Protezione standard per gli endpoint cron di Vercel: solo Vercel
  // stesso (con il segreto giusto) può farli scattare, altrimenti
  // chiunque conoscesse l'indirizzo potrebbe forzare blocchi a piacere.
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  }

  try {
    const { data: casiScaduti, error } = await supabaseAdmin
      .from('suspicious_exchanges')
      .select('*')
      .eq('resolved', false)
      .lt('grace_period_ends_at', new Date().toISOString())

    if (error) {
      console.error('[CheckSuspicious] Errore lettura casi:', error)
      return NextResponse.json({ error: 'Errore database.' }, { status: 500 })
    }

    if (!casiScaduti || casiScaduti.length === 0) {
      return NextResponse.json({ ok: true, esaminati: 0 })
    }

    let bloccati = 0
    let risolti = 0

    for (const caso of casiScaduti) {
      // C'è una transazione vera tra questi due utenti (in un verso o
      // nell'altro - non sappiamo chi tra i due sarebbe stato compratore o
      // venditore), avvenuta DOPO il messaggio sospetto?
      const { data: transazioneVera } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .in('status', STATI_SCAMBIO_CONCLUSO)
        .gte('created_at', caso.flagged_at)
        .or(
          `and(buyer_id.eq.${caso.sender_id},seller_id.eq.${caso.receiver_id}),and(buyer_id.eq.${caso.receiver_id},seller_id.eq.${caso.sender_id})`
        )
        .limit(1)
        .maybeSingle()

      if (transazioneVera) {
        await supabaseAdmin
          .from('suspicious_exchanges')
          .update({ resolved: true, outcome: 'scambio_concluso', resolved_at: new Date().toISOString() })
          .eq('id', caso.id)
        risolti++
        continue
      }

      // Nessuna transazione vera trovata: il tempo è scaduto, blocchiamo
      // entrambi gli utenti - stessa identica azione già usata dal blocco
      // immediato di prima, solo posticipata.
      await supabaseAdmin
        .from('profiles')
        .update({
          is_banned: true,
          banned_reason: 'Tentativo di accordo fuori piattaforma rilevato in chat, non seguito da uno scambio concluso su Re-love entro i tempi previsti.',
          banned_at: new Date().toISOString(),
        })
        .in('id', [caso.sender_id, caso.receiver_id])

      await supabaseAdmin
        .from('chat_violations')
        .insert([{
          sender_id: caso.sender_id,
          receiver_id: caso.receiver_id,
          message_content: caso.message_content,
          reviewed: false,
        }])

      await supabaseAdmin
        .from('suspicious_exchanges')
        .update({ resolved: true, outcome: 'bloccato', resolved_at: new Date().toISOString() })
        .eq('id', caso.id)

      bloccati++
    }

    return NextResponse.json({ ok: true, esaminati: casiScaduti.length, bloccati, risolti })
  } catch (err) {
    console.error('[CheckSuspicious] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}