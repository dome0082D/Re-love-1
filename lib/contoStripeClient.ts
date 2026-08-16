// lib/contoStripeClient.ts
//
// Versione lato browser della verifica "posso davvero incassare?".
// Chiama /api/stripe/account-status, che a sua volta chiede a Stripe se
// l'account ha charges_enabled e payouts_enabled.
//
// Serve perché diverse pagine (profilo, inserisci annuncio, nuovo mandato
// Curatore) decidevano tutte allo stesso modo sbagliato: bastava che il
// profilo avesse un "stripe_account_id" - campo che però viene scritto
// appena si preme il pulsante di attivazione, prima ancora che l'utente
// compili qualsiasi cosa su Stripe.

import { supabase } from '@/lib/supabase'

export interface StatoContoClient {
  collegato: boolean
  pronto: boolean
  mancante: string | null
}

const NON_VERIFICABILE: StatoContoClient = {
  collegato: false,
  pronto: false,
  mancante: 'Non è stato possibile verificare il tuo conto. Riprova fra poco.',
}

export async function verificaContoStripe(forza = false): Promise<StatoContoClient> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { collegato: false, pronto: false, mancante: 'Devi accedere.' }
    }

    const res = await fetch('/api/stripe/account-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ forza }),
    })
    const data = await res.json()
    if (!res.ok || data.error) return NON_VERIFICABILE

    return {
      collegato: !!data.collegato,
      pronto: !!data.pronto,
      mancante: data.mancante || null,
    }
  } catch (err) {
    console.error('Errore verifica conto Stripe:', err)
    return NON_VERIFICABILE
  }
}
