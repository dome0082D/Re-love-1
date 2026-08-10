// lib/pushNotify.ts
//
// Piccola funzione di comodo: manda una notifica push VERA (arriva anche ad
// app chiusa) allo stesso utente per cui hai appena creato una notifica
// in-app nella tabella "notifications". Usala SUBITO DOPO ogni
// supabase.from('notifications').insert(...) già presente nel sito.
//
// Volutamente non lancia mai un'eccezione: una notifica push mancata non
// deve MAI far fallire l'azione principale (mandare un messaggio, fare
// un'offerta, ecc.) - nel peggiore dei casi l'utente riceve solo la
// notifica in-app, non il push.
export async function pushNotify(userId: string, title: string, body: string, url?: string) {
  try {
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, title, body, url: url || '/' }),
    })
  } catch (err) {
    console.warn('Notifica push non inviata (non bloccante):', err)
  }
}