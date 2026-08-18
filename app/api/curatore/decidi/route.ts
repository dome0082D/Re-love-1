// app/api/curatore/decidi/route.ts
//
// ============================================================================
// IL PROPRIETARIO ACCETTA O RIFIUTA UNA CANDIDATURA.
// (E il curatore può ritirare la propria, finché è ancora in attesa.)
//
// È il punto in cui una persona viene davvero autorizzata a vendere l'oggetto
// di un'altra e a incassarne una parte. Per questo:
//
//   - chi decide viene riconosciuto dal token di sessione, non dal JSON;
//   - le condizioni vengono ricontrollate ADESSO, non al momento della
//     candidatura: fra l'una e l'altra possono essere passati giorni, e nel
//     frattempo l'oggetto può aver già preso un curatore, o il conto del
//     candidato può essersi disabilitato;
//   - accettando una candidatura, le altre in attesa sullo stesso oggetto
//     vengono chiuse e le persone avvisate, invece di restare appese.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { notificaUtente } from '@/lib/pushServer'
import { statoContoStripe } from '@/lib/stripeAccount'
import { STATI_CANDIDATURA, quotaProprietario } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })

    const { candidaturaId, azione } = await req.json()
    if (!candidaturaId || !['accetta', 'rifiuta', 'ritira'].includes(azione)) {
      return NextResponse.json({ error: 'Dati mancanti o azione non valida.' }, { status: 400 })
    }

    const { data: candidatura } = await supabaseAdmin
      .from('curator_candidature')
      .select('*')
      .eq('id', candidaturaId)
      .maybeSingle()

    if (!candidatura) {
      return NextResponse.json({ error: 'Candidatura non trovata.' }, { status: 404 })
    }
    if (candidatura.stato !== STATI_CANDIDATURA.inAttesa) {
      return NextResponse.json({ error: 'Questa candidatura è già stata gestita.' }, { status: 400 })
    }

    // Accettare e rifiutare spettano al Proprietario; ritirare al candidato.
    const chiDecide = azione === 'ritira' ? candidatura.curator_id : candidatura.owner_id
    if (utente.id !== chiDecide) {
      return NextResponse.json({
        error: azione === 'ritira'
          ? 'Puoi ritirare solo una candidatura tua.'
          : 'Solo il proprietario dell\'oggetto può rispondere a questa candidatura.',
      }, { status: 403 })
    }

    const { data: annuncio } = await supabaseAdmin
      .from('announcements')
      .select('id, user_id, title, curator_id')
      .eq('id', candidatura.announcement_id)
      .maybeSingle()

    if (!annuncio) {
      return NextResponse.json({ error: "L'oggetto di questa candidatura non esiste più." }, { status: 404 })
    }

    const titolo = annuncio.title || 'oggetto'
    const adesso = new Date().toISOString()

    // ------------------------------------------------------- RIFIUTO / RITIRO
    if (azione === 'rifiuta' || azione === 'ritira') {
      const { data: aggiornate } = await supabaseAdmin
        .from('curator_candidature')
        .update({ stato: STATI_CANDIDATURA.rifiutata, decided_at: adesso })
        .eq('id', candidatura.id)
        .eq('stato', STATI_CANDIDATURA.inAttesa)
        .select('id')

      if (!aggiornate?.length) {
        return NextResponse.json({ error: 'Questa candidatura è già stata gestita.' }, { status: 409 })
      }

      if (azione === 'rifiuta') {
        await notificaUtente(
          candidatura.curator_id,
          `La tua candidatura come curatore per "${titolo}" non è stata accettata.`,
          'Candidatura non accettata',
          '/curatore'
        )
      } else {
        await notificaUtente(
          candidatura.owner_id,
          `Una candidatura come curatore per "${titolo}" è stata ritirata.`,
          'Candidatura ritirata',
          '/curatore'
        )
      }
      return NextResponse.json({ ok: true, stato: STATI_CANDIDATURA.rifiutata })
    }

    // ------------------------------------------------------------ ACCETTAZIONE
    if (annuncio.curator_id) {
      return NextResponse.json({
        error: annuncio.curator_id === candidatura.curator_id
          ? 'Questa persona è già il curatore di questo oggetto.'
          : 'Questo oggetto ha già un curatore: revocalo prima di accettarne un altro.',
      }, { status: 409 })
    }

    // Ricontrollato adesso, non al momento della candidatura: un conto Stripe
    // può essere stato disabilitato nel frattempo, e accettare qualcuno che
    // non può incassare significa scoprirlo a vendita già pagata.
    const { data: profiloCuratore } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', candidatura.curator_id)
      .maybeSingle()

    const conto = await statoContoStripe(profiloCuratore?.stripe_account_id)
    if (!conto.pronto) {
      return NextResponse.json({
        error: 'Questa persona al momento non può ricevere pagamenti, quindi non potrebbe incassare la sua parte. Chiedile di completare la configurazione del conto, poi riprova.',
      }, { status: 400 })
    }

    const { data: accettate } = await supabaseAdmin
      .from('curator_candidature')
      .update({ stato: STATI_CANDIDATURA.accettata, decided_at: adesso })
      .eq('id', candidatura.id)
      .eq('stato', STATI_CANDIDATURA.inAttesa)
      .select('id')

    if (!accettate?.length) {
      return NextResponse.json({ error: 'Questa candidatura è già stata gestita.' }, { status: 409 })
    }

    // L'annuncio prende il curatore. "owner_id" viene riempito adesso: da qui
    // in poi il pagamento si divide, e la parte del Proprietario va cercata lì
    // (vedi app/api/stripe/checkout). "mandate_id" punta alla candidatura: è
    // il posto da cui il pagamento legge le percentuali concordate.
    const { data: annunciAggiornati, error: erroreAnnuncio } = await supabaseAdmin
      .from('announcements')
      .update({
        curator_id: candidatura.curator_id,
        owner_id: annuncio.user_id,
        mandate_id: candidatura.id,
        cerca_curatore: false,
      })
      .eq('id', annuncio.id)
      .select('id')

    if (erroreAnnuncio || !annunciAggiornati?.length) {
      // Rimettiamo la candidatura come prima: meglio un'accettazione da
      // rifare che un curatore "accettato" su un annuncio che non lo sa.
      await supabaseAdmin
        .from('curator_candidature')
        .update({ stato: STATI_CANDIDATURA.inAttesa, decided_at: null })
        .eq('id', candidatura.id)
      console.error('[Curatore/Decidi] Annuncio non aggiornato:', erroreAnnuncio)
      return NextResponse.json({ error: "Non è stato possibile assegnare il curatore all'oggetto." }, { status: 500 })
    }

    // Le altre persone in attesa sullo stesso oggetto: chiuse e avvisate,
    // invece di restare appese a una risposta che non arriverà mai.
    const { data: scartate } = await supabaseAdmin
      .from('curator_candidature')
      .update({ stato: STATI_CANDIDATURA.rifiutata, decided_at: adesso })
      .eq('announcement_id', annuncio.id)
      .eq('stato', STATI_CANDIDATURA.inAttesa)
      .select('curator_id')

    for (const s of scartate || []) {
      await notificaUtente(
        s.curator_id,
        `Per "${titolo}" è stato scelto un altro curatore.`,
        'Candidatura non accettata',
        '/curatore'
      )
    }

    const quotaCuratore = Number(candidatura.curator_percentage)
    await notificaUtente(
      candidatura.curator_id,
      `Sei stato scelto come curatore di "${titolo}". Puoi gestirne la vendita: ti spetta il ${quotaCuratore}% dell'incasso.`,
      'Candidatura accettata',
      `/announcement/${annuncio.id}`,
      true
    )

    return NextResponse.json({
      ok: true,
      stato: STATI_CANDIDATURA.accettata,
      quotaCuratore,
      quotaProprietario: quotaProprietario(quotaCuratore),
    })
  } catch (err) {
    console.error('[Curatore/Decidi] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
