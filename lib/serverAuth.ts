// lib/serverAuth.ts
//
// Verifica CHI sta davvero facendo una richiesta a una route server.
//
// Perché serve: quasi tutte le route di questo progetto ricevono lo "userId"
// dentro il corpo JSON della richiesta e si fidano. Va bene per operazioni
// innocue, ma non per azioni di moderazione (cancellare la voce Vetrina di
// un altro utente): chiunque potrebbe scrivere a mano l'id di qualcun altro.
// Qui invece l'identità viene dedotta dal token di sessione firmato da
// Supabase, che il browser non può falsificare.

import { createClient } from '@supabase/supabase-js'

// Lo staff è identificato dalla stessa email già usata in tutto il sito
// (app/staff, app/vetrina, app/chat...). È configurabile con una variabile
// d'ambiente, così domani si può cambiare senza toccare il codice; il
// valore di ripiego è quello già scritto ovunque nel progetto.
export const STAFF_EMAIL = process.env.STAFF_EMAIL || 'dome0082@gmail.com'

export interface UtenteVerificato {
  id: string
  email: string | null
  isStaff: boolean
}

/**
 * Legge l'header "Authorization: Bearer <token>" della richiesta e chiede a
 * Supabase a quale utente appartiene. Restituisce null se manca il token o
 * se non è valido (scaduto, manomesso, di un altro progetto).
 */
export async function verificaUtente(req: Request): Promise<UtenteVerificato | null> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) return null

  const token = header.slice(7).trim()
  if (!token) return null

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string
  )

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const email = data.user.email || null
  return {
    id: data.user.id,
    email,
    isStaff: !!email && email.toLowerCase() === STAFF_EMAIL.toLowerCase(),
  }
}
