'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  motivoNonCandidabile,
  quotaProprietario,
  GIORNI_VALIDITA_INCARICO,
  type AnnuncioPerCandidatura,
} from '@/lib/candidature'

// ============================================================================
// "CANDIDATI COME CURATORE"
//
// Si fa da un posto solo: la scheda dell'oggetto. (C'era anche la pagina
// Arena, con la regola che gli oggetti in gara si candidavano solo da lì:
// l'Arena è stata tolta dal sito e con lei quella distinzione.)
//
// Non serve incollare nessun id: il sito sa già chi sei da quando hai fatto
// accesso, e l'id di chi si candida viene preso dal token di sessione sul
// server. Il tuo id resta comunque visibile e copiabile dal profilo, se ti
// serve comunicarlo a voce.
// ============================================================================

interface Props {
  annuncioId: string
  annuncio: AnnuncioPerCandidatura
  /** Percentuale offerta dal proprietario, per dirlo prima di candidarsi. */
  percentualeOfferta?: number | null
  utenteId: string | null
  /** Richiamata dopo un invio riuscito, per ricaricare la pagina chiamante. */
  alTermine?: () => void
  className?: string
}

export default function BottoneCandidatura({
  annuncioId, annuncio, percentualeOfferta, utenteId, alTermine, className = '',
}: Props) {
  const router = useRouter()
  const [aperto, setAperto] = useState(false)
  const [messaggio, setMessaggio] = useState('')
  const [invio, setInvio] = useState(false)
  const [inviata, setInviata] = useState(false)

  const motivo = motivoNonCandidabile(annuncio, utenteId)

  // Se non si può proprio, non mostriamo un pulsante che non farebbe nulla.
  // L'unica eccezione è "devi accedere": quella vale la pena mostrarla, così
  // chi non è connesso capisce che l'opzione esiste.
  if (motivo && utenteId) return null
  if (inviata) {
    return (
      <p className={`text-[10px] font-black uppercase tracking-widest text-emerald-600 ${className}`}>
        Candidatura inviata: aspetta la risposta del proprietario.
      </p>
    )
  }

  const quota = Number(percentualeOfferta)
  const quotaValida = Number.isFinite(quota)

  async function invia() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      router.push(`/login?redirect=${encodeURIComponent(`/announcement/${annuncioId}`)}`)
      return
    }

    setInvio(true)
    try {
      const res = await fetch('/api/curatore/candidatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ announcementId: annuncioId, messaggio }),
      })
      const dati = await res.json()
      if (!res.ok || dati.error) {
        toast.error(dati.error || 'Non è stato possibile inviare la candidatura.')
        if (dati.requiresPayoutSetup) router.push('/profile')
        return
      }
      setInviata(true)
      setAperto(false)
      toast.success('Candidatura inviata: il proprietario riceverà una notifica.')
      alTermine?.()
    } catch (err) {
      console.error('Errore candidatura:', err)
      toast.error('Errore di connessione.')
    } finally {
      setInvio(false)
    }
  }

  if (!aperto) {
    return (
      <button
        onClick={() => (utenteId ? setAperto(true) : router.push('/login'))}
        className={`bg-amber-500 text-white font-black uppercase tracking-widest hover:bg-amber-600 transition-all ${className}`}
      >
        🤝 Candidati come curatore
      </button>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-left">
      <p className="text-xs font-black uppercase text-amber-900 tracking-widest mb-2">
        Candidati come curatore
      </p>
      {quotaValida && (
        <p className="text-[11px] font-bold text-amber-700 leading-relaxed mb-3">
          Il proprietario cede il <strong>{quota}%</strong> dell&apos;incasso a chi porta la vendita
          (a lui resta il {quotaProprietario(quota)}%, a Re-love il 10%).
        </p>
      )}
      {/* Detto PRIMA di candidarsi, non dopo: chi si offre deve sapere che il
          compenso si guadagna portando compratori, non facendosi accettare. */}
      <p className="text-[11px] font-bold text-amber-800 leading-relaxed mb-3 bg-white border border-amber-200 rounded-xl p-3">
        Se ti accetta ricevi un <strong>link personale</strong>. La percentuale ti spetta
        <strong> solo sulle vendite arrivate da quel link</strong>: se il compratore trova
        l&apos;annuncio per conto suo, l&apos;incasso è tutto del proprietario.
        Senza vendite entro {GIORNI_VALIDITA_INCARICO} giorni l&apos;incarico decade.
      </p>
      <label className="text-[9px] font-black uppercase text-amber-600 tracking-widest">
        Due righe per presentarti (facoltativo)
      </label>
      <textarea
        value={messaggio}
        onChange={(e) => setMessaggio(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="Es. Abito in zona, posso occuparmi io di foto, imballo e spedizione."
        className="w-full mt-1 p-3 bg-white border border-amber-200 rounded-xl text-xs font-medium outline-none focus:border-amber-400 resize-none"
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={invia}
          disabled={invio}
          className="flex-1 bg-amber-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all disabled:opacity-50"
        >
          {invio ? 'Invio...' : 'Invia candidatura'}
        </button>
        <button
          onClick={() => setAperto(false)}
          disabled={invio}
          className="px-5 bg-white border border-amber-200 text-amber-700 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all disabled:opacity-50"
        >
          Annulla
        </button>
      </div>
    </div>
  )
}
