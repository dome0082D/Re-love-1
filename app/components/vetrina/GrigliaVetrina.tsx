'use client'

// app/components/vetrina/GrigliaVetrina.tsx
//
// Le due griglie della Vetrina (annunci interni / link esterni) e la
// cornice comune delle pagine. Stanno qui perché ora esistono quattro
// pagine distinte che le usano - le mie due (interna/esterna) e le due di
// un altro utente - e senza un componente condiviso sarebbero quattro copie
// da tenere allineate a mano.

import Link from 'next/link'
import { ExternalLink, Eye, X, Truck } from 'lucide-react'
import type { VoceInterna, VoceEsterna } from './datiVetrina'
import BottoneCondividi from '@/components/BottoneCondividi'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

export function IntestazioneVetrina({
  titolo,
  sottotitolo,
  tornaA,
  tornaEtichetta,
}: {
  titolo: string
  sottotitolo: string
  tornaA: string
  tornaEtichetta: string
}) {
  return (
    <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <Link
          href={tornaA}
          className="inline-block text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-rose-600 transition-colors mb-4"
        >
          ← {tornaEtichetta}
        </Link>
        <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">{titolo}</h1>
        <p className="text-rose-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">{sottotitolo}</p>
      </div>
    </div>
  )
}

export function VetrinaVuota({ icona, titolo, testo }: { icona: string; titolo: string; testo: string }) {
  return (
    <div className="bg-white border-2 border-dashed border-stone-200 rounded-[3rem] p-16 text-center">
      <span className="text-6xl block mb-4">{icona}</span>
      <h3 className="text-xl font-black uppercase text-stone-900 mb-2">{titolo}</h3>
      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{testo}</p>
    </div>
  )
}

export function GrigliaInterna({
  voci,
  onElimina,
}: {
  voci: VoceInterna[]
  /** Assente = sola lettura (vetrina di un altro utente). */
  onElimina?: (voce: VoceInterna) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
      {voci.map(voce => voce.announcements && (
        <div
          key={voce.id}
          className="group bg-white rounded-[2rem] overflow-hidden border border-orange-300 ring-1 ring-orange-300/40 shadow-md hover:shadow-lg transition-all flex flex-col relative"
        >
          <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-sm tracking-widest">
            ✨ Vetrina
          </div>

          {/* NUOVO: tasto condividi. Sta in colonna con la X per non
              sovrapporsi ad essa quando ci sono entrambi. */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            {onElimina && (
              <button
                onClick={() => onElimina(voce)}
                title="Togli dalla Vetrina"
                className="bg-stone-900/80 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
            <BottoneCondividi
              aspetto="icona"
              percorso={`/announcement/${voce.announcements.id}`}
              titolo={voce.announcements.title}
              testo={`${voce.announcements.title} - € ${Number(voce.announcements.price).toFixed(2)} su Re-love`}
            />
          </div>

          <Link href={`/announcement/${voce.announcements.id}`} className="contents">
            <div className="aspect-square bg-stone-50 relative">
              <img
                src={srcFoto(voce.announcements.image_url, 400) || '/usato.png'} srcSet={srcSetFoto(voce.announcements.image_url, 400)}
                className="w-full h-full object-cover"
                alt={voce.announcements.title}
                loading="lazy"
              />
            </div>
            <div className="p-4">
              <h4 className="text-[11px] font-black uppercase truncate text-stone-800">{voce.announcements.title}</h4>
              <p className="text-lg font-black text-rose-600 italic mt-1">€ {Number(voce.announcements.price).toFixed(2)}</p>
            </div>
          </Link>
        </div>
      ))}
    </div>
  )
}

export function GrigliaEsterna({
  voci,
  onElimina,
  onApri,
}: {
  voci: VoceEsterna[]
  onElimina?: (voce: VoceEsterna) => void
  onApri: (voce: VoceEsterna) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
      {voci.map(voce => (
        <div
          key={voce.id}
          className="group bg-white rounded-[2rem] overflow-hidden border border-blue-200 shadow-md hover:shadow-lg transition-all flex flex-col relative"
        >
          <div className="absolute top-3 left-3 z-10 bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-sm tracking-widest flex items-center gap-1">
            <ExternalLink size={9} /> Link Esterno
          </div>

          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            {onElimina && (
              <button
                onClick={() => onElimina(voce)}
                title="Togli dalla Vetrina"
                className="bg-stone-900/80 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
            {/* Si condivide la Vetrina Re-love di chi ha pubblicato, non
                l'indirizzo del negozio esterno: chi apre il link arriva sul
                sito e vede l'articolo nel suo contesto - ed e' esattamente
                il motivo per cui la Vetrina esiste. */}
            <BottoneCondividi
              aspetto="icona"
              percorso={`/vetrina/utente/${voce.user_id}`}
              titolo={voce.title}
              testo={`${voce.title} - € ${Number(voce.price).toFixed(2)} - trovato su Re-love`}
            />
          </div>

          <div onClick={() => onApri(voce)} className="contents cursor-pointer">
            <div className="aspect-square bg-stone-50 relative">
              {voce.image_url ? (
                <img src={srcFoto(voce.image_url, 400)} srcSet={srcSetFoto(voce.image_url, 400)} className="w-full h-full object-contain p-2" alt={voce.title} loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <ExternalLink size={40} />
                </div>
              )}
            </div>
            <div className="p-4">
              <h4 className="text-[11px] font-black uppercase truncate text-stone-800">{voce.title}</h4>
              {voce.description && (
                <p className="text-[10px] font-medium text-stone-500 mt-1 line-clamp-2">{voce.description}</p>
              )}
              <p className="text-lg font-black text-blue-600 italic mt-1">€ {Number(voce.price).toFixed(2)}</p>
              <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-0.5 flex items-center gap-1">
                <Truck size={10} />
                {Number(voce.shipping_cost) > 0
                  ? `+ € ${Number(voce.shipping_cost).toFixed(2)} spedizione`
                  : 'Spedizione gratuita'}
              </p>
              <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                <Eye size={10} /> {voce.clicks || 0} visite al link
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
