'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>({
    first_name: '', last_name: '', dob: '', pob: '', 
    residence_country: '', residence_region: '', residence_city: '', residence_zip: ''
  })
  const [userSerialId, setUserSerialId] = useState('')
  const router = useRouter()

  useEffect(() => {
    getProfile()
  }, [])

  async function getProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/register'); return; }

    let { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    
    if (data) {
      setProfile(data)
      setUserSerialId(data.user_serial_id)
    } else {
      // Se è la prima volta che entra nel profilo, creiamo la sua riga nel database
      const { data: newProfile } = await supabase.from('profiles').insert([{ id: user.id }]).select().single()
      if (newProfile) setUserSerialId(newProfile.user_serial_id)
    }
    setLoading(false)
  }

  async function updateProfile() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').upsert({ id: user?.id, ...profile })
    if (error) alert("Errore nel salvataggio: " + error.message)
    else alert("Dati salvati con successo!")
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans font-bold text-slate-400 uppercase tracking-widest text-sm">Caricamento profilo...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-10 font-sans">
      <main className="bg-white max-w-3xl mx-auto rounded-xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* HEADER PROFILO CON ID */}
        <div className="bg-slate-800 p-8 text-white flex justify-between items-center relative overflow-hidden">
          <div className="relative z-10">
            <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white mb-4 block transition-colors">← Torna alla Home</Link>
            <h1 className="text-3xl md:text-4xl font-serif font-black tracking-tighter uppercase">Profilo Utente</h1>
            <p className="text-sky-400 text-[10px] font-bold uppercase tracking-widest mt-1">Gestione Dati Personali</p>
          </div>
          
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center relative z-10 shadow-inner">
            <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">IL TUO ID UTENTE</span>
            <span className="text-xl md:text-2xl font-mono font-bold tracking-tighter text-sky-400">{userSerialId || '---'}</span>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* DATI ANAGRAFICI */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Nome</label>
              <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.first_name || ''} onChange={(e)=>setProfile({...profile, first_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Cognome</label>
              <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.last_name || ''} onChange={(e)=>setProfile({...profile, last_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Data di Nascita</label>
              <input type="date" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm text-slate-600" value={profile.dob || ''} onChange={(e)=>setProfile({...profile, dob: e.target.value})} />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Luogo di Nascita</label>
              <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.pob || ''} onChange={(e)=>setProfile({...profile, pob: e.target.value})} />
            </div>
          </section>

          {/* RESIDENZA */}
          <div className="pt-8 border-t border-gray-100">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 mb-6">Indirizzo di Residenza</h3>
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Nazione</label>
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.residence_country || ''} onChange={(e)=>setProfile({...profile, residence_country: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Regione</label>
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.residence_region || ''} onChange={(e)=>setProfile({...profile, residence_region: e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">Città</label>
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.residence_city || ''} onChange={(e)=>setProfile({...profile, residence_city: e.target.value})} />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[9px] font-black uppercase text-gray-400 mb-2 ml-1 tracking-widest">CAP</label>
                <input type="text" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-sky-500 text-sm" value={profile.residence_zip || ''} onChange={(e)=>setProfile({...profile, residence_zip: e.target.value})} />
              </div>
            </section>
          </div>

          <div className="pt-6">
            <button onClick={updateProfile} className="w-full bg-sky-600 text-white py-5 rounded-md text-[11px] font-black uppercase tracking-widest hover:bg-sky-500 shadow-md transition-all active:scale-95">
              Salva Modifiche Profilo
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
