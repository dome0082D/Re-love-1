// app/api/curatore/revoke/route.ts
//
// ============================================================================
// SI SCIOGLIE L'ACCORDO FRA PROPRIETARIO E CURATORE.
//
// Lo possono fare tutti e due: il Proprietario revoca l'incarico, il Curatore
// si tira indietro. In entrambi i casi l'annuncio RESTA, e torna semplicemente
// senza curatore.
//
// ============================================================================
// COS'È CAMBIATO RISPETTO A PRIMA
//
// Nel vecchio sistema a QR era il Curatore a creare l'annuncio, quindi
// revocare voleva dire CANCELLARLO e salvarne una copia in "owner_drafts".
// Adesso l'annuncio è del Proprietario fin dall'inizio: cancellarlo sarebbe
// un danno, non una tutela. Si toglie solo il curatore.
//
// Restano due protezioni della versione precedente, perché servono davvero:
//   - l'identità arriva dal token di sessione firmato (prima bastava scrivere
//     l'id giusto nel JSON per far sparire l'annuncio di chiunque);
//   - non si scioglie nulla se c'è una vendita già pagata in corso: si
//     lascerebbe un compratore che ha pagato senza nessuno che gli spedisce.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notificaUtente } from '@/lib/pushServer'
import { verificaUtente } from '@/lib/serverAuth'
import { STATI_CANDIDATURA } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) return NextResponse.json({ error: 'Devi accedere.' }, { status: 401 })

    const { candidaturaId } = await req.json()
    if (!candidaturaId) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }

    const { data: candidatura } = await supabaseAdmin
      .from('curator_candidature')
      .select('*')
      .eq('id', candidaturaId)
      .maybeSingle()

    if (!candidatura) {
      return NextResponse.json({ error: 'Incarico non trovato.' }, { status: 404 })
    }
    if (candidatura.stato !== STATI_CANDIDATURA.accettata) {
      return NextResponse.json({ error: 'Questo incarico non è attivo.' }, { status: 400 })
    }

    const eProprietario = utente.id === candidatura.owner_id
    const eCuratore = utente.id === candidatura.curator_id
    if (!eProprietario && !eCuratore && !utente.isStaff) {
      return NextResponse.json({ error: 'Questo incarico non ti riguarda.' }, { status: 403 })
    }

    const { data: annuncio } = await supabaseAdmin
      .from('announcements')
      .select('id, title')
      .eq('id', candidatura.announcement_id)
      .maybeSingle()

    const titolo = annuncio?.title || 'oggetto'

    // Una vendita già pagata e non ancora conclusa blocca tutto: togliere ora
    // il curatore lascerebbe un compratore che ha pagato e nessuno incaricato
    // di consegnargli la roba.
    if (annuncio) {
      const { data: venditaInCorso } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('announcement_id', annuncio.id)
        .in('status', ['held', 'Pagato', 'Spedito'])
        .limit(1)
        .maybeSingle()

      if (venditaInCorso) {
        return NextResponse.json({
          error: "C'è una vendita in corso su questo oggetto (già pagata, in attesa di consegna). Potrai sciogliere l'incarico quando l'ordine si sarà concluso.",
        }, { status: 400 })
      }
    }

    const { data: chiuse } = await supabaseAdmin
      .from('curator_candidature')
      .update({ stato: STATI_CANDIDATURA.revocata, decided_at: new Date().toISOString() })
      .eq('id', candidatura.id)
      .eq('stato', STATI_CANDIDATURA.accettata)
      .select('id')

    if (!chiuse?.length) {
      return NextResponse.json({ error: 'Questo incarico è già stato chiuso.' }, { status: 409 })
    }

    // L'annuncio resta, ma senza curatore: torna una vendita normale del
    // Proprietario. "cerca_curatore" non viene riacceso da solo - se ne vuole
    // un altro, lo riattiva lui dalla modifica dell'annuncio.
    if (annuncio) {
      await supabaseAdmin
        .from('announcements')
        .update({ curator_id: null, owner_id: null, mandate_id: null })
        .eq('id', annuncio.id)
    }

    // Avvisiamo l'altra persona, chiunque delle due abbia iniziato.
    await notificaUtente(
      eProprietario ? candidatura.curator_id : candidatura.owner_id,
      eProprietario
        ? `Il proprietario ha revocato il tuo incarico di curatore per "${titolo}".`
        : `Il curatore di "${titolo}" ha lasciato l'incarico. L'annuncio è tornato solo tuo.`,
      eProprietario ? 'Incarico revocato' : 'Il curatore si è tirato indietro',
      eProprietario ? '/curatore' : `/announcement/${candidatura.announcement_id}`,
      true
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Curatore/Revoke] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
