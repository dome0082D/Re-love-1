'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>({ 
    first_name: '', last_name: '', residence_country: '', residence_region: '', 
    residence_city: '', residence_street: '', residence_number: '', residence_zip: '' 
  })
  const [allUsers, setAllUsers] = useState<any[]>([])
  const router = useRouter()

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push('/register'); return; }
    setUser(u)

    const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (p) setProfile(p)

    if (u.email === 'dome0082@gmail.com') {
      const { data: users } = await supabase.from('profiles').select('*').order('user_serial_id', { ascending: true })
      if (users) setAllUsers(users)
    }
    setLoading(false)
  }

  // FUNZIONE DI SALVATAGGIO CON GESTIONE ERRORI
  async function update() {
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({ 
      id: user.id, 
      ...profile, 
      updated_at: new Date().toISOString() 
    })
    
    if (error) {
      alert("Errore durante il salvataggio: " + error.message)
    } else {
      alert("Dati aggiornati e salvati con successo!")
    }
    setLoading(false)
  }

  async function deleteUser(id: string) {
    if(!confirm("STAFF: Vuoi eliminare questo utente?")) return
    await supabase.from('profiles').delete().eq('id', id)
    load()
  }

  // NUOVA FUNZIONE LOGOUT
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-[10px] text-stone-400">Sincronizzazione...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl shadow-stone-200/50 overflow-hidden border border-stone-100">
        
        {/* HEADER CON TASTO LOGOUT */}
        <div className="bg-stone-900 p-8 text-white flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-light uppercase tracking-[0.2em]">Il Mio Profilo</h1>
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-2">ID: {profile.user_serial_id || 'In elaborazione...'}</p>
          </div>
          <div className="flex gap-3 items-center">
            <Link href="/" className="text-[10px] border border-stone-700 px-4 py-2.5 rounded-md font-bold uppercase hover:bg-stone-800 transition-colors">Torna al Sito</Link>
            <button onClick={handleLogout} className="text-[10px] bg-red-600/90 text-white px-4 py-2.5 rounded-md font-bold uppercase hover:bg-red-600 transition-colors shadow-sm">Esci (Logout)</button>
          </div>
        </div>

        <div className="p-8">
          {/* SEZIONE STAFF */}
          {IS_STAFF && (
            <div className="mb-10 bg-stone-50 rounded-xl p-6 border border-stone-200">
              <h3 className="font-bold uppercase tracking-widest text-xs mb-4 text-stone-800">Amministrazione Utenti ({allUsers.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                {allUsers.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-white border border-stone-100 rounded-lg hover:shadow-sm transition-shadow">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-stone-600"><span className="text-emerald-600 mr-2">{u.user_serial_id}</span> {u.first_name || 'Anonimo'}</span>
                    {u.user_serial_id !== 'USR-1' && (
                      <button onClick={()=>deleteUser(u.id)} className="text-red-500 hover:text-red-700 text-[9px] font-bold uppercase tracking-widest">Elimina</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* DATI ANAGRAFICI */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Dati Personali</h3>
              <div className="grid grid-cols-2 gap-4">
                <input placeholder="Nome" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm focus:bg-white focus:border-emerald-500 transition-colors outline-none w-full" value={profile.first_name || ''} onChange={(e)=>setProfile({...profile, first_name: e.target.value})} />
                <input placeholder="Cognome" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm focus:bg-white focus:border-emerald-500 transition-colors outline-none w-full" value={profile.last_name || ''} onChange={(e)=>setProfile({...profile, last_name: e.target.value})} />
              </div>
            </div>

            {/* LUOGO DI RITIRO */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Luogo di Residenza / Ritiro Merce</h3>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Nazione (es. Italia)" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_country || ''} onChange={(e)=>setProfile({...profile, residence_country: e.target.value})} />
                <input placeholder="Paese / Regione" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_region || ''} onChange={(e)=>setProfile({...profile, residence_region: e.target.value})} />
                <input placeholder="Città" className="col-span-2 p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_city || ''} onChange={(e)=>setProfile({...profile, residence_city: e.target.value})} />
                <input placeholder="Via / Piazza" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_street || ''} onChange={(e)=>setProfile({...profile, residence_street: e.target.value})} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="N. Civico" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_number || ''} onChange={(e)=>setProfile({...profile, residence_number: e.target.value})} />
                  <input placeholder="CAP" className="p-3 bg-stone-50 border border-stone-100 rounded-lg text-sm outline-none" value={profile.residence_zip || ''} onChange={(e)=>setProfile({...profile, residence_zip: e.target.value})} />
                </div>
              </div>
              <button onClick={update} className="w-full mt-4 bg-emerald-600 text-white py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors shadow-sm">Salva Indirizzo e Dati</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
