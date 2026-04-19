'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StaffUsersList() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    // Controllo Sicurezza: Se non sei lo Staff, ti caccia alla Home
    if (!u || u.email !== 'dome0082@gmail.com') {
      router.push('/')
      return
    }

    const { data } = await supabase.from('profiles').select('*').order('user_serial_id', { ascending: true })
    if (data) setUsers(data)
    setLoading(false)
  }

  async function deleteUser(id: string) {
    if(!confirm("STAFF: Sicuro di voler bannare questo utente e cancellare i suoi annunci?")) return
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(users.filter(u => u.id !== id))
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-[10px] text-stone-400">Sincronizzazione Database...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden">
        
        <div className="bg-stone-900 p-8 text-white flex justify-between items-center">
          <h1 className="text-2xl font-light uppercase tracking-[0.2em] text-emerald-400">Area Staff: Lista Iscritti</h1>
          <Link href="/" className="text-[10px] border border-stone-700 px-4 py-2.5 rounded-md font-bold uppercase hover:bg-stone-800 transition-colors">Torna alla Home</Link>
        </div>

        <div className="p-8">
          <div className="space-y-3">
            {users.map(u => (
              <div key={u.id} className="flex justify-between items-center p-4 bg-stone-50 border border-stone-200 rounded-lg hover:border-emerald-300 transition-colors group">
                <div className="flex-grow flex flex-col">
                  <span className="text-sm font-bold uppercase text-stone-800">
                    <span className="text-emerald-600 mr-2">{u.user_serial_id}</span> 
                    {u.first_name || 'Utente Senza Nome'} {u.last_name || ''}
                  </span>
                  <span className="text-[10px] text-stone-500 font-medium mt-1">Residenza: {u.residence_city || 'Non inserita'}</span>
                </div>
                
                <div className="flex gap-3 items-center">
                  <Link href={`/staff/users/${u.id}`} className="bg-emerald-600 text-white px-5 py-2 rounded-md text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-sm transition-all">Vedi Profilo</Link>
                  {u.user_serial_id !== 'USR-1' && (
                    <button onClick={()=>deleteUser(u.id)} className="text-red-500 hover:text-white hover:bg-red-600 border border-red-500 px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all">Elimina</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
