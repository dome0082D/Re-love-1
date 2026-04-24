'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Aggiungiamo l'interfaccia per eliminare gli errori "any" di TypeScript
interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  user_serial_id?: string | null;
  city: string | null;
  nation?: string | null;
}

export default function StaffUsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadProfiles() }, [])

  async function loadProfiles() {
    const { data: { user } } = await supabase.auth.getUser()
    // Controllo sicurezza Staff
    if (user?.email !== 'dome0082@gmail.com') { router.push('/'); return; }
    
    // Modificato da created_at a id per evitare il crash del database
    const { data } = await supabase.from('profiles').select('*').order('id', { ascending: false })
    if (data) setProfiles(data as Profile[])
    setLoading(false)
  }

  async function deleteProfile(id: string) {
    if(confirm("ATTENZIONE: Eliminare definitivamente questo utente e tutti i suoi dati associati?")) {
       await supabase.from('profiles').delete().eq('id', id);
       loadProfiles();
    }
  }

  async function editProfile(p: Profile) {
    const newName = prompt(`Modifica il nome per ${p.first_name || 'Utente'}:`, p.first_name || '');
    if (newName !== null) {
        await supabase.from('profiles').update({ first_name: newName }).eq('id', p.id);
        loadProfiles();
    }
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs">Caricamento Profili...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black uppercase italic text-stone-900">Gestione Profili</h1>
          <Link href="/" className="text-[10px] font-black uppercase bg-stone-100 px-4 py-2 rounded-xl hover:bg-stone-200">Torna alla Home</Link>
        </div>

        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-bold text-stone-800 uppercase">{p.first_name || 'Senza Nome'} {p.last_name || ''}</h3>
                <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-1">ID Seriale: {p.user_serial_id || 'N/A'}</p>
                <p className="text-xs text-stone-500 mt-1">Città: {p.city || 'N/A'} | Nazione: {p.nation || 'N/A'}</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => editProfile(p)} className="flex-1 md:flex-none text-[9px] font-black uppercase bg-stone-100 text-stone-800 px-4 py-2 rounded-xl hover:bg-stone-200">Modifica Nome</button>
                <button onClick={() => deleteProfile(p.id)} className="flex-1 md:flex-none text-[9px] font-black uppercase bg-red-50 text-red-500 px-4 py-2 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white">Elimina</button>
              </div>
            </div>
          ))}
          {profiles.length === 0 && <p className="text-xs text-stone-400 font-bold uppercase">Nessun profilo trovato.</p>}
        </div>
      </div>
    </div>
  )
}