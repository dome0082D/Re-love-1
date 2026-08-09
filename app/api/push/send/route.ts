import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export const dynamic = 'force-dynamic'

// ⚠️ QUESTA ROUTE RICHIEDE UN PACCHETTO CHE NON È ANCORA NEL TUO PROGETTO.
// Nel terminale, dentro la cartella del progetto:
//
//     npm install web-push
//
// Non ho potuto installarlo e provarlo io stesso nel mio ambiente (blocco
// di rete), quindi te lo dico chiaramente invece di fingere di averlo
// testato dal vivo: il codice segue esattamente la documentazione ufficiale
// della libreria, ma la prima prova reale la farai tu.
//
// Servono anche le chiavi VAPID (già generate e verificate) come variabili
// d'ambiente, sia in locale (.env) sia su Vercel:
//
//   VAPID_PUBLIC_KEY=BNYjRxDatT15Go3S9CeTOIzU4jBQ1ewFNgABuzEqM-ce45crEwPpPjhvxTKEIg0ro29rxF5s2Co0c8Sn3hdf1kc
//   VAPID_PRIVATE_KEY=R1DRwt0CQi38SkkQPnodmii15BXwo_u_-2cIde8hn_Y
//
// La chiave pubblica serve ANCHE lato browser (per iscriversi): mettila
// pure anche come NEXT_PUBLIC_VAPID_PUBLIC_KEY con lo stesso valore.

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

let vapidConfigured = false
function assicuraVapid() {
  if (vapidConfigured) return
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY non configurate nelle variabili d\'ambiente.')
  }
  webpush.setVapidDetails(
    'mailto:dome0082@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  vapidConfigured = true
}

// Manda una notifica push reale a TUTTI i dispositivi su cui l'utente ha
// dato il consenso. Va chiamata da dove già nasce una notifica in-app
// (es. dopo aver inserito una riga in "notifications" - vedi i commenti
// nei punti da collegare più sotto nella spiegazione).
export async function POST(req: NextRequest) {
  try {
    assicuraVapid()

    const { userId, title, body, url } = await req.json()
    if (!userId || !body) {
      return NextResponse.json({ error: 'Dati mancanti (userId, body).' }, { status: 400 })
    }

    const { data: iscrizioni, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)

    if (error) {
      console.error('Errore lettura iscrizioni push:', error)
      return NextResponse.json({ error: 'Errore database.' }, { status: 500 })
    }

    if (!iscrizioni || iscrizioni.length === 0) {
      // Non è un errore: l'utente semplicemente non ha mai dato il consenso
      // alle notifiche push, o le ha disattivate. Rispondiamo comunque "ok"
      // per non far fallire chi ci chiama.
      return NextResponse.json({ ok: true, inviate: 0 })
    }

    const payload = JSON.stringify({
      title: title || 'Re-love',
      body,
      url: url || '/',
    })

    let inviate = 0
    // Inviamo a OGNI dispositivo separatamente: se uno fallisce (es.
    // l'utente ha disinstallato l'app da un telefono vecchio), non deve
    // bloccare l'invio agli altri.
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
      } catch (errInvio: any) {
        console.error('Invio push fallito per un dispositivo:', errInvio?.statusCode, errInvio?.message)
        // Codice 410 = "Gone": l'iscrizione non esiste più (utente ha
        // disinstallato, cambiato browser, ecc.). La rimuoviamo per non
        // riprovare all'infinito su un dispositivo che non c'è più.
        if (errInvio?.statusCode === 410 || errInvio?.statusCode === 404) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', iscrizione.id)
        }
      }
    }

    return NextResponse.json({ ok: true, inviate, totali: iscrizioni.length })
  } catch (err: any) {
    console.error('Errore invio notifiche push:', err)
    return NextResponse.json({ error: err?.message || 'Errore di connessione.' }, { status: 500 })
  }
}