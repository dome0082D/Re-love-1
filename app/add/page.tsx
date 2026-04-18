'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AddAnnouncement() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [type, setType] = useState('offered') // offered o wanted
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/register'); return; }

    const { error } = await supabase.from('announcements').insert([
      { title, description, price: parseFloat(price) || 0, image_url: imageUrl, type, user_id: user.id, contact_email: user.email }
    ])

    if (error) alert(error.message)
    else router.push('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center font-sans">
      <main className="bg-white w-full max-w-xl rounded-xl shadow-2xl border border-gray-200 p-8">
        <h1 className="text-3xl font-serif text-slate-800 font-black tracking-tighter mb-8 uppercase">Nuovo Annuncio</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Selettore Tipo Annuncio */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
            <button type="button" onClick={() => setType('offered')} className={`py-2 rounded-md text-[10px] font-black uppercase transition-all ${type === 'offered' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Offro Materiale</button>
            <button type="button" onClick={() => setType('wanted')} className={`py-2 rounded-md text-[10px] font-black uppercase transition-all ${type === 'wanted' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400'}`}>Cerco Materiale</button>
          </div>

          <input type="text" placeholder="Titolo" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none" onChange={(e) => setTitle(e.target.value)} required />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Prezzo (€)" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none" onChange={(e) => setPrice(e.target.value)} required />
            <input type="text" placeholder="URL Immagine" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none" onChange={(e) => setImageUrl(e.target.value)} />
          </div>
          <textarea placeholder="Descrizione" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none h-32" onChange={(e) => setDescription(e.target.value)} />

          <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-4 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-sky-600 transition-all">
            {loading ? 'Caricamento...' : 'Pubblica Ora'}
          </button>
        </form>
        <Link href="/" className="block text-center mt-6 text-[9px] font-bold text-gray-400 uppercase tracking-widest">← Annulla</Link>
      </main>
    </div>
  )
}
