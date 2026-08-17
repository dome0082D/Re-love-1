'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { azioneStaff } from '@/lib/staffClient'
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
  const [loadError, setLoadError] = useState(false)
  const router = useRouter()

  useEffect(() => { loadProfiles() }, [])

  async function loadProfiles() {
    setLoading(true)
    setLoadError(false)
    const { data: { user } } = await supabase.auth.getUser()
    // Controllo sicurezza Staff
    if (user?.email !== 'dome0082@gmail.com') { router.push('/'); return; }
    
    // Modificato da created_at a id per evitare il crash del database
    const { data, error } = await supabase.from('profiles').select('*').order('id', { ascending: false })
    // FIX: prima un errore di caricamento veniva ignorato in silenzio - la
    // lista mostrava "Nessun profilo trovato", identico a come appare
    // quando davvero non ce ne sono.
    if (error) {
      console.error('Errore caricamento profili:', error)
      setLoadError(true)
    } else if (data) {
      setProfiles(data as Profile[])
    }
    setLoading(false)
  }

  async function deleteProfile(id: string) {
    if(!confirm("ATTENZIONE: Eliminare definitivamente questo utente e tutti i suoi dati associati?")) return;

    // FIX IMPORTANTE: prima questo pulsante cancellava SOLO la riga nella
    // tabella "profiles" - non i messaggi, le recensioni, gli annunci, le
    // transazioni, le notifiche, e non toglieva nemmeno l'accesso al sito
    // (l'account Supabase Auth resta separato e attivo). L'avviso di
    // conferma prometteva "questo utente e tutti i suoi dati associati",
    // ma il codice non manteneva quella promessa - lasciava dati orfani
    // sparsi in tutto il database. Ora usa la stessa funzione SQL
    // "nucleare" già corretta e in uso in app/staff/page.tsx, che elimina
    // davvero tutto in un colpo solo, accesso al sito compreso.
    try {
      const { error } = await supabase.rpc('delete_user_cascade', { target_user_id: id })
      if (error) {
        alert("Il Database ha bloccato l'eliminazione: " + error.message + "\n\nAssicurati di aver eseguito l'ultimo script SQL in Supabase!")
        return
      }
      alert("Utente e tutti i suoi dati eliminati con successo.")
      loadProfiles();
    } catch (err: any) {
      alert("Errore: " + err.message)
    }
  }

  async function editProfile(p: Profile) {
    const newName = prompt(`Modifica il nome per ${p.first_name || 'Utente'}:`, p.first_name || '');
    if (newName === null) return;

    // FIX: prima l'esito non veniva controllato - un salvataggio fallito
    // ricaricava comunque la lista (mostrando ancora il nome vecchio) senza
    // nessun avviso che qualcosa non fosse andato a buon fine.
    // FIX (SEGUITO): il controllo dell'errore da solo non bastava. La RLS
    // impedisce a un utente - staff compreso - di modificare il profilo di
    // un altro, ma senza restituire errore: la richiesta rispondeva 200
    // toccando ZERO righe, quindi si ricaricava l'elenco col nome vecchio e
    // nessun avviso. Ora passa dalla route di moderazione.
    const { ok, errore } = await azioneStaff({
      azione: 'modifica-profilo',
      userId: p.id,
      campi: { first_name: newName },
    })
    if (!ok) {
      alert("Errore durante il salvataggio: " + (errore || 'operazione non riuscita'))
      return
    }
    loadProfiles();
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs">Caricamento Profili...</div>

  return (
    <div className="min-h-screen p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex justify-between items-center mb-8">
          <h1 className="text-2xl font-black uppercase italic text-stone-900">Gestione Profili</h1>
          <Link href="/" className="text-[10px] font-black uppercase bg-stone-100 px-4 py-2 rounded-xl hover:bg-stone-200">Torna alla Home</Link>
        </div>

        {loadError ? (
          <div className="bg-white border border-red-200 rounded-3xl p-10 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Controlla la connessione e riprova.</p>
            <button onClick={loadProfiles} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
