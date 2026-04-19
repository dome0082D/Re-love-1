'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddAnnouncement() {
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [category, setCategory] = useState('Edilizia')
  const [files, setFiles] = useState<File[]>([]) // ORA È UN ARRAY DI FILE
  const [type, setType] = useState('sell')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // Converte la lista di file in un array e limita a massimo 4 foto
      const selectedFiles = Array.from(e.target.files).slice(0, 4);
      setFiles(selectedFiles);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("Accedi per pubblicare!"); setLoading(false); return; }

    let imageUrl = ""
    let galleryUrls: string[] = []

    // CARICAMENTO FOTO MULTIPLE
    if (files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `${Math.random()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('announcements').upload(fileName, file)
        
        if (!uploadError) {
          const { data: link } = supabase.storage.from('announcements').getPublicUrl(fileName)
          galleryUrls.push(link.publicUrl)
          if (i === 0) imageUrl = link.publicUrl // La prima foto diventa la copertina
        }
      }
    }

    const { error } = await supabase.from('announcements').insert([{ 
      title, brand, model, description, category, 
      price: parseFloat(price) || 0, 
      quantity: parseInt(quantity) || 1, 
      image_url: imageUrl, 
      gallery: galleryUrls, // Salviamo tutta la galleria
      type, 
      user_id: user.id, contact_email: user.email 
    }])

    if (error) alert(error.message)
    else router.push('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 flex items-center justify-center font-sans">
      <main className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-8 md:p-10 border border-stone-100">
        <h1 className="text-3xl font-black mb-8 uppercase tracking-[0.1em] text-stone-900 italic">Nuovo Annuncio</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-xl">
            {['sell', 'offered', 'wanted'].map((t) => (
              <button key={t} type="button" onClick={() => setType(t)} 
                className={`py-3 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all ${type === t ? 'bg-white text-emerald-600 shadow-md' : 'text-stone-500 hover:text-stone-700'}`}>
                {t === 'sell' ? 'Vendi' : t === 'offered' ? 'Regala' : 'Cerco'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
             <input type="text" placeholder="Titolo principale (es. Trapano, Mattoni...)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 transition-colors" onChange={(e)=>setTitle(e.target.value)} required />
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" placeholder="Marca (Opzionale)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 transition-colors" onChange={(e)=>setBrand(e.target.value)} />
                <input type="text" placeholder="Modello (Opzionale)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500 transition-colors" onChange={(e)=>setModel(e.target.value)} />
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <select onChange={(e)=>setCategory(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs font-black uppercase outline-none">
              <option value="Edilizia">Edilizia</option>
              <option value="Elettricità">Elettricità</option>
              <option value="Idraulica">Idraulica</option>
              <option value="Attrezzi">Attrezzi</option>
              <option value="Altro">Altro</option>
            </select>

            <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.01" min="0" placeholder="Prezzo (€)" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" onChange={(e)=>setPrice(e.target.value)} required={type === 'sell'} />
                <input type="number" min="1" value={quantity} placeholder="Quantità" className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-emerald-500" onChange={(e)=>setQuantity(e.target.value)} required />
            </div>
          </div>

          {/* AREA CARICAMENTO FOTO MULTIPLE */}
          <div className="relative">
            <input type="file" accept="image/*" multiple className="hidden" id="file-upload" onChange={handleFileChange} />
            <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${files.length > 0 ? 'bg-emerald-50 border-emerald-400' : 'bg-stone-50 border-stone-300 hover:bg-stone-100'}`}>
              <span className={`text-[11px] font-black tracking-widest uppercase ${files.length > 0 ? 'text-emerald-700' : 'text-stone-500'}`}>
                {files.length > 0 ? `✅ ${files.length} Foto Selezionate (Max 4)` : '📸 Clicca per aggiungere foto (Max 4)'}
              </span>
              {files.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {Array.from(files).map((f, i) => (
                    <div key={i} className="w-10 h-10 bg-emerald-200 rounded-md overflow-hidden border border-emerald-400">
                       <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </label>
          </div>

          <textarea placeholder="Descrizione dettagliata delle condizioni..." className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none h-32 text-sm focus:border-emerald-500 transition-colors" onChange={(e)=>setDescription(e.target.value)} />

          <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-5 rounded-xl text-[11px] font-black tracking-widest uppercase shadow-xl hover:bg-emerald-700 hover:-translate-y-1 transition-all duration-300">
            {loading ? 'CARICAMENTO IMMAGINI...' : 'PUBBLICA ORA'}
          </button>
        </form>
        <Link href="/" className="block text-center mt-6 text-[10px] font-bold text-stone-400 uppercase tracking-widest hover:text-stone-600">← Torna alla Home</Link>
      </main>
    </div>
  )
}
