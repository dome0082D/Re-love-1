'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StaffUsersList() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<any>(null) // Utente per il pop-up
  const [userAds, setUserAds] = useState<any[]>([]) // Annunci dell'utente selezionato
  const [isModalOpen, setIsModalOpen] = useState(false)
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u || u.email !== 'dome0082@gmail.com') {
      router.push('/')
      return
    }
    const { data } = await supabase.from('profiles').select('*').order('user_serial_id', { ascending: true })
    if (data) setUsers(data)
    setLoading(false)
  }

  // APRE IL POP-UP E CARICA I DATI EXTRA
  async function openUserProfile(user: any) {
    setSelectedUser(user)
    setIsModalOpen(true)
    
    // Carica gli annunci di questo specifico utente
    const { data: ads } = await supabase.from('announcements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    
    if (ads) setUserAds(ads)
    else setUserAds([])
  }

  async function deleteUser(id: string) {
    if(!confirm("STAFF: Sicuro di voler bannare questo utente?")) return
    await supabase.from('profiles').delete().eq('id', id)
    setUsers(users.filter(u => u.id !== id))
    setIsModalOpen(false)
  }

  async function deleteAd(adId: string) {
    if(!confirm("STAFF: Eliminare questo annuncio?")) return
    await supabase.from('announcements').delete().eq('id', adId)
    setUserAds(userAds.filter(a => a.id !== adId))
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-[10px] text-stone-400">Sincronizzazione Database...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans text-stone-900">
      
      {/* --- IL POP-UP (MODAL) --- */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Overlay scuro */}
          <div onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-fade-in"></div>
          
          {/* Contenuto Pop-up */}
          <div className="relative bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-slide-up">
            <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
              <div>
                <span className="text-emerald-600 font-black text-xs uppercase tracking-widest block mb-1">Dettaglio Profilo</span>
                <h2 className="text-xl font-black uppercase italic">{selectedUser.user_serial_id}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-900 text-2xl transition-colors">✕</button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              {/* Info Residenza */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 border-b pb-2">Anagrafica & Recapiti</h3>
                  <div className="space-y-3">
                    <p className="text-sm"><strong>Nome:</strong> {selectedUser.first_name || '-'} {selectedUser.last_name || '-'}</p>
                    <p className="text-sm"><strong>Città:</strong> {selectedUser.residence_city || '-'} ({selectedUser.residence_zip || '-'})</p>
                    <p className="text-sm"><strong>Indirizzo:</strong> {selectedUser.residence_street || '-'}, {selectedUser.residence_number || '-'}</p>
                    <p className="text-sm"><strong>Regione:</strong> {selectedUser.residence_region || '-'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-stone-400 border-b pb-2">Annunci Pubblicati ({userAds.length})</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {userAds.map(ad => (
                      <div key={ad.id} className="flex justify-between items-center p-3 bg-stone-50 rounded-lg border border-stone-100">
                        <span className="text-[10px] font-bold uppercase truncate w-32">{ad.title}</span>
                        <div className="flex gap-2">
                          <span className="text-[9px] font-black text-emerald-600">€{ad.price}</span>
                          <button onClick={() => deleteAd(ad.id)} className="text-red-500 hover:scale-110 transition-transform text-xs">🗑️</button>
                        </div>
                      </div>
                    ))}
                    {userAds.length === 0 && <p className="text-[10px] italic text-stone-400">Nessun annuncio presente.</p>}
                  </div>
                </div>
              </div>

              {/* Tasto Ban Finale */}
              {selectedUser.user_serial_id !== 'USR-1' && (
                <div className="pt-6 border-t border-stone-100 text-right">
                  <button onClick={() => deleteUser(selectedUser.id)} className="bg-red-600 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all">Banna Utente e Dati</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- LISTA PRINCIPALE --- */}
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden">
        <div className="bg-stone-900 p-8 text-white flex justify-between items-center">
          <h1 className="text-2xl font-light uppercase tracking-[0.2em] text-emerald-400">Staff: Lista Iscritti</h1>
          <Link href="/" className="text-[10px] border border-stone-700 px-4 py-2.5 rounded-md font-bold uppercase hover:bg-stone-800 transition-colors">Torna alla Home</Link>
        </div>

        <div className="p-8">
          <div className="space-y-3">
            {users.map(u => (
              <div 
                key={u.id} 
                onClick={() => openUserProfile(u)}
                className="flex justify-between items-center p-5 bg-stone-50 border border-stone-200 rounded-xl hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex-grow flex flex-col">
                  <span className="text-sm font-black uppercase text-stone-800 group-hover:text-emerald-700 transition-colors">
                    <span className="text-emerald-600 mr-2">{u.user_serial_id}</span> 
                    {u.first_name || 'Anonimo'} {u.last_name || ''}
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold mt-1 uppercase tracking-tight">Città: {u.residence_city || 'Non specificata'}</span>
                </div>
                <div className="text-stone-300 group-hover:text-emerald-500 font-black text-xl transition-colors">→</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
