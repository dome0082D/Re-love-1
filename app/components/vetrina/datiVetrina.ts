// app/components/vetrina/datiVetrina.ts
//
// Lettura e cancellazione delle voci di Vetrina, condivise fra le pagine
// separate (interna / esterna, proprie / di un altro utente). Prima stava
// tutto dentro un'unica pagina con due schede: dividendola in più pagine,
// queste funzioni sarebbero finite copiate in ognuna.

import { supabase } from '@/lib/supabase'

export interface VoceInterna {
  id: string
  user_id: string
  created_at: string
  announcements: {
    id: string
    title: string
    price: number
    image_url: string | null
  } | null
}

export interface VoceEsterna {
  id: string
  user_id: string
  created_at: string
  title: string
  description: string | null
  image_url: string | null
  external_url: string
  price: number
  shipping_cost: number | null
  clicks: number | null
}

export interface ProfiloVetrina {
  id: string
  first_name: string | null
  nickname?: string | null
  user_serial_id?: string | null
}

/** Voci "interne" (annunci pubblicati su Re-love) di UN solo utente. */
export async function caricaInterne(userId: string): Promise<VoceInterna[]> {
  const { data, error } = await supabase
    .from('vetrina_items')
    .select('*, announcements(*)')
    .eq('type', 'interna')
    .eq('is_active', true)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  // Una voce il cui annuncio è stato cancellato resta orfana: non ha nulla
  // da mostrare e va scartata, altrimenti la griglia stampa una scheda vuota.
  return (data || []).filter((v: VoceInterna) => v.announcements)
}

/** Voci "esterne" (link a negozi terzi) di UN solo utente. */
export async function caricaEsterne(userId: string): Promise<VoceEsterna[]> {
  const { data, error } = await supabase
    .from('vetrina_items')
    .select('*')
    .eq('type', 'esterna')
    .eq('is_active', true)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function caricaProfilo(userId: string): Promise<ProfiloVetrina | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, first_name, nickname, user_serial_id')
    .eq('id', userId)
    .maybeSingle()
  return data as ProfiloVetrina | null
}

export function nomeVetrina(profilo: ProfiloVetrina | null): string {
  return profilo?.nickname || profilo?.first_name || 'Utente Re-love'
}

/**
 * Cancellazione. Passa SEMPRE dalla route server: fatta dal browser con la
 * chiave anonima, la RLS la lascia senza effetto e senza errore (PostgREST
 * considera riuscita anche una DELETE da zero righe), quindi la pagina
 * annunciava "eliminata" e la voce restava lì.
 */
export async function eliminaVoce(itemId: string): Promise<{ ok: boolean; errore?: string; comeStaff?: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, errore: 'Sessione scaduta: rientra e riprova.' }

  const res = await fetch('/api/vetrina/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ itemId }),
  })
  const data = await res.json()
  if (!res.ok || data.error) return { ok: false, errore: data.error || "Errore durante l'eliminazione." }
  return { ok: true, comeStaff: !!data.comeStaff }
}

/** Conteggio click su un link esterno (dato accessorio, mai bloccante). */
export async function contaClickEsterno(itemId: string) {
  try {
    await supabase.rpc('increment_vetrina_click', { item_id: itemId })
  } catch (err) {
    console.error('Errore tracciamento click:', err)
  }
}
