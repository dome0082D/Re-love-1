// app/api/cron/scadenza-incarichi-curatore/route.ts
//
// ============================================================================
// GLI INCARICHI FERMI DECADONO DA SOLI.
//
// Gira una volta al giorno (vedi vercel.json). Un curatore accettato e poi
// sparito terrebbe altrimenti l'oggetto bloccato per sempre: nessun altro
// potrebbe candidarsi, e il proprietario dovrebbe accorgersene e revocarlo a
// mano - cosa che in pratica nessuno fa.
//
// Alla scadenza l'incarico si chiude, l'annuncio torna senza curatore e -
// se il proprietario lo stava cercando - torna in cerca, così ricompare fra
// gli oggetti candidabili. Entrambe le persone vengono avvisate: non deve
// essere una sorpresa scoperta per caso.
//
// Un incarico che ha portato almeno una vendita NON viene toccato: ha fatto
// il suo lavoro, e chiuderlo sarebbe una punizione al contrario.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificaUtente } from '@/lib/pushServer'
import { STATI_CANDIDATURA, GIORNI_VALIDITA_INCARICO } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function GET(req: Request) {
  // Stessa protezione degli altri endpoint cron del progetto: solo Vercel,
  // col segreto giusto, può farlo scattare.
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  }

  try {
    const adesso = new Date().toISOString()

    const { data: scaduti, error } = await supabaseAdmin
      .from('curator_candidature')
      .select('id, announcement_id, curator_id, owner_id')
      .eq('stato', STATI_CANDIDATURA.accettata)
      .lt('scade_il', adesso)

    if (error) {
      console.error('[Cron/ScadenzaIncarichi] Errore lettura:', error)
      return NextResponse.json({ error: 'Errore nella lettura.' }, { status: 500 })
    }

    if (!scaduti?.length) {
      return NextResponse.json({ ok: true, chiusi: 0 })
    }

    let chiusi = 0
    for (const incarico of scaduti) {
      // Ha portato vendite? Allora l'incarico ha funzionato: si lascia stare.
      const { count: vendite } = await supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('mandate_id', incarico.id)

      if ((vendite || 0) > 0) {
        // Gli diamo un altro giro invece di chiuderlo: sta producendo.
        await supabaseAdmin
          .from('curator_candidature')
          .update({
            scade_il: new Date(Date.now() + GIORNI_VALIDITA_INCARICO * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', incarico.id)
        continue
      }

      const { data: chiuse } = await supabaseAdmin
        .from('curator_candidature')
        .update({ stato: STATI_CANDIDATURA.revocata, decided_at: adesso })
        .eq('id', incarico.id)
        .eq('stato', STATI_CANDIDATURA.accettata)
        .select('id')

      if (!chiuse?.length) continue
      chiusi++

      const { data: annuncio } = await supabaseAdmin
        .from('announcements')
        .select('id, title')
        .eq('id', incarico.announcement_id)
        .maybeSingle()

      if (annuncio) {
        // L'annuncio torna libero E torna in cerca: il proprietario aveva
        // chiesto aiuto e non l'ha avuto, quindi la richiesta resta aperta
        // per qualcun altro invece di sparire in silenzio.
        await supabaseAdmin
          .from('announcements')
          .update({ curator_id: null, owner_id: null, mandate_id: null, cerca_curatore: true })
          .eq('id', annuncio.id)
      }

      const titolo = annuncio?.title || 'un oggetto'
      await notificaUtente(
        incarico.curator_id,
        `Il tuo incarico di curatore per "${titolo}" è scaduto: in ${GIORNI_VALIDITA_INCARICO} giorni non sono arrivate vendite dal tuo link. Puoi candidarti di nuovo.`,
        'Incarico scaduto',
        '/curatore'
      )
      await notificaUtente(
        incarico.owner_id,
        `L'incarico di curatore per "${titolo}" è scaduto senza vendite. L'oggetto è di nuovo in cerca di un curatore.`,
        'Incarico scaduto',
        '/curatore'
      )
    }

    return NextResponse.json({ ok: true, esaminati: scaduti.length, chiusi })
  } catch (err) {
    console.error('[Cron/ScadenzaIncarichi] Errore:', err)
    return NextResponse.json({ error: 'Errore durante il controllo.' }, { status: 500 })
  }
}
