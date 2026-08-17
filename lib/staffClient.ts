// lib/staffClient.ts
//
// Ponte fra il pannello staff e le sue route server.
//
// Serve perché il pannello faceva tutto dal browser con la chiave anonima:
// le letture tornavano vuote e le scritture non toccavano nessuna riga, ma
// PostgREST rispondeva 200 e il pannello mostrava "fatto" ogni volta.
// Qui ogni chiamata porta con sé il token di sessione firmato, e riporta
// indietro l'errore vero quando qualcosa non va.

import { supabase } from '@/lib/supabase'

export interface Riepilogo {
  utenti: number
  utentiBloccati: number
  annunciAttivi: number
  annunciTotali: number
  ordiniTotali: number
  ordiniInCorso: number
  ordiniInContestazione: number
  controversieAperte: number
  segnalazioniDaEsaminare: number
  incassoCommissioni: number
}

export interface ProfiloStaff {
  id: string
  email?: string | null
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  city?: string | null
  role?: string | null
  is_banned?: boolean | null
  banned_reason?: string | null
  stripe_account_id?: string | null
  created_at?: string
}

export interface AnnuncioStaff {
  id: string
  title?: string | null
  description?: string | null
  price?: number | null
  quantity?: number | null
  condition?: string | null
  city?: string | null
  image_url?: string | null
  is_sponsored?: boolean | null
  is_arena?: boolean | null
  user_id?: string
  autore?: string
  created_at?: string
}

export interface OrdineStaff {
  id: string
  status: string
  created_at: string
  buyer_id?: string
  seller_id?: string
  buyerEmail?: string
  sellerEmail?: string
  courier_name?: string | null
  tracking_number?: string | null
  announcements?: { title?: string | null; price?: number | null } | null
}

export interface RecensioneStaff {
  id: string
  rating?: number | null
  comment?: string | null
  reviewerEmail?: string
  reviewedEmail?: string
}

export interface ControversiaStaff {
  id: string
  status?: string | null
  reason?: string | null
  description?: string | null
  created_at: string
  buyer_id?: string
  seller_id?: string
  transaction?: { announcements?: { title?: string | null } | null } | null
}

export interface SegnalazioneStaff {
  id: string
  sender_id?: string
  receiver_id?: string
  senderEmail?: string
  receiverEmail?: string
  message_content?: string | null
  reviewed?: boolean | null
  created_at: string
}

export interface VoceVetrinaStaff {
  id: string
  type?: string | null
  title?: string | null
  image_url?: string | null
  external_url?: string | null
  price?: number | null
  clicks?: number | null
  is_active?: boolean | null
  autore?: string
}

export interface BarattoStaff {
  id: string
  status: string
  created_at: string
  proponente?: string
  destinatario?: string
}

export interface DatiStaff {
  riepilogo: Riepilogo
  profili: ProfiloStaff[]
  transazioni: OrdineStaff[]
  recensioni: RecensioneStaff[]
  controversie: ControversiaStaff[]
  segnalazioni: SegnalazioneStaff[]
  annunci: AnnuncioStaff[]
  vetrina: VoceVetrinaStaff[]
  baratti: BarattoStaff[]
}

async function intestazioni(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function caricaDatiStaff(): Promise<{ dati?: DatiStaff; errore?: string }> {
  const h = await intestazioni()
  if (!h) return { errore: 'Sessione scaduta: rientra e riprova.' }

  try {
    const res = await fetch('/api/staff/data', { headers: h })
    const data = await res.json()
    if (!res.ok || data.error) return { errore: data.error || 'Caricamento non riuscito.' }
    return { dati: data as DatiStaff }
  } catch (err) {
    console.error('Errore caricamento dati staff:', err)
    return { errore: 'Errore di connessione.' }
  }
}

/**
 * Esegue un'azione di moderazione. Restituisce sempre un esito esplicito:
 * "ok: false" con il motivo anche quando il database non ha toccato righe -
 * il caso che prima veniva scambiato per un successo.
 */
export async function azioneStaff(
  corpo: Record<string, unknown>
): Promise<{ ok: boolean; errore?: string }> {
  const h = await intestazioni()
  if (!h) return { ok: false, errore: 'Sessione scaduta: rientra e riprova.' }

  try {
    const res = await fetch('/api/staff/azione', {
      method: 'POST',
      headers: h,
      body: JSON.stringify(corpo),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.error) return { ok: false, errore: data.error || 'Operazione non riuscita.' }
    return { ok: true }
  } catch (err) {
    console.error('Errore azione staff:', err)
    return { ok: false, errore: 'Errore di connessione.' }
  }
}
