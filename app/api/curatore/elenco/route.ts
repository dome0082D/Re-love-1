// app/api/curatore/elenco/route.ts
//
// Le candidature che riguardano chi chiede: quelle che ha inviato (come
// aspirante curatore) e quelle che ha ricevuto (come proprietario di un
// oggetto). Serve alla pagina Curatore Locale.
//
// Passa dal server invece di leggere direttamente dal browser per due
// motivi: unisce in un colpo solo i dati degli annunci e i nomi delle
// persone, e soprattutto risponde con numeri di righe veri. Leggendo dal
// browser, una policy RLS mancante non dà errore: PostgREST risponde "200
// con zero righe", e la pagina mostrerebbe "nessuna candidatura" a chi ne
// ha invece diverse in attesa.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { STATI_CANDIDATURA } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })

    const { data: righe, error } = await supabaseAdmin
      .from('curator_candidature')
      .select('*')
      .or(`curator_id.eq.${utente.id},owner_id.eq.${utente.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Curatore/Elenco] Errore lettura:', error)
      return NextResponse.json({ error: 'Errore nella lettura delle candidature.' }, { status: 500 })
    }

    const candidature = righe || []
    const idAnnunci = [...new Set(candidature.map(c => c.announcement_id))]
    const idPersone = [...new Set(candidature.flatMap(c => [c.curator_id, c.owner_id]))]

    const [{ data: annunci }, { data: persone }] = await Promise.all([
      idAnnunci.length
        ? supabaseAdmin.from('announcements').select('id, title, price, image_url').in('id', idAnnunci)
        : Promise.resolve({ data: [] as any[] }),
      idPersone.length
        ? supabaseAdmin.from('profiles').select('id, first_name, nickname, email').in('id', idPersone)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const perAnnuncio = new Map((annunci || []).map(a => [a.id, a]))
    const perPersona = new Map((persone || []).map(p => [p.id, p]))
    const nomeDi = (id: string) => {
      const p = perPersona.get(id)
      return p?.nickname || p?.first_name || p?.email?.split('@')[0] || 'Utente'
    }

    const arricchite = candidature.map(c => {
      const a = perAnnuncio.get(c.announcement_id)
      return {
        id: c.id,
        stato: c.stato,
        percentualeCuratore: Number(c.curator_percentage),
        messaggio: c.messaggio,
        creataIl: c.created_at,
        decisaIl: c.decided_at,
        // Il link personale e le sue visite: e' da qui che il curatore
        // guadagna, quindi deve poterlo copiare e capire se sta funzionando.
        codicePersonale: c.tracking_code || null,
        visite: c.clicks || 0,
        scadeIl: c.scade_il || null,
        annuncioId: c.announcement_id,
        titolo: a?.title || 'Oggetto non più disponibile',
        prezzo: a?.price ?? null,
        immagine: a?.image_url || null,
        curatoreId: c.curator_id,
        curatoreNome: nomeDi(c.curator_id),
        proprietarioId: c.owner_id,
        proprietarioNome: nomeDi(c.owner_id),
      }
    })

    const inviate = arricchite.filter(c => c.curatoreId === utente.id)
    const ricevute = arricchite.filter(c => c.proprietarioId === utente.id)

    return NextResponse.json({
      inviate,
      ricevute,
      daRispondere: ricevute.filter(c => c.stato === STATI_CANDIDATURA.inAttesa).length,
    })
  } catch (err) {
    console.error('[Curatore/Elenco] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
