// lib/stripeAccount.ts
//
// Dice se un utente può DAVVERO ricevere pagamenti.
//
// ============================================================================
// IL PROBLEMA CHE RISOLVE
//
// Finora tutto il sito considerava un venditore "pronto a incassare" con un
// semplice:
//
//     if (profile.stripe_account_id) { ... }
//
// Ma quel campo veniva scritto in /api/stripe/onboarding SUBITO dopo
// stripe.accounts.create(), cioè PRIMA che l'utente vedesse anche solo la
// prima schermata di Stripe. Bastava quindi premere "Attiva ricezione
// pagamenti", vedere la pagina di Stripe e chiuderla: al rientro su Re-love
// il profilo risultava già collegato e abilitato a vendere, senza aver
// inserito documenti, IBAN o dati fiscali. Esattamente il comportamento
// segnalato.
//
// Un account Stripe Express appena creato esiste ma ha charges_enabled e
// payouts_enabled a false: sono quelli i campi che dicono la verità, ed è
// quello che questo modulo va a leggere.
// ============================================================================

import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'

export const STRIPE_API_VERSION = '2026-03-25.dahlia' as const

// ============================================================================
// CONTROLLO DELLA CHIAVE — trovato un problema grave nella configurazione.
//
// In .env, STRIPE_SECRET_KEY conteneva la chiave PUBBLICABILE (pk_live_...),
// lo stesso identico valore di NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. Non è una
// chiave segreta, e Stripe rifiuta OGNI chiamata fatta con essa:
//
//     GET https://api.stripe.com/v1/balance
//     -> 403 {"code":"secret_key_required",
//             "message":"This API call cannot be made with a publishable API key."}
//
// Con quella chiave non funziona NIENTE lato server: creazione dei conti
// venditore, pagine di pagamento, verifica dei conti, bonifici ai venditori.
// E l'errore arrivava sempre come un 403 generico sepolto nei log, che
// somiglia a un problema di permessi qualsiasi: da qui la difficoltà a
// capire cosa stesse succedendo davvero.
//
// La chiave giusta si copia da Stripe -> Sviluppatori -> Chiavi API ->
// "Chiave segreta", e comincia per "sk_live_" (o "rk_live_" se ristretta).
// ============================================================================

/** Riconosce una chiave che NON può funzionare lato server. */
export function chiaveSegretaValida(chiave: string | undefined): boolean {
  if (!chiave) return false
  return chiave.startsWith('sk_') || chiave.startsWith('rk_')
}

export function problemaChiaveStripe(): string | null {
  const chiave = process.env.STRIPE_SECRET_KEY
  if (!chiave) return 'STRIPE_SECRET_KEY non è configurata.'
  if (chiave.startsWith('pk_')) {
    return 'STRIPE_SECRET_KEY contiene una chiave PUBBLICABILE (pk_...). ' +
      'Serve la chiave segreta (sk_...), che trovi su Stripe in Sviluppatori > Chiavi API.'
  }
  if (!chiaveSegretaValida(chiave)) {
    return 'STRIPE_SECRET_KEY non sembra una chiave Stripe valida (deve iniziare con sk_ o rk_).'
  }
  return null
}

let stripeSingleton: Stripe | null = null
export function getStripe(): Stripe {
  // Meglio fermarsi qui con un messaggio chiaro che lasciar partire una
  // chiamata destinata a un 403 incomprensibile.
  const problema = problemaChiaveStripe()
  if (problema) {
    console.error('[Stripe] CONFIGURAZIONE NON VALIDA:', problema)
    throw new Error(`Pagamenti non configurati. ${problema}`)
  }

  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: STRIPE_API_VERSION,
    })
  }
  return stripeSingleton
}

export interface StatoConto {
  /** Esiste un account Stripe collegato al profilo. */
  collegato: boolean
  /** L'utente ha completato e inviato il modulo di Stripe. */
  datiInviati: boolean
  /** Stripe autorizza l'incasso su questo account. */
  incassiAttivi: boolean
  /** Stripe autorizza i bonifici verso il conto dell'utente. */
  bonificiAttivi: boolean
  /** Vero solo se si può davvero vendere e incassare. */
  pronto: boolean
  /** Cosa manca ancora, così la pagina può dirlo all'utente. */
  mancante: string | null
  /** Voci che Stripe sta ancora aspettando (documenti, dati fiscali...). */
  daCompletare?: string[]
  /** Entro quando vanno completate, se Stripe ha fissato una scadenza. */
  scadenza?: string | null
  /** Stripe ha ricevuto i documenti e li sta controllando. */
  inVerifica?: boolean
}

const NON_COLLEGATO: StatoConto = {
  collegato: false,
  datiInviati: false,
  incassiAttivi: false,
  bonificiAttivi: false,
  pronto: false,
  mancante: 'Non hai ancora collegato un conto per ricevere i pagamenti.',
  daCompletare: [],
  scadenza: null,
  inVerifica: false,
}

// Piccola cache in memoria: senza, ogni caricamento di pagina che deve
// sapere se il venditore è pronto farebbe una chiamata di rete a Stripe.
// 60 secondi sono abbastanza per non rallentare la navigazione e abbastanza
// poco perché, appena finito l'onboarding, l'utente veda subito il cambio.
const CACHE_MS = 60_000
const cache = new Map<string, { quando: number; stato: StatoConto }>()

