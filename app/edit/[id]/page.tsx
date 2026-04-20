'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EditAnnouncementPage() {
  const { id } = useParams()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    price: 0,
    quantity: 1,
    category: 'Altro',
    condition: 'Usato',
    notes: '',
    brand: ''
  })

  useEffect(() => {
    async function fetchAnnouncement() {
      // 1. Controlla chi è loggato
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)

      // 2. Scarica i vecchi dati dell'annuncio
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        alert("Annuncio non trovato.")
        router.push('/profile')
        return
      }

      // 3. SICUREZZA: Solo il proprietario può modificare
      if (data.user_id !== currentUser.id) {
        alert("Non sei autorizzato a modificare questo annuncio.")
        router.push('/profile')
        return
      }

      // 4. Inserisce i vecchi dati nel modulo pronti per essere cambiati
      setFormData({
        title: data.title || '',
        price: data.price || 0,
        quantity: data.quantity !== undefined ? data.quantity : 1,
        category: data.category || 'Altro',
        condition: data.condition || 'Usato',
        notes: data.notes || '',
        brand: data.brand || ''
      })
      
      setLoading(false)
    }
    
    if (id) fetchAnnouncement()
  }, [id, router])

  async function handleSave(e: any) {
    e.preventDefault()
    setSaving(true)

    // 5. Salva i nuovi dati sovrascrivendo i vecchi
    const { error } = await supabase
      .from('announcements')
      .update({
        title: formData.title,
        price: formData.price,
        quantity: formData.quantity,
        category: formData.category,
        condition: formData.condition,
        notes: formData.notes,
        brand: formData.brand
      })
      .eq('id', id)
      .eq('user_id', user.id) // Doppia sicurezza

    if (error) {
      alert("Errore durante il salvataggio: " + error.message)
      setSaving(false)
    } else {
      alert("Annuncio aggiornato con successo!")
      router.push('/profile') // Torna al profilo
    }
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs text-stone-500">Caricamento annuncio...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans text-stone-900 pb-20 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
        
        <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
          <h1 className="text-2xl font-black uppercase italic text-stone-900">Modifica Annuncio</h1>
          <Link href="/profile" className="text-[10px] font-black uppercase tracking-widest text-stone-400 hover:text-stone-900 transition-colors">
            ← Annulla
          </Link>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Titolo dell'oggetto *</label>
            <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Prezzo (€) *</label>
              <input required type="number" step="0.01" min="0" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Quantità Disponibile *</label>
              <input required type="number" min="0" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Categoria</label>
              <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                <option value="Casa">Casa</option>
                <option value="Elettronica">Elettronica</option>
                <option value="Libri">Libri</option>
                <option value="Sport">Sport</option>
                <option value="Altro">Altro</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Condizione</label>
              <select value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 cursor-pointer">
                <option value="Nuovo">Nuovo</option>
                <option value="Usato">Usato</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Marca (Opzionale)</label>
            <input type="text" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Descrizione / Note</label>
            <textarea rows={5} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-4 border border-stone-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 resize-none"></textarea>
          </div>

          <button disabled={saving} type="submit" className="w-full bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest p-4 rounded-xl hover:bg-emerald-600 transition-colors mt-8 shadow-sm">
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </form>
      </div>
    </div>
  )
}
