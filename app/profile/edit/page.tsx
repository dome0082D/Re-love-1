'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function EditProfilePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    nickname: '',
    first_name: '',
    last_name: '',
    city: ''
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('nickname, first_name, last_name, city')
        .eq('id', user.id)
        .single()

      if (data) setProfile(data)
      setLoading(false)
    }
    loadProfile()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: profile.nickname,
        first_name: profile.first_name,
        last_name: profile.last_name,
        city: profile.city,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      alert("Errore durante il salvataggio: " + error.message)
    } else {
      alert("Profilo aggiornato con successo! ✨")
      router.push(`/profile/${user.id}`)
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400">Caricamento impostazioni...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-20 font-sans">
      <div className="max-w-xl mx-auto bg-white rounded-[3rem] p-10 md:p-16 shadow-xl border border-stone-200">
        
        <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Modifica Profilo</h1>
        <p className="text-xs font-medium text-stone-500 mb-10 italic">Gestisci la tua identità su Re-love.</p>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* NICKNAME - IL PIÙ IMPORTANTE */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-rose-500 ml-2 tracking-widest">Nickname Pubblico</label>
            <input 
              type="text" 
              placeholder="Es: VintageLover99"
              value={profile.nickname || ''} 
              onChange={(e) => setProfile({...profile, nickname: e.target.value})}
              className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm focus:border-rose-500 outline-none transition-all focus:bg-white"
              required
            />
            <p className="text-[9px] text-stone-400 ml-2 uppercase font-bold italic">Questo è l'unico nome che gli altri vedranno sui tuoi annunci.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* NOME REALE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Nome Reale</label>
              <input 
                type="text" 
                value={profile.first_name || ''} 
                onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              />
            </div>
            {/* COGNOME REALE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Cognome Reale</label>
              <input 
                type="text" 
                value={profile.last_name || ''} 
                onChange={(e) => setProfile({...profile, last_name: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              />
            </div>
          </div>
          <p className="text-[9px] text-stone-400 text-center uppercase font-bold">Nome e cognome servono solo internamente per le spedizioni.</p>

          {/* CITTÀ */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Città</label>
            <input 
              type="text" 
              placeholder="Es: Milano"
              value={profile.city || ''} 
              onChange={(e) => setProfile({...profile, city: e.target.value})}
              className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              required
            />
          </div>

          <div className="pt-6 space-y-4">
            <button 
              type="submit" 
              disabled={saving}
              className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-rose-500 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
            <button 
              type="button"
              onClick={() => router.back()}
              className="w-full text-stone-400 font-black uppercase text-[10px] tracking-widest hover:text-stone-900 transition-colors"
            >
              Annulla
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}