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
  const [files, setFiles] = useState<File[]>([]) 
  
  // STATI AGGIUNTI PER SPEDIZIONE E MAPPA
  const [shippingCost, setShippingCost] = useState('0')
  const [allowLocalPickup, setAllowLocalPickup] = useState(false)
  const [originAddress, setOriginAddress] = useState('')

  const categorieFisse = [
    { id: '1', name: '👕 Abbigliamento e Accessori' },
    { id: '2', name: '💻 Elettronica e Informatica' },
    { id: '3', name: '🛋️ Casa, Arredo, Giardino' },
    { id: '4', name: '🍎 Alimentari e Bevande' },
    { id: '5', name: '📚 Libri, Film e Musica' },
    { id: '6', name: '💄 Salute e Bellezza' },
    { id: '7', name: '⚽ Sport e Tempo Libero' },
    { id: '8', name: '🚗 Motori e Veicoli' },
    { id: '9', name: '📦 Altro / Varie' }
  ]

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('Devi accedere per pubblicare!'); setLoading(false); return; }

    const form = e.target as HTMLFormElement
    const formData = new FormData(form)
    
    const condition = mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : mode === 'barter' ? 'Baratto' : 'Regalo'
    const price = (mode === 'gift' || mode === 'barter') ? 0 : parseFloat(formData.get('price') as string)
    const quantity = parseInt(formData.get('quantity') as string) || 1
    const categoryId = formData.get('category_id') as string

    let uploadedUrls: string[] = []

    if (files.length > 0) {
      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`
        
        const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file)
        
        if (!uploadError) {
          const { data } = supabase.storage.from('images').getPublicUrl(filePath)
          uploadedUrls.push(data.publicUrl)
        }
      }
    }

    // INSERIMENTO CON NUOVI CAMPI SPEDIZIONE E INDIRIZZO
    const { error } = await supabase.from('announcements').insert([{
      user_id: user.id,
      title: formData.get('title'),
      description: formData.get('description'),
      price: price,
      quantity: quantity,
      category_id: categoryId,
      condition: condition,
      image_urls: uploadedUrls,
      image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : '/usato.png',
      // NUOVI CAMPI PER RE-LOVE
      shipping_cost: parseFloat(shippingCost),
      allow_local_pickup: allowLocalPickup,
      origin_address: originAddress
    }])

    if (!error) {
      alert("Annuncio pubblicato con successo!")
      router.push('/')
    } else {
      alert("Errore durante la pubblicazione: " + error.message)
    }
    setLoading(false)
  }

  if (!mode) {
    return (
      <div className="min-h-screen bg-stone-50 p-6 md:p-10 flex flex-col items-center pt-10">
        <h1 className="text-3xl md:text-5xl font-medium uppercase italic mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400 text-center">Cosa pubblichi?</h1>
        <p className="text-stone-400 font-bold uppercase text-[11px] tracking-widest mb-10 text-center">Seleziona la modalità</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full max-w-5xl">
          <Link href="/add?mode=new" className="bg-white p-6 rounded-2xl border border-stone-200 text-center hover:border-rose-400 shadow-sm transition-all hover:-translate-y-1">
            <img src="/nuovo.png" alt="Nuovo" className="w-full object-cover rounded-xl mb-4" />
            <h3 className="text-xl font-bold uppercase italic text-stone-900">Nuovo</h3>
            <p className="text-[11px] font-medium text-stone-500 mt-2">Articoli mai usati o eccedenze.</p>
          </Link>

          <Link href="/add?mode=used" className="bg-white p-6 rounded-2xl border border-stone-200 text-center hover:border-orange-400 shadow-sm transition-all hover:-translate-y-1">
            <img src="/usato.png" alt="Usato" className="w-full object-cover rounded-xl mb-4" />
            <h3 className="text-xl font-bold uppercase italic text-stone-900">Usato</h3>
            <p className="text-[11px] font-medium text-stone-500 mt-2">Materiali di seconda mano.</p>
          </Link>

          <Link href="/add?mode=gift" className="bg-rose-50 p-6 rounded-2xl border-2 border-rose-400 text-center shadow-md transition-all hover:-translate-y-1">
            <img src="/regalo.png" alt="Regalo" className="w-full object-cover rounded-xl mb-4" />
            <h3 className="text-xl font-bold uppercase italic text-rose-800">Regalo</h3>
            <p className="text-[11px] font-medium text-rose-700 mt-2">Dona a chi ne ha bisogno.</p>
          </Link>

          <Link href="/add?mode=barter" className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-400 text-center shadow-md transition-all hover:-translate-y-1">
            <img src="/baratto.png" alt="Baratto" className="w-full object-cover rounded-xl mb-4" />
            <h3 className="text-xl font-bold uppercase italic text-blue-800">Baratto</h3>
            <p className="text-[11px] font-medium text-blue-700 mt-2">Scambia senza denaro.</p>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-2xl bg-white p-6 md:p-8 rounded-[2rem] shadow-md border border-stone-200">
        <div className="mb-6 border-b border-stone-100 pb-4">
          <span className="bg-stone-100 text-stone-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-2 inline-block">
            Modalità: {mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : mode === 'barter' ? 'Baratto' : 'Regalo'}
          </span>
          <h2 className="text-2xl font-bold uppercase italic text-stone-900">Compila l'Annuncio</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Titolo Annuncio</label>
            <input name="title" required type="text" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" placeholder="Es. Trapano Bosch" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Categoria</label>
              <select name="category_id" required className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800">
                {categorieFisse.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Quantità</label>
              <input name="quantity" required type="number" min="1" defaultValue="1" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mode !== 'gift' && mode !== 'barter' && (
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Prezzo (€)</label>
                <input name="price" required type="number" step="0.01" className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" placeholder="0.00" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-rose-500">Spese Spedizione (€)</label>
              <input 
                type="number" 
                step="0.01" 
                value={shippingCost} 
                onChange={(e) => setShippingCost(e.target.value)} 
                className="w-full p-3 mt-1 bg-rose-50/50 rounded-xl border border-rose-100 outline-none focus:border-rose-400 text-sm font-bold text-stone-800" 
                placeholder="0.00" 
              />
            </div>
          </div>

          <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Indirizzo di Provenienza (Mappa)</label>
              <input 
                required 
                type="text" 
                value={originAddress} 
                onChange={(e) => setOriginAddress(e.target.value)}
                className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" 
                placeholder="Città, Via, Civico" 
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={allowLocalPickup} 
                onChange={(e) => setAllowLocalPickup(e.target.checked)}
                className="w-5 h-5 rounded accent-rose-500" 
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-stone-600 group-hover:text-rose-500 transition-colors">Permetti Consegna a Mano</span>
            </label>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Descrizione</label>
            <textarea name="description" required rows={4} className="w-full p-3 mt-1 bg-stone-50 rounded-xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" placeholder="Descrivi il prodotto..."></textarea>
          </div>

          <div className="bg-stone-50 p-5 rounded-xl border border-stone-200">
             <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-3 block">Immagini del prodotto</span>
             <label className="flex items-center justify-center gap-2 bg-white text-stone-700 px-6 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:bg-rose-50 hover:text-rose-700 hover:border-rose-400 cursor-pointer transition-all border-2 border-stone-200 border-dashed w-full shadow-sm">
                <span className="text-lg">📎</span> + AGGIUNGI ALLEGATO
                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => { if (e.target.files) setFiles(Array.from(e.target.files)) }} />
             </label>

             {files.length > 0 && (
               <div className="mt-4 bg-rose-50 p-3 rounded-lg border border-rose-100">
                 <p className="text-[10px] font-bold text-rose-700 mb-2">✓ {files.length} file allegati:</p>
                 <div className="flex flex-col gap-1">
                   {files.map((f, i) => (
                     <span key={i} className="text-[9px] font-medium text-rose-600 truncate bg-white px-2 py-1 rounded border border-rose-100">{f.name}</span>
                   ))}
                 </div>
               </div>
             )}
          </div>

          <button disabled={loading} type="submit" className="w-full bg-stone-900 text-white font-black uppercase text-[11px] tracking-[0.2em] py-5 rounded-2xl hover:bg-rose-500 transition-all shadow-xl disabled:opacity-50 mt-4">
            {loading ? 'Caricamento e pubblicazione...' : 'Conferma e Pubblica su Re-love'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs animate-pulse">Caricamento...</div>}>
      <AddPageContent />
    </Suspense>
  )
}