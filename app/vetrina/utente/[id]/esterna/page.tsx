'use client'
export const dynamic = 'force-dynamic'

// I link esterni in vetrina di UN ALTRO utente. Sola lettura.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  caricaEsterne, caricaProfilo, nomeVetrina, contaClickEsterno, eliminaVoce,
  type VoceEsterna, type ProfiloVetrina,
} from '../../../../components/vetrina/datiVetrina'
import {
  IntestazioneVetrina, GrigliaEsterna, VetrinaVuota,
} from '../../../../components/vetrina/GrigliaVetrina'
import ExternalLinkConfirmModal from '../../../../components/ExternalLinkConfirmModal'

export default function VetrinaUtenteEsternaPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : params.id?.[0]

  const [voci, setVoci] = useState<VoceEsterna[]>([])
  const [profilo, setProfilo] = useState<ProfiloVetrina | null>(null)
  const [caricamento, setCaricamento] = useState(true)
  const [linkDaAprire, setLinkDaAprire] = useState<string | null>(null)
  // Lo staff conserva la possibilita' di moderare: e' l'unico caso in cui
  // qualcuno puo' togliere una voce dalla vetrina di un altro utente.
  const [isStaff, setIsStaff] = useState(false)

  async function elimina(voce: VoceEsterna) {
    if (!confirm(`STAFF: togliere "${voce.title}" dalla vetrina di questo utente?`)) return
    const esito = await eliminaVoce(voce.id)
    if (!esito.ok) { toast.error(esito.errore || "Errore durante l'eliminazione."); return }
    toast.success('Link rimosso (moderazione staff).')
    if (id) setVoci(await caricaEsterne(id))
  }

  useEffect(() => {
    async function init() {
      if (!id) { setCaricamento(false); return }
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setIsStaff(user?.email === 'dome0082@gmail.com')
        const [p, v] = await Promise.all([caricaProfilo(id), caricaEsterne(id)])
        setProfilo(p)
        setVoci(v)
      } catch (err) {
        console.error('Errore caricamento vetrina esterna utente:', err)
      } finally {
        setCaricamento(false)
      }
    }
    init()
  }, [id])

  const nome = nomeVetrina(profilo)

  function apriLink(voce: VoceEsterna) {
    contaClickEsterno(voce.id)
    setLinkDaAprire(voce.external_url)
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <IntestazioneVetrina
        titolo={`Link di ${nome}`}
        sottotitolo="Vetrina esterna · sola visualizzazione"
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
          <VetrinaVuota icona="🔗" titolo="Nessun link in vetrina" testo={`${nome} non ha ancora aggiunto link qui`} />
        ) : (
          <GrigliaEsterna voci={voci} onApri={apriLink} onElimina={isStaff ? elimina : undefined} />
        )}
      </div>

      {linkDaAprire && (
        <ExternalLinkConfirmModal url={linkDaAprire} onClose={() => setLinkDaAprire(null)} />
      )}
    </div>
  )
}
