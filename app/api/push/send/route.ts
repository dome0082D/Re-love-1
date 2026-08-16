import { NextRequest, NextResponse } from 'next/server'
import { inviaPushAUtente } from '@/lib/pushServer'

export const dynamic = 'force-dynamic'

// Invio diretto di una notifica push (senza creare la notifica in-app).
// La logica vera sta in lib/pushServer.ts, condivisa con /api/notify: prima
// era scritta qui dentro, e /api/notify avrebbe dovuto duplicarla.
//
// SERVONO le chiavi VAPID nelle variabili d'ambiente, sia in locale (.env)
// sia su Vercel:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY (stesso valore della pubblica, serve al browser)
// Senza, le push non partono: resta solo la notifica in-app.

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, url } = await req.json()
    if (!userId || !body) {
      return NextResponse.json({ error: 'Dati mancanti (userId, body).' }, { status: 400 })
    }

    const esito = await inviaPushAUtente(userId, title || 'Re-love', body, url || '/')
    return NextResponse.json({ ok: true, ...esito })
  } catch (err) {
    console.error('[Push/Send] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
