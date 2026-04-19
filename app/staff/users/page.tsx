'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function StaffUsersContent() {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => { 
    supabase.auth.getUser().then(({data:{user}}) => {
      if(user?.email !== 'dome0082@gmail.com') router.push('/');
      else load();
    });
  }, [])

  async function load() {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setUsers(data)
  }

  async function deleteUser(id: string) {
    if (!confirm("Sei sicuro? Cancellerai l'utente e tutti i suoi annunci in modo irreversibile.")) return
    await supabase.from('announcements').delete().eq('user_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    setSelectedUser(null); load()
  }

  return (
    <div className="min-h-screen bg-stone-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
           <h1 className="text-xl font-black uppercase italic text-stone-800">👑 Profili Utenti</h1>
           <Link href="/" className="text-[9px] font-black uppercase bg-white border px-4 py-2 rounded-xl shadow-sm hover:bg-stone-50">Home</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map(u => (
            <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white p-5 rounded-3xl shadow-sm border cursor-pointer hover:border-emerald-500 transition-all flex justify-between items-center">
              <div>
                <p className="font-bold text-sm uppercase text-stone-800">{u.first_name || 'Utente Anonimo'}</p>
                <p className="text-[8px] text-stone-400 font-mono mt-1">ID: {u.user_serial_id}</p>
              </div>
              <span className="text-stone-300 text-xs">→</span>
            </div>
          ))}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative space-y-6">
             <button onClick={() => setSelectedUser(null)} className="absolute top-6 right-6 text-stone-300 hover:text-stone-900 font-black">✕</button>
             <h2 className="text-xl font-black uppercase italic text-center text-stone-800">{selectedUser.first_name || 'Utente'}</h2>
             <div className="bg-stone-50 p-6 rounded-2xl text-[10px] space-y-2 uppercase font-bold text-stone-500">
                <p>Città: <span className="text-stone-900">{selectedUser.residence_city || 'N/A'}</span></p>
                <p>Seriale: <span className="text-stone-900">{selectedUser.user_serial_id}</span></p>
                <p>System ID: <span className="text-stone-400 text-[8px]">{selectedUser.id}</span></p>
             </div>
             <button onClick={() => deleteUser(selectedUser.id)} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-[10px] border border-red-100 hover:bg-red-600 hover:text-white transition-all">Elimina Utente Definitivamente</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StaffUsers() {
  return <Suspense fallback={<div className="p-10 font-black uppercase text-xs text-center">Caricamento...</div>}><StaffUsersContent /></Suspense>
}
