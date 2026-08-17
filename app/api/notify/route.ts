// app/api/notify/route.ts
//
// ============================================================================
// PERCHÉ QUESTA ROUTE ESISTE — la causa per cui le notifiche non arrivavano.
//
// In tutto il sito le notifiche venivano create direttamente dal browser:
//
//     await supabase.from('notifications').insert([{ user_id: <ALTRO utente>, ... }])
//
// Ma la tabella "notifications" ha la Row Level Security attiva, e con la
// chiave anonima un utente non può scrivere una riga intestata a QUALCUN
// ALTRO. Verificato sul database di produzione:
//
//     INSERT notifications con chiave anonima -> 401
//     {"code":"42501","message":"new row violates row-level security policy
//      for table \"notifications\""}
//
// Siccome quasi tutte le chiamate erano scritte come "await ...insert(...)"
// senza controllare l'errore, il fallimento passava del tutto inosservato:
// l'app diceva "proposta inviata", "messaggio inviato", "ordine confermato",
// e al destinatario non arrivava assolutamente niente. Nel database c'erano
// in tutto 4 notifiche.
//
// Qui la riga viene scritta con la chiave di SERVIZIO, che scavalca la RLS -
// come è corretto per un'operazione server-to-server - ma solo dopo aver
// verificato con il token di sessione firmato CHI sta chiedendo. E nella
// stessa chiamata parte anche la notifica push, così non serve più
// ricordarsi di aggiungere pushNotify() accanto a ogni insert (cosa che
// infatti era stata fatta solo in 5 punti su 23).
// ============================================================================

import { NextResponse } from 'next/server'
import { verificaUtente } from '@/lib/serverAuth'
import { notificaUtente } from '@/lib/pushServer'

export const dynamic = 'force-dynamic'

// Limite di lunghezza: il messaggio finisce sia in una notifica di sistema
// del telefono sia in un popup. Oltre questa soglia è comunque troncato
// dal sistema operativo, e una richiesta enorme è quasi sempre un errore.
const MAX_MESSAGGIO = 500

export async function POST(req: Request) {
  try {
    const mittente = await verificaUtente(req)
    if (!mittente) {
      return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })
    }

    const body = await req.json()
    // Accetta sia una notifica singola sia un elenco: parecchie azioni ne
    // mandano due insieme (es. compratore + venditore), e farlo in una sola
    // richiesta evita due giri di rete dal telefono.
    const richieste: unknown[] = Array.isArray(body?.notifiche) ? body.notifiche : [body]

    const esiti: { userId: string; ok: boolean }[] = []

    for (const voce of richieste) {
      const n = voce as { userId?: string; message?: string; title?: string; url?: string; email?: boolean }
      if (!n?.userId || !n?.message) continue

      const messaggio = String(n.message).slice(0, MAX_MESSAGGIO)

      // Una sola chiamata copre notifica in-app + push + (se richiesto)
      // email: prima erano tre cose separate da ricordarsi ogni volta.
      await notificaUtente(
        n.userId,
        messaggio,
        n.title || 'Re-love',
        n.url || '/',
        !!n.email
      )
      esiti.push({ userId: n.userId, ok: true })
    }

    if (esiti.length === 0) {
      return NextResponse.json({ error: 'Nessuna notifica valida nella richiesta.' }, { status: 400 })
    }

    return NextResponse.json({ ok: esiti.every(e => e.ok), esiti })
  } catch (err) {
    console.error('[Notify] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
