'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Handshake, ArrowRight, Clock, Check, X } from 'lucide-react'

// Pagina del sistema "Baratto".
//
// NUOVO: prima non esisteva. Le tre route server (/api/baratto/*) erano
// scritte e funzionanti, ma nessuna pagina del sito le chiamava: il pulsante
// "Inizia Baratto" di un annuncio si limitava ad aprire una chat, e la
// tabella "baratti" restava vuota per sempre. Qui si vedono le proposte
// ricevute (da accettare o rifiutare) e quelle inviate, con il loro stato.

interface Baratto {
  id: string
  created_at: string
  item_id: string
  user_a_id: string
  user_b_id: string
  status: string
  oggetto?: { id: string; title: string; image_url: string | null }
  controparte?: { nickname?: string; first_name?: string }
}

const ETICHETTA_STATO: Record<string, { testo: string; classe: string }> = {
  in_attesa_pagamento_a: { testo: 'Attivazione non completata', classe: 'bg-stone-100 text-stone-500' },
  pending_user_b: { testo: 'In attesa di risposta', classe: 'bg-orange-100 text-orange-600' },
  accepted_chat_unlocked: { testo: 'Attivo', classe: 'bg-emerald-100 text-emerald-700' },
  rejected: { testo: 'Rifiutato', classe: 'bg-rose-100 text-rose-600' },
}

function BarattiContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userId, setUserId] = useState<string | null>(null)
  const [ricevute, setRicevute] = useState<Baratto[]>([])
  const [inviate, setInviate] = useState<Baratto[]>([])
  const [loading, setLoading] = useState(true)
  const [inCorso, setInCorso] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('inviata') === 'true') {
      toast.success('Proposta inviata! La quota ti verrà addebitata solo se viene accettata.')
      router.replace('/baratti')
    }
    if (searchParams.get('accettata') === 'true') {
      toast.success('Baratto attivato! Trovi la conversazione in Messaggi.')
      router.replace('/baratti')
    }
    if (searchParams.get('annullata') === 'true') {
      toast('Pagamento annullato: la proposta resta in attesa.')
      router.replace('/baratti')
    }
  }, [searchParams, router])

  async function carica() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUserId(user.id)

    const { data, error } = await supabase
      .from('baratti')
      .select('*')
      .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore caricamento baratti:', error)
      setLoading(false)
      return
    }

    const righe = (data || []) as Baratto[]

    // Oggetti e controparti con due query sole, invece di una per riga.
    const idOggetti = Array.from(new Set(righe.map(b => b.item_id).filter(Boolean)))
    const idPersone = Array.from(new Set(righe.map(b => (b.user_a_id === user.id ? b.user_b_id : b.user_a_id))))

    const [oggettiRes, personeRes] = await Promise.all([
      idOggetti.length ? supabase.from('announcements').select('id, title, image_url').in('id', idOggetti) : Promise.resolve({ data: [] as any[] }),
      idPersone.length ? supabase.from('profiles').select('id, nickname, first_name').in('id', idPersone) : Promise.resolve({ data: [] as any[] }),
    ])

    const mappaOggetti: Record<string, any> = {}
    ;(oggettiRes.data || []).forEach((o: any) => { mappaOggetti[o.id] = o })
    const mappaPersone: Record<string, any> = {}
    ;(personeRes.data || []).forEach((p: any) => { mappaPersone[p.id] = p })

    righe.forEach(b => {
      b.oggetto = mappaOggetti[b.item_id]
      b.controparte = mappaPersone[b.user_a_id === user.id ? b.user_b_id : b.user_a_id]
    })

    // Le proposte non ancora pagate da chi le ha create non vanno mostrate a
    // chi le riceve: per lui non esistono ancora.
    setRicevute(righe.filter(b => b.user_b_id === user.id && b.status !== 'in_attesa_pagamento_a'))
    setInviate(righe.filter(b => b.user_a_id === user.id))
    setLoading(false)
  }

  useEffect(() => { carica() }, [])

  async function rispondi(barattoId: string, action: 'accept' | 'reject') {
    if (action === 'reject' && !confirm('Rifiutare questa proposta di baratto?')) return
    setInCorso(barattoId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Sessione scaduta: rientra e riprova.')
        return
      }

      const res = await fetch('/api/baratto/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ baratto_id: barattoId, action }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Operazione non riuscita.')
        return
      }

      // Accettare significa pagare la propria quota: si passa da Stripe.
      if (data.url) {
        window.location.href = data.url
        return
      }

      toast.success('Proposta rifiutata. A chi l\'ha inviata non è stato addebitato nulla.')
      carica()
    } catch (err) {
      console.error('Errore risposta baratto:', err)
      toast.error('Errore di connessione.')
    } finally {
      setInCorso(null)
    }
  }

  const nome = (b: Baratto) => b.controparte?.nickname || b.controparte?.first_name || 'Utente Re-love'

  function Scheda({ b, ricevuta }: { b: Baratto; ricevuta: boolean }) {
    const stato = ETICHETTA_STATO[b.status] || { testo: b.status, classe: 'bg-stone-100 text-stone-500' }
    const daRispondere = ricevuta && b.status === 'pending_user_b'

    return (
      <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-5 flex flex-col sm:flex-row gap-5 items-start">
        <Link href={`/announcement/${b.item_id}`} className="w-full sm:w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-stone-50 border border-stone-100">
          <img loading="lazy" decoding="async" src={b.oggetto?.image_url || '/baratto.png'} alt={b.oggetto?.title || 'Oggetto'} className="w-full h-full object-cover" />
        </Link>

        <div className="flex-1 min-w-0">
          <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${stato.classe}`}>
            {stato.testo}
          </span>
          <Link href={`/announcement/${b.item_id}`} className="block text-sm font-black uppercase text-stone-900 mt-2 truncate hover:text-rose-600 transition-colors">
            {b.oggetto?.title || 'Oggetto non più disponibile'}
          </Link>
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">
            {ricevuta ? `Proposta da ${nome(b)}` : `Proposta a ${nome(b)}`}
          </p>

          {b.status === 'accepted_chat_unlocked' && (
            <Link href="/chat" className="inline-flex items-center gap-1.5 mt-3 text-[10px] font-black uppercase tracking-widest text-emerald-700 hover:text-emerald-900 transition-colors">
              Vai alla conversazione <ArrowRight size={12} />
            </Link>
          )}

          {daRispondere && (
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={() => rispondi(b.id, 'accept')}
                disabled={inCorso === b.id}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <Check size={14} /> {inCorso === b.id ? 'Attendi...' : 'Accetta (2,50 €)'}
              </button>
              <button
                onClick={() => rispondi(b.id, 'reject')}
                disabled={inCorso === b.id}
                className="flex-1 flex items-center justify-center gap-2 bg-stone-100 text-stone-600 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                <X size={14} /> Rifiuta
              </button>
            </div>
          )}

          {!ricevuta && b.status === 'pending_user_b' && (
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-3">
              <Clock size={12} /> I tuoi 2,50 € sono solo bloccati, non ancora addebitati
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <span className="inline-flex items-center gap-2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full mb-4">
            <Handshake size={12} /> Baratti
          </span>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">I tuoi scambi</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-10 space-y-12">
        <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4 shadow-sm">
          <p className="text-[11px] font-bold text-stone-600 leading-relaxed">
            <span className="font-black text-stone-900">Come funziona:</span> chi propone lo scambio blocca 2,50 € sulla propria carta,
            senza pagarli. Se l&apos;altra persona accetta, paga anche lei 2,50 € e solo a quel punto scatta l&apos;addebito per entrambi:
            la conversazione si apre e vi accordate su cosa scambiare. Se rifiuta, i soldi bloccati tornano subito disponibili
            e <span className="font-black text-stone-900">non viene addebitato nulla</span>.
          </p>
        </div>

        <section>
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-5">Proposte ricevute</h2>
          {loading ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 animate-pulse py-6">Caricamento...</p>
          ) : ricevute.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-10 text-center">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Nessuna proposta ricevuta.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ricevute.map(b => <Scheda key={b.id} b={b} ricevuta />)}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-5">Proposte inviate</h2>
          {loading ? (
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 animate-pulse py-6">Caricamento...</p>
          ) : inviate.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-10 text-center">
              <span className="text-5xl block mb-3">🤝</span>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-5">Non hai ancora proposto nessuno scambio.</p>
              <Link href="/?condition=Baratto" className="inline-block bg-stone-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
                Guarda gli oggetti in baratto
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {inviate.map(b => <Scheda key={b.id} b={b} ricevuta={false} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default function BarattiPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-stone-400 text-xs">Caricamento baratti...</div>}>
      <BarattiContent />
    </Suspense>
  )
}
