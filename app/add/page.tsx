'use client'
import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function AddPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({ title: '', category: 'Casa', price: mode === 'gift' ? '0' : '', image_url: '', condition: mode === 'new' ? 'Nuovo' : 'Usato' })

  async function handleSubmit(e: any) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert("Accedi per pubblicare"); return }
    const { error } = await supabase.from('announcements').insert([{ ...formData, price: parseFloat(formData.price), type: mode === 'gift' ? 'offered' : 'sell', user_id: user.id, contact_email: user.email }])
    if (error) alert(error.message); else router.push('/')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 border border-stone-200 shadow-sm">
        <h2 className="text-2xl font-black uppercase italic mb-6">Pubblica Annuncio</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input required placeholder="Titolo" className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, title: e.target.value})} />
          <select className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, category: e.target.value})}><option>Casa</option><option>Elettronica</option><option>Libri</option><option>Sport</option><option>Altro</option></select>
          {mode !== 'gift' ? (
            <input required type="number" placeholder="Prezzo (€)" className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, price: e.target.value})} />
          ) : (
             <div className="p-4 bg-emerald-50 text-emerald-700 text-xs font-black uppercase text-center rounded-xl">Regalo: Prezzo 0€</div>
          )}
          <input placeholder="Link Immagine (URL)" className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setFormData({...formData, image_url: e.target.value})} />
          <button disabled={loading} className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-emerald-600 transition-all">{loading ? 'Pubblicazione...' : 'Conferma'}</button>
          <Link href="/" className="block text-center text-[9px] font-black uppercase text-stone-300 pt-2">Annulla</Link>
        </form>
      </div>
    </div>
  )
}
export default function AddPage() { return <Suspense><AddPageContent /></Suspense> }
