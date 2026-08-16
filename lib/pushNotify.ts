// lib/pushNotify.ts
//
// Unico modo corretto, dal browser, di far arrivare una notifica a un utente.
//
// ============================================================================
// COSA C'ERA PRIMA, E PERCHÉ NON FUNZIONAVA
//
// Il sito creava le notifiche direttamente dal browser:
//
//     await supabase.from('notifications').insert([{ user_id: <ALTRO>, ... }])
//     pushNotify(<ALTRO>, ...)   // solo in 5 punti su 23
//
// Quella insert è vietata dalla Row Level Security: con la chiave anonima un
// utente non può scrivere una riga intestata a un altro utente. Il database
// rispondeva 401 ("new row violates row-level security policy"), ma siccome
// nessuna di quelle chiamate controllava l'errore, il fallimento era
// invisibile: nessuna notifica veniva mai creata per il destinatario.
//
// "inviaNotifica" qui sotto passa invece dalla route /api/notify, che scrive
// con la chiave di servizio dopo aver verificato l'identità del mittente, e
// manda anche la push nella stessa chiamata. Un solo posto da chiamare,
// niente più coppie insert+push da tenere allineate a mano.
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface Notifica {
  /** Destinatario. */
  userId: string
  /** Testo mostrato sia in-app sia nella notifica di sistema. */
  message: string
  /** Titolo della notifica push (in-app non viene usato). */
  title?: string
  /** Pagina da aprire toccando la notifica push. */
  url?: string
}

/**
 * Manda una o più notifiche. Non lancia mai eccezioni: una notifica non
 * consegnata non deve far fallire l'azione che l'ha generata (un pagamento,
 * un messaggio, una proposta).
 *
 * Restituisce true se il server ha confermato la creazione, così chi chiama
 * PUÒ accorgersene se vuole - a differenza di prima, dove non c'era modo.
 */
export async function inviaNotifica(notifiche: Notifica | Notifica[]): Promise<boolean> {
  const elenco = Array.isArray(notifiche) ? notifiche : [notifiche]
  const valide = elenco.filter(n => n?.userId && n?.message)
  if (valide.length === 0) return false

  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      console.warn('Notifica non inviata: sessione assente.')
      return false
    }

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ notifiche: valide }),
    })

    if (!res.ok) {
      console.warn('Notifica non inviata:', res.status, await res.text().catch(() => ''))
      return false
    }

    const data = await res.json()
    return !!data.ok
  } catch (err) {
    console.warn('Notifica non inviata (non bloccante):', err)
    return false
  }
}

/**
 * Vecchia funzione, mantenuta perché già chiamata in vari punti del sito.
 * Ora crea ANCHE la notifica in-app, non solo la push: prima le due cose
 * andavano scritte separatamente e nella pratica venivano dimenticate.
 */
export async function pushNotify(userId: string, title: string, body: string, url?: string) {
  await inviaNotifica({ userId, message: body, title, url })
}
