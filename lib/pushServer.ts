// lib/pushServer.ts
//
// Invio vero delle notifiche push (quelle che arrivano anche ad app chiusa).
// Sta in lib/ e non dentro una route perché serve da due punti: la route
// /api/push/send (invio diretto) e /api/notify (che crea la notifica in-app
// e manda il push nella stessa chiamata).

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

let vapidConfigured = false

/**
 * Configura le chiavi VAPID. Restituisce false (senza lanciare) se non sono
 * impostate: una notifica push mancata non deve mai far fallire l'azione
 * principale che l'ha generata.
 */
function assicuraVapid(): boolean {
  if (vapidConfigured) return true
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY non configurate: push non inviate.')
    return false
  }
  webpush.setVapidDetails(
    `mailto:${process.env.STAFF_EMAIL || 'dome0082@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
  return true
}

export interface EsitoPush {
  inviate: number
  totali: number
  motivo?: string
}

/**
 * Manda una notifica push a TUTTI i dispositivi su cui l'utente ha dato il
 * consenso. Non lancia mai eccezioni.
 */
export async function inviaPushAUtente(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<EsitoPush> {
  try {
    if (!userId || !body) return { inviate: 0, totali: 0, motivo: 'dati mancanti' }
    if (!assicuraVapid()) return { inviate: 0, totali: 0, motivo: 'VAPID non configurate' }

    const { data: iscrizioni, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('[Push] Errore lettura iscrizioni:', error)
      return { inviate: 0, totali: 0, motivo: 'errore database' }
    }
    if (!iscrizioni || iscrizioni.length === 0) {
      // Non è un errore: l'utente non ha mai dato il consenso alle push, o
      // le ha disattivate. La notifica in-app resta comunque.
      return { inviate: 0, totali: 0, motivo: 'nessun dispositivo iscritto' }
    }

    const payload = JSON.stringify({ title: title || 'Re-love', body, url: url || '/' })

    let inviate = 0
    // Uno per uno: se un dispositivo fallisce (telefono vecchio, app
    // disinstallata) non deve bloccare l'invio agli altri.
    for (const iscrizione of iscrizioni) {
      try {
        await webpush.sendNotification(
          {
            endpoint: iscrizione.endpoint,
            keys: { p256dh: iscrizione.p256dh, auth: iscrizione.auth },
          },
          payload
        )
        inviate++
      } catch (errInvio: unknown) {
        const e = errInvio as { statusCode?: number; message?: string }
        console.error('[Push] Invio fallito per un dispositivo:', e?.statusCode, e?.message)
        // 410 "Gone" / 404: l'iscrizione non esiste più. La togliamo per non
        // riprovare all'infinito verso un dispositivo che non c'è più.
        if (e?.statusCode === 410 || e?.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', iscrizione.id)
        }
      }
    }

    return { inviate, totali: iscrizioni.length }
  } catch (err) {
    console.error('[Push] Errore imprevisto:', err)
    return { inviate: 0, totali: 0, motivo: 'errore imprevisto' }
  }
}

/**
 * Da usare nelle route server: crea la notifica in-app E manda la push, in
 * un colpo solo. Prima queste due cose andavano scritte separatamente, e in
 * pratica la push veniva quasi sempre dimenticata (era presente in 5 punti
 * su 23). Non lancia mai eccezioni: un avviso non consegnato non deve far
 * fallire un pagamento o un'approvazione già andati a buon fine.
 */
export async function notificaUtente(
  userId: string | null | undefined,
  message: string,
  title = 'Re-love',
  url = '/',
  // NUOVO: manda ANCHE un'email. Da usare solo per gli eventi che contano
  // davvero (soldi, stato di un ordine, controversie): un'email per ogni
  // avviso sarebbe spam, e finirebbe per far ignorare anche quelle utili.
  ancheEmail = false
): Promise<void> {
  if (!userId || !message) return
  try {
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert([{ user_id: userId, message, is_read: false }])
    if (error) console.error('[Notifica] Inserimento fallito:', error)
  } catch (err) {
    console.error('[Notifica] Errore inserimento:', err)
  }
  await inviaPushAUtente(userId, title, message, url)
  if (ancheEmail) await inviaEmailAUtente(userId, title, message, url)
}

/**
 * Manda l'email corrispondente a una notifica.
 *
 * FIX: lib/mail.ts esisteva ma NON era importato da nessun file del
 * progetto, e /api/notofy non veniva chiamata da nessuna parte: l'intero
 * sistema di posta era scritto e mai collegato: nessun utente ha mai
 * ricevuto un'email da Re-love. Qui viene agganciato al punto in cui
 * nascono già tutti gli avvisi.
 *
 * Se RESEND_API_KEY non è configurata la funzione esce senza fare nulla e
 * senza lanciare: notifica in-app e push restano comunque consegnate.
 */
async function inviaEmailAUtente(
  userId: string,
  titolo: string,
  messaggio: string,
  url: string
): Promise<void> {
  try {
    if (!process.env.RESEND_API_KEY) return

    const { data: profilo } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, nickname')
      .eq('id', userId)
      .maybeSingle()

    if (!profilo?.email) return

    const sito = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love-rouge.vercel.app'
    const nome = profilo.nickname || profilo.first_name
    const corpo = nome ? `Ciao ${nome},\n\n${messaggio}` : messaggio

    const { sendReLoveEmail } = await import('@/lib/mail')
    const esito = await sendReLoveEmail(
      profilo.email,
      titolo,
      titolo,
      corpo,
      'Apri Re-love',
      `${sito}${url.startsWith('/') ? url : '/' + url}`
    )
    if (!esito.ok) console.warn('[Email] Non inviata:', esito.error)
  } catch (err) {
    console.error('[Email] Errore invio:', err)
  }
}
