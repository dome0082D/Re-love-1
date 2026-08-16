// lib/azioniUtente.ts
//
// Funzioni lato browser per le azioni che il database NON permette di fare
// direttamente con la chiave anonima.
//
// ============================================================================
// IL PROBLEMA COMUNE
//
// Diverse tabelle hanno la Row Level Security attiva ma nessuna policy per
// l'operazione richiesta. In quel caso PostgREST non restituisce un errore:
// risponde 200 e tocca ZERO righe. Tutto il sito interpretava quel 200 come
// "riuscito", aggiornava la schermata di conseguenza, e l'utente vedeva
// l'azione andare a buon fine - salvo ritrovare tutto com'era prima al
// ricaricamento successivo. Verificato in produzione:
//
//     DELETE messages (proprio)        -> 200, 0 righe
//     UPDATE notifications is_read     -> 200, 0 righe
//     DELETE notifications (propria)   -> 200, 0 righe
//     INSERT favorites                 -> 403 (RLS)
//     INSERT bids                      -> 403 (RLS)
//
// Queste funzioni passano tutte da route server che verificano l'identità
// con il token di sessione firmato e riferiscono QUANTE righe hanno davvero
// toccato, così un fallimento non può più passare inosservato.
// ============================================================================

import { supabase } from '@/lib/supabase'

export interface Esito {
  ok: boolean
  errore?: string
  /** Vero quando l'operazione è stata fatta da staff su roba altrui. */
  comeStaff?: boolean
  /** Stato finale del preferito, per il solo toggle dei preferiti. */
  preferito?: boolean
}

async function chiama(percorso: string, corpo: unknown): Promise<Esito> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return { ok: false, errore: 'Sessione scaduta: rientra e riprova.' }

    const res = await fetch(percorso, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(corpo),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok || data.error) return { ok: false, errore: data.error || 'Operazione non riuscita.' }
    return { ok: true, comeStaff: !!data.comeStaff, preferito: data.preferito }
  } catch (err) {
    console.error('Errore chiamata a', percorso, err)
    return { ok: false, errore: 'Errore di connessione.' }
  }
}

/** Elimina un messaggio scritto da me (o qualsiasi messaggio, se sono staff). */
export function eliminaMessaggio(messageId: string): Promise<Esito> {
  return chiama('/api/messages/delete', { messageId })
}

/** Solo staff: cancella tutti i messaggi fra due utenti. */
export function eliminaConversazione(utenteA: string, utenteB: string): Promise<Esito> {
  return chiama('/api/messages/delete', { utenteA, utenteB })
}

/** Segna come lette tutte le mie notifiche non lette. */
export function segnaNotificheLette(): Promise<Esito> {
  return chiama('/api/notifications', { azione: 'segna-lette' })
}

/** Elimina una mia notifica. */
export function eliminaNotifica(notificationId: string): Promise<Esito> {
  return chiama('/api/notifications', { azione: 'elimina', notificationId })
}

/** Elimina tutte le mie notifiche. */
export function eliminaTutteLeNotifiche(): Promise<Esito> {
  return chiama('/api/notifications', { azione: 'elimina-tutte' })
}

/** Aggiunge o toglie un annuncio dai miei preferiti. */
export function alternaPreferito(announcementId: string): Promise<Esito> {
  return chiama('/api/favorites', { announcementId })
}

/** Registra un rilancio d'asta. */
export function registraRilancio(announcementId: string, importo: number): Promise<Esito> {
  return chiama('/api/bids', { announcementId, importo })
}
