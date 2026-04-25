'use client'

import { Suspense, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Interfaccia completa per evitare errori TypeScript e "any"
interface AnnouncementData {
  user_id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  category_id: string;
  condition: string;
  image_urls: string[];
  image_url: string;
  shipping_cost: number;
  allow_local_pickup: boolean;
  nation: string;
  region: string;
  city: string;
  postcode: string;
  street: string;
  house_number: string;
  origin_address: string;
  exchange_item: string | null; // Campo specifico per il Baratto
}

function AddPageContent() {
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<File[]>([]) 
  
  const [shippingCost, setShippingCost] = useState<string>('0')
  const [allowLocalPickup, setAllowLocalPickup] = useState<boolean>(false)
  
  // STATI PER I 6 CAMPI OBBLIGATORI
  const [nation, setNation] = useState<string>('Italia')
  const [region, setRegion] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [postcode, setPostcode] = useState<string>('')
  const [street, setStreet] = useState<string>('')
  const [houseNumber, setHouseNumber] = useState<string>('')

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
    if (loading) return
    
    // Cattura istantanea dei dati del form
    const formData = new FormData(e.currentTarget)
    setLoading(true)
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { 
        alert('Sessione scaduta. Per favore effettua di nuovo il login.')
        setLoading(false)
        return 
      }

      const condition = mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : mode === 'barter' ? 'Baratto' : 'Regalo'
      const priceVal = (mode === 'gift' || mode === 'barter') ? 0 : (parseFloat(formData.get('price') as string) || 0)
      const quantityVal = parseInt(formData.get('quantity') as string, 10) || 1
      const exchangeVal = mode === 'barter' ? (formData.get('exchange_item') as string) : null

      const uploadedUrls: string[] = []

      // CARICAMENTO IMMAGINI
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

      // PREPARAZIONE OGGETTO DATABASE
      const announcementData: AnnouncementData = {
        user_id: user.id,
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        price: priceVal,
        quantity: quantityVal,
        category_id: formData.get('category_id') as string,
        condition: condition,
        image_urls: uploadedUrls,
        image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : '/usato.png',
        shipping_cost: parseFloat(shippingCost) || 0,
        allow_local_pickup: allowLocalPickup,
        nation,
        region,
        city,
        postcode,
        street,
        house_number: houseNumber,
        origin_address: `${street} ${houseNumber}, ${postcode} ${city} (${region}), ${nation}`,
        exchange_item: exchangeVal
      }

      const { error: insertError } = await supabase.from('announcements').insert([announcementData]) 

      if (!insertError) {
        alert("Annuncio pubblicato con successo!")
        router.push('/')
      } else {
        alert("Errore database: " + insertError.message)
      }

    } catch (err) {
      console.error(err)
      alert("Si è verificato un errore imprevisto durante la pubblicazione.")
    } finally {
      setLoading(false) // Sblocca sempre il tasto alla fine
    }
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
        <div className="mb-6 border-b border-stone-100 pb-4 text-center">
          <span className="bg-stone-100 text-stone-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">
            {mode === 'new' ? 'Nuovo' : mode === 'used' ? 'Usato' : mode === 'barter' ? 'Baratto' : 'Regalo'}
          </span>
          <h2 className="text-2xl font-black uppercase italic text-stone-900">Compila l&apos;Annuncio</h2>
        </div>
        
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Titolo Annuncio</label>
            <input id="title" name="title" required type="text" className="w-full p-4 mt-1 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-bold text-stone-800" placeholder="Cosa vendi?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category_id" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Categoria</label>
              <select id="category_id" name="category_id" required className="w-full p-4 mt-1 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-bold text-stone-800">
                {categorieFisse.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="quantity" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Quantità</label>
              <input id="quantity" name="quantity" required type="number" min="1" defaultValue="1" className="w-full p-4 mt-1 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-bold text-stone-800" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LOGICA BARATTO VS PREZZO */}
            {mode === 'barter' ? (
              <div className="col-span-1 md:col-span-2">
                <label htmlFor="exchange_item" className="text-[10px] font-black uppercase tracking-widest text-blue-500 ml-1">Cosa cerchi in cambio?</label>
                <input id="exchange_item" name="exchange_item" required type="text" className="w-full p-4 mt-1 bg-blue-50/30 rounded-2xl border border-blue-100 outline-none focus:border-blue-400 text-sm font-bold text-stone-800" placeholder="Es: Scambio con cellulare o tablet" />
              </div>
            ) : mode !== 'gift' && (
              <div>
                <label htmlFor="price" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Prezzo (€)</label>
                <input id="price" name="price" required type="number" step="0.01" className="w-full p-4 mt-1 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-bold text-stone-800" placeholder="0.00" />
              </div>
            )}
            
            {mode !== 'barter' && mode !== 'gift' && (
              <div>
                <label htmlFor="shipping" className="text-[10px] font-black uppercase tracking-widest text-rose-500 ml-1">Spese Spedizione (€)</label>
                <input id="shipping" type="number" step="0.01" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="w-full p-4 mt-1 bg-rose-50/30 rounded-2xl border border-rose-100 outline-none focus:border-rose-400 text-sm font-black text-stone-800" />
              </div>
            )}
          </div>

          {/* SEZIONE INDIRIZZO DETTAGLIATA */}
          <div className="p-6 bg-stone-50 rounded-[2rem] border-2 border-stone-100 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 text-center mb-4">📍 Località dell&apos;oggetto</p>
            
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label htmlFor="nation" className="text-[9px] font-bold text-stone-400 uppercase ml-1">Nazione</label>
                 <input id="nation" required type="text" value={nation} onChange={(e) => setNation(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
               <div>
                 <label htmlFor="region" className="text-[9px] font-bold text-stone-400 uppercase ml-1">Regione</label>
                 <input id="region" required type="text" placeholder="Es: Sicilia" value={region} onChange={(e) => setRegion(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label htmlFor="city" className="text-[9px] font-bold text-stone-400 uppercase ml-1">Città</label>
                 <input id="city" required type="text" placeholder="Es: Palermo" value={city} onChange={(e) => setCity(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
               <div>
                 <label htmlFor="postcode" className="text-[9px] font-bold text-stone-400 uppercase ml-1">CAP</label>
                 <input id="postcode" required type="text" placeholder="90100" value={postcode} onChange={(e) => setPostcode(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
               <div className="col-span-2">
                 <label htmlFor="street" className="text-[9px] font-bold text-stone-400 uppercase ml-1">Via / Piazza</label>
                 <input id="street" required type="text" placeholder="Es: Via Libertà" value={street} onChange={(e) => setStreet(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
               <div>
                 <label htmlFor="houseNumber" className="text-[9px] font-bold text-stone-400 uppercase ml-1">Civico</label>
                 <input id="houseNumber" required type="text" placeholder="10" value={houseNumber} onChange={(e) => setHouseNumber(e.target.value)} className="w-full p-3 mt-1 bg-white rounded-xl border border-stone-200 text-sm font-bold text-stone-800" />
               </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer group pt-2 justify-center">
              <input type="checkbox" checked={allowLocalPickup} onChange={(e) => setAllowLocalPickup(e.target.checked)} className="w-6 h-6 rounded-lg accent-rose-500 border-stone-200" />
              <span className="text-[10px] font-black uppercase text-stone-600 group-hover:text-rose-500 transition-colors">Permetti Consegna a Mano</span>
            </label>
          </div>

          <div>
            <label htmlFor="description" className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-1">Descrizione</label>
            <textarea id="description" name="description" required rows={4} className="w-full p-4 mt-1 bg-stone-50 rounded-2xl border border-stone-100 outline-none focus:border-rose-400 text-sm font-medium text-stone-800" placeholder="Descrivi il tuo articolo..."></textarea>
          </div>

          <div className="bg-stone-50 p-6 rounded-2xl border border-stone-100">
             <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 block ml-1 text-center">Foto dell&apos;articolo</span>
             <label htmlFor="file-upload" className="flex items-center justify-center gap-3 bg-white text-stone-700 px-6 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 cursor-pointer transition-all border-2 border-stone-200 border-dashed w-full shadow-sm">
                <span className="text-xl">📸</span> AGGIUNGI FOTO
                <input id="file-upload" type="file" multiple accept="image/*" className="hidden" onChange={(e) => { if (e.target.files) setFiles(Array.from(e.target.files)) }} />
             </label>

             {files.length > 0 && (
               <div className="mt-4 bg-rose-50 p-4 rounded-xl border border-rose-100 flex items-center gap-3">
                 <span className="text-rose-600 text-lg">✓</span>
                 <p className="text-[10px] font-black text-rose-700 uppercase tracking-tight">{files.length} Immagini pronte</p>
               </div>
             )}
          </div>

          <button disabled={loading} type="submit" className="w-full bg-stone-900 text-white font-black uppercase text-xs tracking-[0.2em] py-6 rounded-[2rem] hover:bg-rose-500 transition-all shadow-xl disabled:opacity-50 mt-6 active:scale-95">
            {loading ? 'CARICAMENTO IN CORSO...' : 'PUBBLICA ORA SU RE-LOVE'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase text-[10px] text-stone-400 tracking-widest">Preparazione...</div>}>
      <AddPageContent />
    </Suspense>
  )
}