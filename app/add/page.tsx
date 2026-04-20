'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AddPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')

  // 1. SE L'UTENTE NON HA ANCORA SCELTO, MOSTRA I 3 BOTTONI
  if (!mode) {
    return (
      <div className="min-h-screen bg-stone-50 p-4 md:p-10 flex flex-col items-center pt-10">
        <h1 className="text-4xl md:text-6xl font-black uppercase italic mb-2 tracking-tighter text-stone-900 text-center">Cosa pubblichi?</h1>
        <p className="text-stone-400 font-bold uppercase text-[10px] md:text-xs tracking-widest mb-10 text-center">Seleziona la modalità corretta</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <Link href="/add?mode=new" className="bg-white p-8 rounded-3xl border border-stone-200 text-center hover:border-emerald-500 shadow-md">
            <span className="text-6xl block mb-4">✨</span>
            <h3 className="text-2xl font-black uppercase italic text-stone-900">Nuovo</h3>
            <p className="text-xs font-medium text-stone-500 mt-2">Articoli mai usati o eccedenze.</p>
          </Link>

          <Link href="/add?mode=used" className="bg-white p-8 rounded-3xl border border-stone-200 text-center hover:border-blue-500 shadow-md">
            <span className="text-6xl block mb-4">♻️</span>
            <h3 className="text-2xl font-black uppercase italic text-stone-900">Usato</h3>
            <p className="text-xs font-medium text-stone-500 mt-2">Materiali di seconda mano.</p>
          </Link>

          <Link href="/add?mode=gift" className="bg-white p-8 rounded-3xl border-4 border-emerald-500 text-center bg-emerald-50 shadow-lg">
            <span className="text-6xl block mb-4">🎁</span>
            <h3 className="text-2xl font-black uppercase italic text-emerald-800">Regalo</h3>
            <p className="text-xs font-medium text-emerald-700 mt-2">Dona a chi ne ha bisogno.</p>
          </Link>
        </div>
      </div>
    )
  }

  // 2. SE HA SCELTO, MOSTRA IL FORM (INSERISCI QUI IL TUO FORM ORIGINALE)
  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-stone-200">
        <div className="mb-8 border-b pb-4">
          <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">
            Modalità: {mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : 'Regalo'}
          </span>
          <h2 className="text-3xl font-black uppercase italic text-stone-900">Compila l'Annuncio</h2>
        </div>
        
        {/* QUI SOTTO LASCIA IL CODICE DEL FORM CHE AVEVI GIÀ SCRITTO */}
        <p className="text-sm font-bold text-stone-400">Il form si caricherà qui sotto...</p>
      </div>
    </div>
  )
}
