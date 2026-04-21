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
  const [imageUrls, setImageUrls] = useState<string[]>(['']) // Array per allegati multipli

  useEffect(() => {
    supabase.from('categories').select('*').then(({ data }) => setCategories(data || []))
  }, [])

  const addImageField = () => setImageUrls([...imageUrls, ''])
  
  const updateImageField = (index: number, val: string) => {
    const newUrls = [...imageUrls]
    newUrls[index] = val
    setImageUrls(newUrls)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Devi accedere per pubblicare!'); setLoading(false); return; }

    const formData = new FormData(e.currentTarget)
    const condition = mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : 'Regalo'
    const price = mode === 'gift' ? 0 : parseFloat(formData.get('price') as string)
    const quantity = parseInt(formData.get('quantity') as string) || 1
    const validImages = imageUrls.filter(url => url.trim() !== '')

    const { error } = await supabase.from('announcements').insert([{
      user_id: user.id,
      title: formData.get('title'),
      description: formData.get('description'),
      price: price,
      quantity: quantity,
      category_id: parseInt(formData.get('category_id') as string),
      condition: condition,
      image_urls: validImages, // Array allegati
      image_url: validImages.length > 0 ? validImages[0] : '/usato.png'
    }])

    if (!error) {
      alert("Annuncio pubblicato con successo!")
      router.push('/')
    } else {
      alert("Errore durante la pubblicazione: " + error.message)
    }
    setLoading(false)
  }

  // SCHERMATA DI SCELTA INIZIALE
  if (!mode) {
    return (
      <div className="min-h-screen bg-stone-50 p-6 md:p-10 flex flex-col items-center pt-10">
        <h1 className="text-3xl md:text-5xl font-medium uppercase italic mb-2 tracking-tight text-stone-900 text-center" style={{ fontFamily: "'Brush Script MT', cursive" }}>Cosa pubblichi?</h1>
        <p className="text-stone-400 font-bold uppercase text-[11px] tracking-widest mb-10 text-center">Seleziona la modalità</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
          <Link href="/add?mode=new" className="bg-white p-6 rounded-2xl border border-stone-200 text-center hover:border-emerald-400 shadow-sm transition-all hover:-translate-y-1">
            <span className="text-5xl block mb-4">✨</span>
            <h3 className="text-xl font-bold uppercase italic text-stone-900">Nuovo</h3>
            <p className="text-[11px] font-medium text-stone-500 mt-2">Articoli mai usati o eccedenze.</p>
          </Link>

          <Link href="/add?mode=used" className="bg-white p-6 rounded-2xl border border-stone-200 text-center hover:border-blue-400 shadow-sm transition-all hover:-translate-y-1">
            <span className="text-5xl block mb-4">♻️</span>
            <h3 className="text-xl font-bold uppercase italic text-stone-900">Usato</h3>
            <p className="text-[11px] font-medium text-stone-500 mt-2">Materiali di seconda mano.</p>
          </Link>

          <Link href="/add?mode=gift" className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-400 text-center shadow-md transition-all hover:-translate-y-1">
            <span className="text-5xl block mb-4">🎁</span>
            <h3 className="text-xl font-bold uppercase italic text-emerald-800">Regalo</h3>
            <p className="text-[11px] font-medium text-emerald-700 mt-2">Dona a chi ne ha bisogno.</p>
          </Link>
        </div>
      </div>
    )
  }

  // MODULO DI INSERIMENTO
  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white p-6 md:p-8 rounded-[2rem] shadow-md border border-stone-200">
        <div className="mb-6 border-b border-stone-100 pb-4">
          <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-2 inline-block">
            Modalità: {mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : 'Regalo'}
          </span>
          <h2 className="text-2xl font-bold uppercase italic text-stone-900">Compila l'Annuncio</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Titolo Annuncio</label>
            <input name="title" required type="text" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-emerald-400 text-sm font-medium text-stone-800" placeholder="Es. Trapano Bosch" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Categoria</label>
              <select name="category_id" required className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-emerald-400 text-sm font-medium text-stone-800">
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Quantità</label>
              <input name="quantity" required type="number" min="1" defaultValue="1" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-emerald-400 text-sm font-medium text-stone-800" placeholder="1" />
            </div>
          </div>

          {mode !== 'gift' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Prezzo (€)</label>
              <input name="price" required type="number" step="0.01" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-emerald-400 text-sm font-medium text-stone-800" placeholder="0.00" />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Descrizione</label>
            <textarea name="description" required rows={4} className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-emerald-400 text-sm font-medium text-stone-800" placeholder="Descrivi il prodotto..."></textarea>
          </div>

          {/* ALLEGATI MULTIPLI */}
          <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
             <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2 block">Allegati (URL Immagini)</label>
             {imageUrls.map((url, index) => (
                <input 
                  key={index} 
                  value={url} 
                  onChange={(e) => updateImageField(index, e.target.value)} 
                  className="w-full p-2 mb-2 bg-white rounded-lg border border-stone-200 outline-none text-xs text-stone-700" 
                  placeholder={`Link immagine ${index + 1}`} 
                />
             ))}
             <button type="button" onClick={addImageField} className="text-[10px] font-bold text-emerald-600 uppercase mt-1 hover:underline">
               + Aggiungi altro allegato
             </button>
          </div>

          <button disabled={loading} type="submit" className="w-full bg-stone-900 text-white font-bold uppercase text-[11px] tracking-widest p-4 rounded-xl hover:bg-emerald-500 transition-all shadow-md disabled:opacity-50">
            {loading ? 'Pubblicazione...' : 'Conferma e Pubblica'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Caricamento modulo...</div>}>
      <AddPageContent />
    </Suspense>
  )
}
