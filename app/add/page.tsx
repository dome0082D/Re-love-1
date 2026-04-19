'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AddForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode')

  const [uiMode, setUiMode] = useState('gift')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Altro')
  const [price, setPrice] = useState('0')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (modeParam) setUiMode(modeParam) }, [modeParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("Devi accedere!"); setLoading(false); return; }

    let type = 'sell'; let cond = 'Usato';
    if (uiMode === 'gift') { type = 'offered'; cond = 'Usato'; }
    if (uiMode === 'new') { type = 'sell'; cond = 'Nuovo'; }

    let imageUrl = ""
    if (files.length > 0) {
      const name = `${Math.random()}-${files[0].name}`
      await supabase.storage.from('announcements').upload(name, files[0])
      const { data: { publicUrl } } = supabase.storage.from('announcements').getPublicUrl(name)
      imageUrl = publicUrl
    }

    await supabase.from('announcements').insert([{ 
      title, category, price: uiMode === 'gift' ? 0 : parseFloat(price),
      type, condition: cond, image_url: imageUrl, user_id: user.id, contact_email: user.email 
    }])
    router.push('/')
  }

  return (
    <main className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-xl p-8 border border-stone-100">
      <h1 className="text-2xl font-black uppercase italic mb-8 text-center text-stone-800 leading-tight">Cosa vuoi<br/><span className="text-emerald-600">rimettere in circolo?</span></h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-stone-50 rounded-2xl border">
          {[{id:'gift',l:'Regalo'},{id:'used',l:'Usato'},{id:'new',l:'Nuovo'}].map(m=>(
            <button key={m.id} type="button" onClick={()=>setUiMode(m.id)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${uiMode===m.id?'bg-emerald-600 text-white shadow-md':'text-stone-500'}`}>{m.l}</button>
          ))}
        </div>
        <input type="text" placeholder="Nome dell'oggetto..." className="w-full p-4 bg-stone-50 border rounded-2xl text-sm font-bold outline-none" onChange={(e)=>setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
           <select className="p-4 bg-stone-50 border rounded-2xl text-[10px] font-black uppercase outline-none" onChange={(e)=>setCategory(e.target.value)}>
              <option value="Casa">Casa</option><option value="Elettronica">Elettronica</option><option value="Libri">Libri</option><option value="Sport">Sport</option><option value="Altro">Altro</option>
           </select>
           {uiMode !== 'gift' && <input type="number" placeholder="Prezzo (€)" className="p-4 bg-stone-50 border rounded-2xl text-sm font-bold outline-none" onChange={(e)=>setPrice(e.target.value)} />}
        </div>
        <input type="file" onChange={(e)=>e.target.files && setFiles(Array.from(e.target.files))} className="text-[10px] font-bold text-stone-500" />
        <button type="submit" disabled={loading} className="w-full py-5 bg-stone-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-emerald-600 transition-all">{loading ? 'CARICAMENTO...' : 'CONFERMA E PUBBLICA'}</button>
      </form>
      <Link href="/" className="block text-center mt-6 text-[9px] font-bold text-stone-400 uppercase hover:text-stone-900">← Torna Indietro</Link>
    </main>
  )
}

export default function AddPage() {
  return <div className="min-h-screen bg-stone-50 p-4 flex items-center justify-center font-sans"><Suspense fallback={<div className="font-black text-xs uppercase text-center">Caricamento...</div>}><AddForm /></Suspense></div>
}
