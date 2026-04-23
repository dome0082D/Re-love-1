'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function StaffUsersList() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProfiles() {
      try {
        setLoading(true)
        
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        
        if (error) {
          console.warn("Errore Supabase profili:", error)
          setErrorMsg(error.message)
        } else {
          setUsers(data || [])
        }
      } catch (err: any) {
        console.error("Crash recupero profili:", err)
        setErrorMsg(err.message || "Si è verificato un errore imprevisto.")
      } finally {
        setLoading(false)
      }
    }

    fetchProfiles()
  }, [])

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black uppercase italic text-stone-900">Gestione Utenti</h1>
          <Link href="/" className="text-xs font-bold uppercase bg-stone-200 px-4 py-2 rounded-xl">Torna alla Home</Link>
        </div>

        {loading ? (
          <p className="animate-pulse font-bold text-stone-400 uppercase text-xs">Caricamento database...</p>
        ) : errorMsg ? (
          /* NUOVO: MESSAGGIO DI ERRORE SE IL DATABASE RIFIUTA LA CONNESSIONE */
          <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-sm">
            <p className="text-red-600 font-bold uppercase text-[11px] tracking-widest mb-2">⚠️ Impossibile caricare gli utenti</p>
            <p className="text-red-500 font-medium text-xs mb-4">{errorMsg}</p>
            <p className="text-stone-500 text-[10px] uppercase font-bold tracking-wider">
              Controllo: Assicurati di aver creato la tabella "profiles" su Supabase.
            </p>
          </div>
        ) : users.length === 0 ? (
          /* NUOVO: MESSAGGIO VISIVO SE LA LISTA E' VUOTA */
          <div className="bg-white p-12 rounded-3xl border border-stone-200 text-center shadow-sm">
            <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Nessun utente trovato nella tabella profili</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((u) => (
              <div key={u.id} className="bg-white p-6 rounded-3xl border border-stone-200 flex justify-between items-center shadow-sm">
                <div>
                  <p className="text-xs font-black uppercase text-stone-400 tracking-widest">Email</p>
                  <p className="font-bold text-stone-900">{u.email || 'Email non disponibile'}</p>
                </div>
                {/* Questo link caricherà il file [id]/page.tsx che hai già */}
                <Link href={`/staff/users/${u.id}`} className="bg-stone-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-500 transition-all">
                  Gestisci
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}