export function invalidaCacheConto(stripeAccountId: string) {
  cache.delete(stripeAccountId)
}

/**
 * Interroga Stripe sullo stato reale di un account collegato.
 * Non lancia mai: se Stripe non risponde restituisce "non pronto", perché in
 * dubbio è meglio bloccare un incasso che perdere i soldi di un acquirente.
 */
export async function statoContoStripe(stripeAccountId: string | null | undefined): Promise<StatoConto> {
  if (!stripeAccountId) return NON_COLLEGATO

  const inCache = cache.get(stripeAccountId)
  if (inCache && Date.now() - inCache.quando < CACHE_MS) return inCache.stato

  try {
    const account = await getStripe().accounts.retrieve(stripeAccountId)

    const req = account.requirements
    const daCompletareSubito = [...(req?.currently_due || []), ...(req?.past_due || [])]

    const datiInviati = !!account.details_submitted
    const incassiAttivi = !!account.charges_enabled
    const bonificiAttivi = !!account.payouts_enabled

    // ========================================================================
    // PERCHÉ IL CONTROLLO È PIÙ SEVERO DI "charges_enabled && payouts_enabled"
    //
    // È questa la ragione per cui una configurazione INCOMPLETA poteva
    // risultare accettata. Su un account Express, Stripe concede un periodo
    // di tolleranza: attiva subito incassi e bonifici e lascia all'utente
    // qualche giorno per completare documenti e verifiche. In quella
    // finestra l'account ha:
    //
    //     charges_enabled: true, payouts_enabled: true
    //     requirements.currently_due: ["individual.id_number", ...]
    //     requirements.current_deadline: <fra qualche giorno>
    //
    // Guardando solo i primi due campi sembra tutto a posto - e infatti il
    // sito diceva "sei pronto a ricevere pagamenti reali". Poi la scadenza
    // passa, Stripe disattiva l'account, e il venditore si ritrova con
    // vendite fatte e soldi che non arrivano.
    //
    // Consideriamo "pronto" solo un conto che ha davvero finito: modulo
    // inviato, nessun documento ancora richiesto, nessun blocco in corso.
    // ========================================================================
    const pronto =
      incassiAttivi &&
      bonificiAttivi &&
      datiInviati &&
      daCompletareSubito.length === 0 &&
      !req?.disabled_reason

    let mancante: string | null = null
    if (!pronto) {
      if (!datiInviati) {
        mancante = "Hai iniziato la configurazione su Stripe ma non l'hai completata."
      } else if (daCompletareSubito.length > 0) {
        const scadenza = req?.current_deadline
          ? ` Hai tempo fino al ${new Date(req?.current_deadline * 1000).toLocaleDateString('it-IT')}.`
          : ''
        mancante = `Stripe aspetta ancora dei dati da te (${daCompletareSubito.length} ${daCompletareSubito.length === 1 ? 'voce' : 'voci'} da completare).${scadenza}`
      } else if (req?.disabled_reason) {
        mancante = 'Stripe ha sospeso il tuo conto in attesa di verifiche.'
      } else if (!incassiAttivi || !bonificiAttivi) {
        mancante = 'Stripe non ha ancora abilitato incassi e bonifici sul tuo conto.'
      } else {
        mancante = 'Configurazione non ancora completa.'
      }
    }

    const stato: StatoConto = {
      collegato: true, datiInviati, incassiAttivi, bonificiAttivi, pronto, mancante,
      daCompletare: daCompletareSubito,
      scadenza: req?.current_deadline ? new Date(req?.current_deadline * 1000).toISOString() : null,
      inVerifica: (req?.pending_verification || []).length > 0,
    }
    cache.set(stripeAccountId, { quando: Date.now(), stato })
    return stato
  } catch (err) {
    console.error('[StripeAccount] Impossibile leggere lo stato del conto:', err)
    // Se il problema e' la chiave sbagliata, dirlo apertamente: altrimenti
    // sembra un guasto momentaneo e si continua a riprovare all'infinito.
    const problema = problemaChiaveStripe()
    return {
      collegato: true,
      datiInviati: false,
      incassiAttivi: false,
      bonificiAttivi: false,
      pronto: false,
      mancante: problema
        ? 'I pagamenti non sono configurati correttamente sul sito. Contatta lo staff.'
        : 'Non è stato possibile verificare il tuo conto con Stripe. Riprova fra poco.',
      daCompletare: [],
      scadenza: null,
      inVerifica: false,
    }
  }
}

/**
 * Comodità: legge il profilo dell'utente e ne restituisce lo stato reale.
 * Vuole un client Supabase con chiave di SERVIZIO (la lettura dei profili
 * altrui da una route server non deve dipendere dalla RLS).
 */
export async function statoContoUtente(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<StatoConto & { stripeAccountId: string | null }> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', userId)
    .maybeSingle()

  const stripeAccountId = profile?.stripe_account_id || null
  const stato = await statoContoStripe(stripeAccountId)
  return { ...stato, stripeAccountId }
}
