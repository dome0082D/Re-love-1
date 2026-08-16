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

let stripeSingleton: Stripe | null = null
export function getStripe(): Stripe {
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
}

const NON_COLLEGATO: StatoConto = {
  collegato: false,
  datiInviati: false,
  incassiAttivi: false,
  bonificiAttivi: false,
  pronto: false,
  mancante: 'Non hai ancora collegato un conto per ricevere i pagamenti.',
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

    const datiInviati = !!account.details_submitted
    const incassiAttivi = !!account.charges_enabled
    const bonificiAttivi = !!account.payouts_enabled
    const pronto = incassiAttivi && bonificiAttivi

    let mancante: string | null = null
    if (!pronto) {
      if (!datiInviati) {
        mancante = 'Hai iniziato la configurazione su Stripe ma non l\'hai completata.'
      } else if (account.requirements?.disabled_reason) {
        mancante = 'Stripe sta ancora verificando i tuoi dati, oppure ne mancano alcuni.'
      } else {
        mancante = 'Stripe non ha ancora abilitato incassi e bonifici sul tuo conto.'
      }
    }

    const stato: StatoConto = { collegato: true, datiInviati, incassiAttivi, bonificiAttivi, pronto, mancante }
    cache.set(stripeAccountId, { quando: Date.now(), stato })
    return stato
  } catch (err) {
    console.error('[StripeAccount] Impossibile leggere lo stato del conto:', err)
    return {
      collegato: true,
      datiInviati: false,
      incassiAttivi: false,
      bonificiAttivi: false,
      pronto: false,
      mancante: 'Non è stato possibile verificare il tuo conto con Stripe. Riprova fra poco.',
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
