'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface Transaction {
  id: string;
  created_at: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  stripe_payment_intent_id: string;
  barter_confirmed_buyer: boolean;
  barter_confirmed_seller: boolean;
  announcements: {
    id: string;
    title: string;
    price: number;
    condition: string;
    image_url: string;
  };
  buyer?: { email: string };
  seller?: { email: string };
}

interface Profile {
  id: string;
  email: string;
  [key: string]: any; // Permette di leggere tutti gli altri campi (nome, telefono, ecc.)
}

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  
  // Stati per la modale di ispezione utente
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [userMessages, setUserMessages] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const router = useRouter()
  const ADMIN_EMAIL = 'dome0082@gmail.com'

  useEffect(() => {
    checkAdminAndFetchData()
  }, [])

  async function checkAdminAndFetchData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    
    // Controllo di sicurezza spietato: se non sei tu, ti sbatte fuori
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/')
      return
    }

    // 1. Recuperiamo tutte le transazioni
    const { data: txs } = await supabase
      .from('transactions')
      .select('*, announcements(id, title, price, condition, image_url)')
      .order('created_at', { ascending: false })

    // 2. Recuperiamo tutti gli utenti (Profili completi)
    const { data: profs } = await supabase
      .from('profiles')
      .select('*') // Prende tutti i campi disponibili nel DB

    if (profs) {
      setProfiles(profs as Profile[])
    }

    if (txs) {
      // Arricchiamo i dati con le email di compratori e venditori per farti capire chi sono
      const enrichedTxs = await Promise.all(txs.map(async (tx) => {
        const { data: buyerData } = await supabase.from('profiles').select('email').eq('id', tx.buyer_id).single()
        const { data: sellerData } = await supabase.from('profiles').select('email').eq('id', tx.seller_id).single()
        return { ...tx, buyer: buyerData, seller: sellerData }
      }))
      setTransactions(enrichedTxs as unknown as Transaction[])
    }
    setLoading(false)
  }

  // --- FUNZIONI TRANSAZIONI ---
  const forceStatus = async (txId: string, newStatus: string) => {
    if (!window.confirm(`Sei sicuro di forzare lo stato a: ${newStatus}?`)) return;
    
    setLoading(true)
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', txId)
    
    if (!error) {
      alert(`Status aggiornato a ${newStatus}!`)
      checkAdminAndFetchData()
    } else {
      alert("Errore aggiornamento: " + error.message)
      setLoading(false)
    }
  }

  // --- NUOVE FUNZIONI SICUREZZA E ISPEZIONE ---
  const viewUserDetails = async (profile: Profile) => {
    setSelectedUser(profile)
    setIsModalOpen(true)
    
    // Recupera tutta la chat dell'utente (sia inviati che ricevuti)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
      .order('created_at', { ascending: false })
    
    if (data) {
      setUserMessages(data)
    }
  }

  const deleteChats = async (userId: string) => {
    if (!window.confirm("Sei sicuro di voler ELIMINARE TUTTE LE CHAT di questo utente? L'azione è irreversibile.")) return;
    setLoading(true)
    
    const { error } = await supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    
    if (!error) {
      alert("Tutte le chat dell'utente sono state spazzate via.")
      if (selectedUser?.id === userId) setIsModalOpen(false)
      checkAdminAndFetchData()
    } else {
      alert("Errore durante l'eliminazione delle chat: " + error.message)
      setLoading(false)
    }
  }

  const deleteProfile = async (userId: string) => {
    if (!window.confirm("ATTENZIONE NUCLEARE: Vuoi davvero ELIMINARE questo profilo? Verranno cancellati anche i suoi annunci e messaggi dal sito.")) return;
    setLoading(true)
    
    // Eliminiamo a cascata dal database pubblico (Messaggi -> Annunci -> Profilo)
    await supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    await supabase.from('announcements').delete().eq('user_id', userId)
    const { error } = await supabase.from('profiles').delete().eq('id', userId)
    
    if (!error) {
      alert("Profilo e dati connessi eliminati con successo. L'utente è stato rimosso dalla piattaforma.")
      if (selectedUser?.id === userId) setIsModalOpen(false)
      checkAdminAndFetchData()
    } else {
      alert("Errore durante l'eliminazione del profilo: " + error.message)
      setLoading(false)
    }
  }

  if (loading && transactions.length === 0) return <div className="min-h-screen bg-stone-900 flex justify-center items-center font-black uppercase tracking-widest text-rose-500 text-xs">Accesso Admin in corso...</div>

  return (
    <div className="min-h-screen bg-stone-900 p-6 md:p-10 font-sans relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER ADMIN */}
        <div className="flex justify-between items-center mb-10 border-b border-stone-800 pb-6">
          <div>
            <span className="bg-rose-500 text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Admin Mode</span>
            <h1 className="text-3xl font-black uppercase italic text-white">Stanza dei Bottoni</h1>
          </div>
          <button onClick={() => router.push('/')} className="text-[10px] font-bold text-stone-400 uppercase hover:text-white transition-colors">
            ← Torna al Sito
          </button>
        </div>

        {/* STATISTICHE */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-stone-800 p-6 rounded-3xl border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Totale Transazioni</h3>
            <p className="text-3xl font-black text-white">{transactions.length}</p>
          </div>
          <div className="bg-stone-800 p-6 rounded-3xl border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Dispute / Rimborsi</h3>
            <p className="text-3xl font-black text-rose-500">{transactions.filter(t => t.status === 'Rimborsato' || t.status === 'In_Contestazione').length}</p>
          </div>
          <div className="bg-stone-800 p-6 rounded-3xl border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Fondi Congelati</h3>
            <p className="text-3xl font-black text-orange-400">{transactions.filter(t => t.status === 'Pagato').length}</p>
          </div>
          <div className="bg-stone-800 p-6 rounded-3xl border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Conclusi con successo</h3>
            <p className="text-3xl font-black text-emerald-400">{transactions.filter(t => t.status === 'Concluso' || t.status === 'Ricevuto').length}</p>
          </div>
        </div>

        {/* TABELLA TRANSAZIONI */}
        <div className="bg-stone-800 rounded-[2rem] border border-stone-700 overflow-hidden shadow-2xl mb-10">
          <div className="p-6 border-b border-stone-700 bg-stone-900/50">
            <h2 className="text-lg font-black uppercase italic text-white">💰 Gestione Transazioni</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-300">
              <thead className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-900/50">
                <tr>
                  <th className="px-6 py-4">Annuncio</th>
                  <th className="px-6 py-4">Modalità</th>
                  <th className="px-6 py-4">Compratore</th>
                  <th className="px-6 py-4">Venditore</th>
                  <th className="px-6 py-4">Status DB</th>
                  <th className="px-6 py-4 text-right">Azioni Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700/50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-stone-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={tx.announcements.image_url} className="w-10 h-10 rounded-lg object-cover" alt="item" />
                        <span className="font-bold text-white truncate max-w-[150px] block">{tx.announcements.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${tx.announcements.condition === 'Baratto' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        {tx.announcements.condition}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[11px]">{tx.buyer?.email || tx.buyer_id.substring(0,8)}</td>
                    <td className="px-6 py-4 text-[11px]">{tx.seller?.email || tx.seller_id.substring(0,8)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                        tx.status === 'Pagato' ? 'bg-orange-500/20 text-orange-400' :
                        tx.status === 'Ricevuto' || tx.status === 'Concluso' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => forceStatus(tx.id, 'Rimborsato')} className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">
                        Forza Rimborso
                      </button>
                      <button onClick={() => forceStatus(tx.id, 'Ricevuto')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors">
                        Sblocca Fondi
                      </button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-[10px] font-bold uppercase tracking-widest text-stone-500">
                      Nessuna transazione trovata nel database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TABELLA UTENTI E SICUREZZA */}
        <div className="bg-stone-800 rounded-[2rem] border border-rose-900/50 overflow-hidden shadow-2xl mb-10">
          <div className="p-6 border-b border-stone-700 bg-stone-900/50">
            <h2 className="text-lg font-black uppercase italic text-rose-500">🛡️ Gestione Utenti e Sicurezza</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-stone-300">
              <thead className="text-[10px] font-black text-stone-400 uppercase tracking-widest bg-stone-900/50">
                <tr>
                  <th className="px-6 py-4">ID Utente</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4 text-right">Azioni Sicurezza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700/50">
                {profiles.map(p => (
                  <tr key={p.id} className="hover:bg-stone-700/20 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-mono text-stone-500">{p.id}</td>
                    <td className="px-6 py-4 font-bold text-white">{p.email}</td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button onClick={() => viewUserDetails(p)} className="bg-blue-500/10 border border-blue-500/50 hover:bg-blue-500 text-blue-400 hover:text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                        Vis. Dati & Chat
                      </button>
                      <button onClick={() => deleteChats(p.id)} className="bg-orange-500/10 border border-orange-500/50 hover:bg-orange-500 text-orange-400 hover:text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                        Svuota Chat
                      </button>
                      <button onClick={() => deleteProfile(p.id)} className="bg-rose-500/10 border border-rose-500/50 hover:bg-rose-600 text-rose-500 hover:text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all">
                        Elimina Profilo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODALE ISPEZIONE UTENTE E CHAT */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-700 rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header Modale */}
            <div className="p-6 border-b border-stone-800 flex justify-between items-center bg-stone-900">
              <div>
                <h2 className="text-xl font-black uppercase italic text-white">Spionaggio Utente</h2>
                <p className="text-[10px] text-stone-400 tracking-widest font-bold uppercase mt-1">{selectedUser.email}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-rose-500 transition-colors text-3xl leading-none">
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Sezione Dati Profilo Bruti */}
              <div className="bg-stone-800 rounded-2xl p-5 border border-stone-700">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3">Tutti i dati salvati (Database)</h3>
                <pre className="text-[11px] text-stone-300 overflow-x-auto whitespace-pre-wrap font-mono bg-stone-900 p-4 rounded-xl">
                  {JSON.stringify(selectedUser, null, 2)}
                </pre>
              </div>

              {/* Sezione Chat Spia */}
              <div className="bg-stone-800 rounded-2xl p-5 border border-stone-700">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-4">Cronologia Messaggi (Non Filtrati)</h3>
                <div className="space-y-3">
                  {userMessages.length === 0 ? (
                    <p className="text-stone-500 text-xs italic">Nessuna conversazione registrata per questo utente.</p>
                  ) : (
                    userMessages.map(msg => {
                      const isSender = msg.sender_id === selectedUser.id;
                      return (
                        <div key={msg.id} className={`p-4 rounded-2xl text-sm border flex flex-col ${isSender ? 'bg-stone-700/50 border-stone-600 ml-8 md:ml-16' : 'bg-stone-900 border-stone-800 mr-8 md:mr-16'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${isSender ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                              {isSender ? 'Messaggio Inviato' : 'Messaggio Ricevuto'}
                            </span>
                            <span className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">
                              {new Date(msg.created_at).toLocaleString('it-IT')}
                            </span>
                          </div>
                          <span className="text-white font-medium">{msg.content}</span>
                          <span className="text-[8px] text-stone-500 mt-2 uppercase tracking-widest">
                            ID Annuncio: {msg.announcement_id}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}