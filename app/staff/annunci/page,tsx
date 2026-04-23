'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function StaffAnnunciPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  async function fetchAnnouncements() {
    setLoading(true)
    // Recupera tutti gli annunci ignorando i filtri normali
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error && data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Sei sicuro di voler eliminare definitivamente questo annuncio?')) return;
    
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (!error) {
      setAnnouncements(announcements.filter(a => a.id !== id))
      alert('Annuncio eliminato.')
    } else {
      alert('Errore durante l\'eliminazione: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10 pt-20">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Moderazione Annunci</h1>
        <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px] mb-8">Pannello di controllo Staff</p>
        
        {loading ? (
          <p className="text-stone-400 font-bold uppercase">Caricamento annunci...</p>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-[10px] uppercase tracking-widest text-stone-500">
                    <th className="p-4 font-bold">Immagine</th>
                    <th className="p-4 font-bold">Titolo</th>
                    <th className="p-4 font-bold">Prezzo</th>
                    <th className="p-4 font-bold">Categoria</th>
                    <th className="p-4 font-bold text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((item) => (
                    <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="p-4">
                        <img src={item.image_url || '/usato.png'} alt="img" className="w-12 h-12 rounded-lg object-cover" />
                      </td>
                      <td className="p-4 text-xs font-bold text-stone-800">{item.title}</td>
                      <td className="p-4 text-xs font-black text-rose-500">€ {item.price}</td>
                      <td className="p-4 text-[10px] font-bold text-stone-500 uppercase">{item.category || 'N/D'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                  {announcements.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-stone-400 text-xs font-bold uppercase">Nessun annuncio trovato</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}