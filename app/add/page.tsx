'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AddForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')

  const [uiMode, setUiMode] = useState('sell_used')
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('Edilizia')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (modeParam === 'new') setUiMode('sell_new')
    if (modeParam === 'used') setUiMode('sell_used')
  }, [modeParam])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files).slice(0, 4))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("Sessione scaduta!"); setLoading(false); return; }

    let dbType = 'sell'; let dbCondition = 'Usato';
    if (uiMode === 'sell_new') { dbType = 'sell'; dbCondition = 'Nuovo'; }
    if (uiMode === 'sell_used') { dbType = 'sell'; dbCondition = 'Usato'; }
    if (uiMode === 'offered') { dbType = 'offered'; dbCondition = 'Usato'; }
    if (uiMode === 'wanted') { dbType = 'wanted'; dbCondition = 'Usato'; }

    let galleryUrls: string[] = []; let imageUrl = "";
    for (let i = 0; i < files.length; i++) {
      const name = `${Math.random()}-${files[i].name}`
      const { error } = await supabase.storage.from('announcements').upload(name, files[i])
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('announcements').getPublicUrl(name)
        galleryUrls.push(publicUrl)
        if (i === 0) imageUrl = publicUrl
      }
    }

    const { error } = await supabase.from('announcements').insert([{ 
      title, brand, model, description, category, condition: dbCondition, type: dbType,
      price: parseFloat(price) || 0, quantity: parseInt(quantity) || 1, 
      image_url: imageUrl, gallery: galleryUrls, user_id: user.id, contact_email: user.email 
    }])

    if (error) alert(error.message)
    else router.push('/')
    setLoading(false)
  }

  return (
    <main className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 border">
        <h1 className="text-3xl font-black mb-8 uppercase text-stone-900 italic tracking-tighter text-center">Nuovo Annuncio</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-1.5 bg-stone-100 rounded-2xl">
            {[{id:'sell_new',l:'Vendi Nuovo'},{id:'sell_used',l:'Vendi Usato'},{id:'offered',l:'Regala'},{id:'wanted',l:'Cerco'}].map(m=>(
              <button key={m.id} type="button" onClick={()=>setUiMode(m.id)} className={`py-4 rounded-xl text-[9px] font-black uppercase transition-all ${uiMode===m.id?'bg-white text-emerald-600 shadow-md':'text-stone-500'}`}>{m.l}</button>
            ))}
          </div>
          <input type="text" placeholder="Cosa vendi?" className="w-full p-5 bg-stone-50 border rounded-2xl font-bold text-sm outline-none" onChange={(e)=>setTitle(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
             <input type="text" placeholder="Marca" className="w-full p-5 bg-stone-50 border rounded-2xl font-bold text-sm outline-none" onChange={(e)=>setBrand(e.target.value)} />
             <input type="text" placeholder="Modello" className="w-full p-5 bg-stone-50 border rounded-2xl font-bold text-sm outline-none" onChange={(e)=>setModel(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select onChange={(e)=>setCategory(e.target.value)} className="w-full p-5 bg-stone-50 border rounded-2xl text-xs font-black uppercase outline-none">
              <option value="Edilizia">🧱 Edilizia</option><option value="Elettricità">⚡ Elettricità</option><option value="Idraulica">🚰 Idraulica</option><option value="Attrezzi">🛠️ Attrezzi</option><option value="Altro">📦 Altro</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" placeholder="€ Prezzo" className="w-full p-5 bg-stone-50 border rounded-2xl font-bold text-sm outline-none" onChange={(e)=>setPrice(e.target.value)} required={uiMode.includes('sell')} />
                <input type="number" min="1" value={quantity} className="w-full p-5 bg-stone-50 border rounded-2xl font-bold text-sm outline-none" onChange={(e)=>setQuantity(e.target.value)} required />
            </div>
          </div>
          <div className="relative">
            <input type="file" accept="image/*" multiple className="hidden" id="f-up" onChange={handleFileChange} />
            <label htmlFor="f-up" className="flex flex-col items-center justify-center w-full p-8 border-2 border-dashed rounded-[2rem] cursor-pointer bg-stone-50 text-[10px] font-black text-stone-500 uppercase tracking-widest">{files.length>0?`✅ ${files.length} Foto Caricate`:'📸 Aggiungi Foto (Max 4)'}</label>
          </div>
          <textarea placeholder="Dettagli..." className="w-full p-5 bg-stone-50 border rounded-2xl outline-none h-40 text-sm" onChange={(e)=>setDescription(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-6 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-700 transition-all">{loading?'INVIO IN CORSO...':'PUBBLICA ORA'}</button>
        </form>
    </main>
  )
}

export default function AddPage() {
  return <div className="min-h-screen bg-stone-50 p-4 flex items-center justify-center font-sans"><Suspense fallback={<div>Loading...</div>}><AddForm /></Suspense></div>
}
