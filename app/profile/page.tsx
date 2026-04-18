'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>({})
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

  async function deleteUser(id: string) {
    if(!confirm("STAFF: Vuoi eliminare questo utente e tutti i suoi dati?")) return
    await supabase.from('profiles').delete().eq('id', id)
    load()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs">Sincronizzazione...</div>

  return (
    <div className="min-h-screen bg-slate-200 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-slate-800 p-10 text-white flex justify-between items-center">
          <h1 className="text-4xl font-black italic uppercase">Profilo {profile.user_serial_id}</h1>
          <Link href="/" className="text-xs font-bold uppercase opacity-50">Home</Link>
        </div>

        <div className="p-10 space-y-10">
          {IS_STAFF && (
            <div className="bg-slate-900 rounded-2xl p-6 text-white border border-red-500/50 shadow-xl shadow-red-500/10">
              <h3 className="font-black uppercase mb-6 text-red-500">Amministrazione Utenti ({allUsers.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-4">
                {allUsers.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-slate-800 rounded-lg">
                    <span className="text-[10px] font-black uppercase tracking-widest">{u.user_serial_id} - {u.first_name || 'Anonimo'}</span>
                    {u.user_serial_id !== 'USR-1' && (
                      <button onClick={()=>deleteUser(u.id)} className="bg-red-600 px-3 py-1.5 rounded text-[8px] font-black uppercase">Elimina</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <input placeholder="Nome" className="p-4 bg-slate-50 border rounded-xl outline-none" value={profile.first_name || ''} onChange={(e)=>setProfile({...profile, first_name: e.target.value})} />
            <input placeholder="Cognome" className="p-4 bg-slate-50 border rounded-xl outline-none" value={profile.last_name || ''} onChange={(e)=>setProfile({...profile, last_name: e.target.value})} />
            <input type="date" className="p-4 bg-slate-50 border rounded-xl outline-none" value={profile.dob || ''} onChange={(e)=>setProfile({...profile, dob: e.target.value})} />
            <button onClick={async () => {
              await supabase.from('profiles').upsert({ id: user.id, ...profile })
              alert("Salvato!")
            }} className="bg-sky-600 text-white font-black uppercase rounded-xl">Salva Dati</button>
          </div>
        </div>
      </div>
    </div>
  )
}
