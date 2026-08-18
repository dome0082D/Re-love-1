// app/api/curatore/candidatura/route.ts
//
// ============================================================================
// UN UTENTE SI CANDIDA A FARE DA CURATORE PER L'OGGETTO DI UN ALTRO.
//
// Sostituisce il vecchio giro con QR e codice di delega. Adesso è il
// Proprietario a pubblicare l'annuncio spuntando "cerco un curatore"; chi
// vuole occuparsene preme un pulsante sulla scheda dell'oggetto.
//
// La candidatura da sola NON autorizza niente: resta in attesa finché il
// Proprietario non la accetta (vedi /api/curatore/decidi). È la differenza
// fra "mi offro" e "sono autorizzato a vendere la roba tua", e va tenuta
// netta: qui si decide chi incassa i soldi di qualcun altro.
//
// L'identità di chi si candida viene dal token di sessione firmato, mai dal
// corpo della richiesta: l'id utente è pubblico (compare negli annunci), e
// se bastasse scriverlo nel JSON chiunque potrebbe candidare chiunque.
// ============================================================================

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verificaUtente } from '@/lib/serverAuth'
import { notificaUtente } from '@/lib/pushServer'
import { statoContoStripe } from '@/lib/stripeAccount'
import { motivoNonCandidabile, STATI_CANDIDATURA, PERCENTUALE_CURATORE_PREDEFINITA } from '@/lib/candidature'

export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

export async function POST(req: Request) {
  try {
    const utente = await verificaUtente(req)
    if (!utente) {
      return NextResponse.json({ error: 'Accedi per candidarti come curatore.' }, { status: 401 })
    }

    const { announcementId, contesto, messaggio } = await req.json()
    if (!announcementId) {
      return NextResponse.json({ error: 'Oggetto mancante.' }, { status: 400 })
    }
    if (contesto !== 'arena' && contesto !== 'annuncio') {
      return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 })
    }

    const { data: annuncio } = await supabaseAdmin
      .from('announcements')
      .select('id, user_id, title, cerca_curatore, curator_percentage, curator_id, is_arena')
      .eq('id', announcementId)
      .maybeSingle()

    if (!annuncio) {
      return NextResponse.json({ error: 'Oggetto non trovato.' }, { status: 404 })
    }

    // Le stesse regole che l'interfaccia usa per mostrare o nascondere il
    // pulsante, ricontrollate qui: il pulsante nascosto non è una difesa.
    const motivo = motivoNonCandidabile(annuncio, utente.id, contesto)
    if (motivo) {
      return NextResponse.json({ error: motivo }, { status: 400 })
    }

    // Un curatore prende una percentuale della vendita: se non può ricevere
    // pagamenti, accettarlo significherebbe scoprirlo a vendita fatta, con i
    // soldi già incassati e nessun modo di gliela girare.
    const { data: profiloCuratore } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', utente.id)
      .maybeSingle()

    const conto = await statoContoStripe(profiloCuratore?.stripe_account_id)
    if (!conto.pronto) {
      return NextResponse.json({
        error: conto.collegato
          ? `Per fare il curatore devi poter ricevere pagamenti, ma il tuo conto non è ancora completo${conto.mancante ? ` (manca: ${conto.mancante})` : ''}. Completalo dal tuo profilo e riprova.`
          : 'Per fare il curatore devi prima attivare i pagamenti dal tuo profilo: è lì che ti arriverà la tua parte della vendita.',
        requiresPayoutSetup: true,
      }, { status: 400 })
    }

    // Una candidatura già respinta non blocca un secondo tentativo (magari
    // nel frattempo le condizioni sono cambiate), ma una ancora in attesa sì.
    const { data: giaInAttesa } = await supabaseAdmin
      .from('curator_candidature')
      .select('id')
      .eq('announcement_id', announcementId)
      .eq('curator_id', utente.id)
      .eq('stato', STATI_CANDIDATURA.inAttesa)
      .maybeSingle()

    if (giaInAttesa) {
      return NextResponse.json({
        error: 'Ti sei già candidato per questo oggetto: il proprietario deve ancora rispondere.',
        candidaturaId: giaInAttesa.id,
      }, { status: 409 })
    }

    const percentuale = Number(annuncio.curator_percentage)

    const { data: candidatura, error: erroreInserimento } = await supabaseAdmin
      .from('curator_candidature')
      .insert([{
        announcement_id: announcementId,
        curator_id: utente.id,
        owner_id: annuncio.user_id,
        stato: STATI_CANDIDATURA.inAttesa,
        // Fotografata adesso: se domani il Proprietario cambia l'offerta,
        // questa candidatura resta quella che il curatore ha accettato.
        curator_percentage: Number.isFinite(percentuale) ? percentuale : PERCENTUALE_CURATORE_PREDEFINITA,
        messaggio: typeof messaggio === 'string' && messaggio.trim() ? messaggio.trim().slice(0, 500) : null,
      }])
      .select()
      .single()

    if (erroreInserimento || !candidatura) {
      console.error('[Curatore/Candidatura] Errore inserimento:', erroreInserimento)
      return NextResponse.json({ error: 'Non è stato possibile inviare la candidatura.' }, { status: 500 })
    }

    const nome = utente.email ? utente.email.split('@')[0] : 'Un utente'
    await notificaUtente(
      annuncio.user_id,
      `${nome} si è candidato come curatore per "${annuncio.title}". Accetta o rifiuta dalla pagina Curatore Locale.`,
      'Nuova candidatura curatore',
      '/curatore',
      true // riguarda i soldi di una vendita: va avvisato anche per email
    )

    return NextResponse.json({ ok: true, candidaturaId: candidatura.id })
  } catch (err) {
    console.error('[Curatore/Candidatura] Errore:', err)
    return NextResponse.json({ error: 'Errore di connessione.' }, { status: 500 })
  }
}
