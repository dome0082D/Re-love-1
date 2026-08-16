'use client'
export const dynamic = 'force-dynamic'

// app/vetrina/page.tsx
//
// ============================================================================
// COSA È CAMBIATO E PERCHÉ
//
// Prima questa pagina era una sola, e mostrava le voci di TUTTI gli utenti
// insieme, divise in due schede (interna/esterna) sullo stesso indirizzo. Chi
// entrava vedeva la vetrina di chiunque, e la propria era mescolata alle
// altre; per giunta il pulsante di cancellazione compariva solo allo staff.
//
// Ora:
//   /vetrina                     -> SOLO la tua vetrina (questa pagina)
//   /vetrina/interna             -> i tuoi annunci Re-love in vetrina
//   /vetrina/esterna             -> i tuoi link esterni
//   /vetrina/utente/[id]/...     -> la vetrina di un altro utente, in sola
//                                   lettura, raggiungibile unicamente dai
//                                   riquadri della Home
//
// Interna ed esterna sono pagine separate, non due schede della stessa.
// ============================================================================

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ExternalLink, Home } from 'lucide-react'
import { caricaInterne, caricaEsterne } from '../components/vetrina/datiVetrina'

export default function LaMiaVetrinaPage() {
  const router = useRouter()
  const [caricamento, setCaricamento] = useState(true)
  const [quanteInterne, setQuanteInterne] = useState(0)
  const [quanteEsterne, setQuanteEsterne] = useState(0)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      try {
        const [interne, esterne] = await Promise.all([
          caricaInterne(user.id),
          caricaEsterne(user.id),
        ])
        setQuanteInterne(interne.length)
        setQuanteEsterne(esterne.length)
      } catch (err) {
        console.error('Errore caricamento vetrina:', err)
      } finally {
        setCaricamento(false)
      }
    }
    init()
  }, [router])

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-[#f5efdf] border-b border-stone-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">✨</div>
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase italic text-stone-900 tracking-tighter mb-2">La mia Vetrina</h1>
          <p className="text-rose-500 font-bold text-[10px] uppercase tracking-[0.3em]">
            Qui trovi e gestisci soltanto le tue voci
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 mt-10">
        <div className="bg-white border border-rose-100 rounded-2xl px-5 py-4 mb-8 shadow-sm">
          <p className="text-[11px] font-bold text-stone-600 leading-relaxed">
            <span className="font-black text-rose-600">La tua Vetrina è privata nella gestione:</span> pubblichi, vedi ed elimini solo le tue voci. Le vetrine degli altri utenti si raggiungono dai riquadri in Home, ognuna sulla propria pagina.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            href="/vetrina/interna"
            className="group bg-white rounded-[2.5rem] border border-orange-200 shadow-sm hover:shadow-lg hover:border-orange-400 transition-all p-8 flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-400 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <Sparkles size={28} />
            </div>
            <h2 className="text-lg font-black uppercase italic text-stone-900">Annunci Interni</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
              I tuoi annunci pubblicati su Re-love
            </p>
            <p className="text-3xl font-black text-rose-600 italic mt-4">
              {caricamento ? '—' : quanteInterne}
            </p>
            <span className="mt-5 text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-rose-600 transition-colors">
              Apri e gestisci →
            </span>
          </Link>

          <Link
            href="/vetrina/esterna"
            className="group bg-white rounded-[2.5rem] border border-blue-200 shadow-sm hover:shadow-lg hover:border-blue-400 transition-all p-8 flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
              <ExternalLink size={28} />
            </div>
            <h2 className="text-lg font-black uppercase italic text-stone-900">Link Esterni</h2>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
              Articoli da Amazon e altri negozi
            </p>
            <p className="text-3xl font-black text-blue-600 italic mt-4">
              {caricamento ? '—' : quanteEsterne}
            </p>
            <span className="mt-5 text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-blue-600 transition-colors">
              Apri e gestisci →
            </span>
          </Link>
        </div>

        <Link
          href="/"
          className="mt-8 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-rose-500 transition-colors"
        >
          <Home size={12} /> Vedi le vetrine della community in Home
        </Link>
      </div>
    </div>
  )
}
