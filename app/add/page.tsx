'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function AddPageContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const router = useRouter()
  
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<any[]>([])

  // Carica le categorie dal DB
  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []))
  }, [])

  // Invia l'annuncio a Supabase
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Devi accedere per pubblicare!'); setLoading(false); return; }

    const formData = new FormData(e.currentTarget)
    const condition = mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : 'Regalo'
    const price = mode === 'gift' ? 0 : parseFloat(formData.get('price') as string)

    const { error } = await supabase.from('announcements').insert([{
      user_id: user.id,
      title: formData.get('title'),
      description: formData.get('description'),
      price: price,
      category_id: parseInt(formData.get('category_id') as string),
      condition: condition,
      image_url: '/usato.png' // Immagine base finché non integriamo l'upload
    }])

    if (!error) {
      alert("Annuncio pubblicato con successo!")
      router.push('/')
    } else {
      alert("Errore durante la pubblicazione: " + error.message)
    }
    setLoading(false)
  }

  // 1. SCHERMATA DI SCELTA INIZIALE
  if (!mode) {
    return (
      <div className="min-h-screen bg-stone-50 p-4 md:p-10 flex flex-col items-center pt-10">
        <h1 className="text-4xl md:text-6xl font-black uppercase italic mb-2 tracking-tighter text-stone-900 text-center">Cosa pubblichi?</h1>
        <p className="text-stone-400 font-bold uppercase tracking-widest mb-10 text-center">Seleziona la modalità</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
          <Link href="/add?mode=new" className="bg-white p-8 rounded-3xl border border-stone-200 text-center hover:border-emerald-500 shadow-md transition-all hover:-translate-y-2">
            <span className="text-6xl block mb-4">✨</span><h3 className="text-2xl font-black uppercase italic text-stone-900">Nuovo</h3>
          </Link>
          <Link href="/add?mode=used" className="bg-white p-8 rounded-3xl border border-stone-200 text-center hover:border-blue-500 shadow-md transition-all hover:-translate-y-2">
            <span className="text-6xl block mb-4">♻️</span><h3 className="text-2xl font-black uppercase italic text-stone-900">Usato</h3>
          </Link>
          <Link href="/add?mode=gift" className="bg-white p-8 rounded-3xl border-4 border-emerald-500 text-center bg-emerald-50 shadow-lg transition-all hover:-translate-y-2">
            <span className="text-6xl block mb-4">🎁</span><h3 className="text-2xl font-black uppercase italic text-emerald-800">Regalo</h3>
          </Link>
        </div>
      </div>
    )
  }

  // 2. IL MODULO DI INSERIMENTO VERO E PROPRIO
  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 flex flex-col items-center">
      <div className="w-full max-w-3xl bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-stone-200">
        <div className="mb-8 border-b pb-4">
          <span className="bg-stone-900 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">
            Modalità: {mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : 'Regalo'}
          </span>
          <h2 className="text-3xl font-black uppercase italic text-stone-900">Compila l'Annuncio</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-stone-400">Titolo Annuncio</label>
            <input name="title" required type="text" className="w-full p-4 mt-2 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Es. Trapano Bosch" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-stone-400">Categoria</label>
              <select name="category_id" required className="w-full p-4 mt-2 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            {mode !== 'gift' && (
              <div>
                <label className="text-[11px] font-black uppercase tracking-widest text-stone-400">Prezzo (€)</label>
                <input name="price" required type="number" step="0.01" className="w-full p-4 mt-2 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
              </div>
            )}
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-stone-400">Descrizione</label>
            <textarea name="description" required rows={4} className="w-full p-4 mt-2 bg-stone-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Descrivi il prodotto..."></textarea>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-emerald-500 text-white font-black uppercase tracking-widest p-5 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg disabled:opacity-50">
            {loading ? 'Pubblicazione...' : 'Conferma e Pubblica'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase tracking-widest text-stone-400 text-xs">Caricamento modulo...</div>}>
      <AddPageContent />
    </Suspense>
  )
}