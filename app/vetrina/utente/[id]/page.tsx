'use client'
export const dynamic = 'force-dynamic'

// app/vetrina/utente/[id]/page.tsx
//
// La vetrina di UN ALTRO utente, in sola lettura. Si arriva qui soltanto dai
// riquadri "Vetrine della Community" in Home: /vetrina resta riservata alla
// propria, dove si pubblica e si cancella.
//
// Anche qui interna ed esterna sono due pagine distinte.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ExternalLink, Home } from 'lucide-react'
import {
  caricaInterne, caricaEsterne, caricaProfilo, nomeVetrina, type ProfiloVetrina,
} from '../../../components/vetrina/datiVetrina'

export default function VetrinaAltroUtentePage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : params.id?.[0]

  const [profilo, setProfilo] = useState<ProfiloVetrina | null>(null)
  const [quanteInterne, setQuanteInterne] = useState(0)
  const [quanteEsterne, setQuanteEsterne] = useState(0)
  const [caricamento, setCaricamento] = useState(true)
  const [nonTrovato, setNonTrovato] = useState(false)

  useEffect(() => {
    async function init() {
      if (!id) { setNonTrovato(true); setCaricamento(false); return }
      try {
        const [p, interne, esterne] = await Promise.all([
          caricaProfilo(id),
          caricaInterne(id),
          caricaEsterne(id),
        ])
        if (!p) setNonTrovato(true)
        setProfilo(p)
        setQuanteInterne(interne.length)
        setQuanteEsterne(esterne.length)
      } catch (err) {
        console.error('Errore caricamento vetrina utente:', err)
        setNonTrovato(true)
      } finally {
        setCaricamento(false)
      }
    }
    init()
  }, [id])

  const nome = nomeVetrina(profilo)

  if (nonTrovato) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans">
        <p className="text-sm font-black uppercase text-stone-900 mb-2">Vetrina non trovata</p>
        <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-stone-900">
          ← Torna alla Home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-[#f5efdf] border-b border-stone-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">✨</div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-rose-600 transition-colors mb-4"
          >
            <Home size={11} /> Vetrine della community
          </Link>
          <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center font-black text-2xl uppercase mx-auto mb-4">
            {nome[0]}
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tighter">
            Vetrina di {nome}
          </h1>
          <p className="text-rose-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Sola visualizzazione</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          href={`/vetrina/utente/${id}/interna`}
          className="group bg-white rounded-[2.5rem] border border-orange-200 shadow-sm hover:shadow-lg hover:border-orange-400 transition-all p-8 flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
            <Sparkles size={28} />
          </div>
          <h2 className="text-lg font-black uppercase italic text-stone-900">Annunci su Re-love</h2>
          <p className="text-3xl font-black text-rose-600 italic mt-4">{caricamento ? '—' : quanteInterne}</p>
          <span className="mt-5 text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-rose-600 transition-colors">
            Guarda →
          </span>
        </Link>

        <Link
          href={`/vetrina/utente/${id}/esterna`}
          className="group bg-white rounded-[2.5rem] border border-blue-200 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all p-8 flex flex-col items-center text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
            <ExternalLink size={28} />
          </div>
          <h2 className="text-lg font-black uppercase italic text-stone-900">Link Esterni</h2>
          <p className="text-3xl font-black text-blue-600 italic mt-4">{caricamento ? '—' : quanteEsterne}</p>
          <span className="mt-5 text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-blue-600 transition-colors">
            Guarda →
          </span>
        </Link>
      </div>
    </div>
  )
}
