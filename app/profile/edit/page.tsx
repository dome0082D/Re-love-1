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
    city: '',
    full_address: '', // Aggiunto per allineamento con il database
    bio: '',
    phone: '',
    avatar_url: ''
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
        .select('*') 
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile({
          nickname: data.nickname || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          city: data.city || '',
          full_address: data.full_address || '',
          bio: data.bio || '',
          phone: data.phone || '',
          avatar_url: data.avatar_url || ''
        })
      }
      setLoading(false)
    }
    loadProfile()
  }, [router])

  // Funzione per caricare la foto profilo
  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('announcements') // Usiamo il bucket esistente
      .upload(filePath, file)

    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('announcements').getPublicUrl(filePath)
      setProfile({ ...profile, avatar_url: publicUrl })
    } else {
      alert("Errore durante il caricamento dell'immagine.")
    }
    setSaving(false)
  }

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
        full_address: profile.full_address,
        bio: profile.bio,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      alert("Errore durante il salvataggio: " + error.message)
    } else {
      alert("Profilo aggiornato con successo! ✨")
      router.push(`/profile`)
    }
    setSaving(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400">Caricamento impostazioni...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-20 font-sans pb-32">
      <div className="max-w-2xl mx-auto bg-white rounded-[3rem] p-10 md:p-16 shadow-xl border border-stone-200">
        
        <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Modifica Profilo</h1>
        <p className="text-xs font-medium text-stone-500 mb-10 italic">Gestisci la tua identità su Re-love.</p>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* SEZIONE FOTO PROFILO */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 bg-stone-100 rounded-full overflow-hidden border-4 border-white shadow-lg relative group flex-shrink-0">
              <img loading="lazy" decoding="async" 
                src={profile.avatar_url || `https://ui-avatars.com/api/?name=${profile.nickname || 'U'}`} 
                className="w-full h-full object-cover" 
                alt="Avatar"
              />
              <label className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <span className="text-[10px] text-white font-black uppercase">Cambia</span>
                <input type="file" className="hidden" onChange={uploadAvatar} accept="image/*" />
              </label>
            </div>
            <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Foto Profilo</p>
          </div>

          {/* NICKNAME */}
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
          </div>

          {/* BIO */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Bio / Descrizione</label>
            <textarea 
              placeholder="Racconta qualcosa di te agli altri utenti..."
              value={profile.bio || ''} 
              onChange={(e) => setProfile({...profile, bio: e.target.value})}
              className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all min-h-[120px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-stone-100">
            {/* NOME REALE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Nome Reale (Privato)</label>
              <input 
                type="text" 
                value={profile.first_name || ''} 
                onChange={(e) => setProfile({...profile, first_name: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              />
            </div>
            {/* COGNOME REALE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Cognome (Privato)</label>
              <input 
                type="text" 
                value={profile.last_name || ''} 
                onChange={(e) => setProfile({...profile, last_name: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Indirizzo Spedizione (Privato)</label>
            <input 
              type="text" 
              placeholder="Via Roma 1, 00100"
              value={profile.full_address || ''} 
              onChange={(e) => setProfile({...profile, full_address: e.target.value})}
              className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* CITTÀ */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Città Pubblica</label>
              <input 
                type="text" 
                placeholder="Es: Milano"
                value={profile.city || ''} 
                onChange={(e) => setProfile({...profile, city: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
                required
              />
            </div>
            {/* TELEFONO */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-2 tracking-widest">Telefono (Privato)</label>
              <input 
                type="text" 
                placeholder="+39 333..."
                value={profile.phone || ''} 
                onChange={(e) => setProfile({...profile, phone: e.target.value})}
                className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold text-sm outline-none focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row gap-4">
            <button 
              type="button"
              onClick={() => router.back()}
              className="w-full md:w-1/3 bg-stone-50 text-stone-400 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 hover:text-stone-900 transition-colors"
            >
              Annulla
            </button>
            <button 
              type="submit" 
              disabled={saving}
              className="w-full md:w-2/3 bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-rose-500 transition-all disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Salva Modifiche'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}