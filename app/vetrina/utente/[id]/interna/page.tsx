'use client'
export const dynamic = 'force-dynamic'

// Gli annunci Re-love in vetrina di UN ALTRO utente. Sola lettura: nessun
// pulsante di aggiunta, nessuna X di cancellazione (si passa "onElimina"
// solo nelle pagine della propria vetrina).

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  caricaInterne, caricaProfilo, nomeVetrina, eliminaVoce, type VoceInterna, type ProfiloVetrina,
} from '../../../../components/vetrina/datiVetrina'
import {
  IntestazioneVetrina, GrigliaInterna, VetrinaVuota,
} from '../../../../components/vetrina/GrigliaVetrina'

export default function VetrinaUtenteInternaPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : params.id?.[0]

  const [voci, setVoci] = useState<VoceInterna[]>([])
  const [profilo, setProfilo] = useState<ProfiloVetrina | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  // Lo staff conserva la possibilita' di moderare: e' l'unico caso in cui
  // qualcuno puo' togliere una voce dalla vetrina di un altro utente.
  const [isStaff, setIsStaff] = useState(false)

  async function elimina(voce: VoceInterna) {
    const titolo = voce.announcements?.title || 'questa voce'
    if (!confirm(`STAFF: togliere "${titolo}" dalla vetrina di questo utente?`)) return
    const esito = await eliminaVoce(voce.id)
    if (!esito.ok) { toast.error(esito.errore || "Errore durante l'eliminazione."); return }
    toast.success('Voce rimossa (moderazione staff).')
    if (id) setVoci(await caricaInterne(id))
  }

  useEffect(() => {
    async function init() {
      if (!id) { setCaricamento(false); return }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setIsStaff(user?.email === 'dome0082@gmail.com')
        const [p, v] = await Promise.all([caricaProfilo(id), caricaInterne(id)])
        setProfilo(p)
        setVoci(v)
      } catch (err) {
        console.error('Errore caricamento vetrina interna utente:', err)
      } finally {
        setCaricamento(false)
      }
    }
    init()
  }, [id])

  const nome = nomeVetrina(profilo)

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <IntestazioneVetrina
        titolo={`Annunci di ${nome}`}
        sottotitolo="Vetrina interna · sola visualizzazione"
        tornaA={`/vetrina/utente/${id}`}
        tornaEtichetta={`Vetrina di ${nome}`}
      />

      <div className="max-w-6xl mx-auto px-4 mt-10">
        {caricamento ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm border border-stone-200 animate-pulse h-56" />
            ))}
          </div>
        ) : voci.length === 0 ? (
          <VetrinaVuota icona="🏠" titolo="Nessun annuncio in vetrina" testo={`${nome} non ha ancora messo annunci qui`} />
        ) : (
          <GrigliaInterna voci={voci} onElimina={isStaff ? elimina : undefined} />
        )}
      </div>
    </div>
  )
}
