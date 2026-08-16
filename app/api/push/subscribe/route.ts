import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

// Salva l'iscrizione alle notifiche push del browser dell'utente, DOPO che
// ha dato esplicitamente il consenso (il permesso del browser viene chiesto
// lato client, prima di arrivare qui - questa route non chiede nulla, si
// limita a registrare un consenso già dato).
export async function POST(req: NextRequest) {
  try {
    const { userId, subscription } = await req.json()

    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Dati di iscrizione incompleti.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .upsert(
        [{
          user_id: userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        }],
        { onConflict: 'user_id,endpoint' }
      )

    if (error) {
      console.error('Errore salvataggio iscrizione push:', error)
      return NextResponse.json({ error: 'Errore nel salvataggio.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Errore route iscrizione push:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}

// Permette di ANNULLARE il consenso (es. l'utente disattiva le notifiche
// dalle impostazioni del telefono, o dal profilo su Re-love).
export async function DELETE(req: NextRequest) {
  try {
    const { userId, endpoint } = await req.json()
    if (!userId || !endpoint) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) {
      console.error('Errore rimozione iscrizione push:', error)
      return NextResponse.json({ error: 'Errore nella rimozione.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Errore route disiscrizione push:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}