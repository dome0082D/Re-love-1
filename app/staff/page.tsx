'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// --- INTERFACCE DATI ---
interface Transaction {
  id: string;
  created_at: string;
  status: string;
  buyer_id: string;
  seller_id: string;
  stripe_payment_intent_id: string;
  courier_name?: string;      
  tracking_number?: string;   
  package_id_code?: string;   
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
  first_name?: string;
  last_name?: string;
  city?: string;
  address?: string;
  full_address?: string;
  created_at: string;
  stripe_account_id?: string;
  role?: string;
  nickname?: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  reviewer_id?: string;
  reviewed_user_id?: string;
  reviewer?: { email: string };
  reviewed?: { email: string };
}

export default function AdminDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  
  // STATO PER IL TRIBUNALE E SUPPORTO
  const [disputes, setDisputes] = useState<any[]>([])

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Stati per la modale di ispezione
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
    
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/')
      return
    }

    try {
      // 1. Recupero Transazioni con Annunci
      const { data: txs, error: txError } = await supabase
        .from('transactions')
        .select('*, announcements(*)')
        .order('created_at', { ascending: false })
      if (txError) console.error("Errore txs:", txError)

      // 2. Recupero Profili (per le email)
      const { data: profs, error: profsError } = await supabase.from('profiles').select('*')
      if (profsError) console.error("Errore profili:", profsError)

      // 3. Recupero Recensioni
      const { data: revs, error: revsError } = await supabase
        .from('reviews')
        .select('*')
      if (revsError) console.error("Errore reviews:", revsError)

      // 4. Recupero Controversie e Supporto (Il Tribunale)
      const { data: dispData, error: dispError } = await supabase
        .from('disputes')
        .select('*, transaction:transactions(*, announcements(*))')
        .order('created_at', { ascending: false })
      if (dispError) console.error("Errore controversie:", dispError)
      else if (dispData) setDisputes(dispData)

      let loadedProfiles: Profile[] = []
      if (profs) {
        loadedProfiles = profs as Profile[]
        setProfiles(loadedProfiles)
      }
      
      // Abbiniamo le email alle transazioni
      if (txs && loadedProfiles.length > 0) {
        const enrichedTxs = txs.map(tx => ({
          ...tx,
          buyer: { email: loadedProfiles.find(p => p.id === tx.buyer_id)?.email || 'N/D' },
          seller: { email: loadedProfiles.find(p => p.id === tx.seller_id)?.email || 'N/D' }
        }))
        setTransactions(enrichedTxs as unknown as Transaction[])
      }

      // Abbiniamo le email alle recensioni MANUALMENTE
      if (revs && loadedProfiles.length > 0) {
        const enrichedRevs = revs.map(r => ({
          ...r,
          reviewer: { email: loadedProfiles.find(p => p.id === r.reviewer_id)?.email || 'N/D' },
          reviewed: { email: loadedProfiles.find(p => p.id === r.reviewed_user_id)?.email || 'N/D' }
        }))
        setReviews(enrichedRevs as unknown as Review[])
      }

    } catch (err) {
      console.error("Errore generale:", err)
    }
    
    setLoading(false)
  }

  // --- LOGICA AZIONI ADMIN ---

  const forceStatus = async (txId: string, newStatus: string) => {
    if (!confirm(`Vuoi forzare lo stato a: ${newStatus}?`)) return

    // FIX: "Ricevuto" qui scriveva solo l'etichetta di stato senza mai
    // sbloccare i fondi veri al venditore - la dashboard diceva "sbloccato"
    // ma nessun euro si spostava. Ora, solo per questo stato specifico,
    // passiamo dalla route /api/orders/action che esegue il vero
    // trasferimento Stripe (la stessa già usata dalla pagina ordini normale,
    // qui con un permesso speciale per lo staff).
    if (newStatus === 'Ricevuto') {
      setActionLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const res = await fetch('/api/orders/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId: txId, action: 'confirm_receipt', userId: user?.id, userRole: 'staff' }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          alert("Errore nello sblocco fondi: " + (data.error || 'errore sconosciuto'))
          return
        }
        alert("Fondi trasferiti al venditore.")
        checkAdminAndFetchData()
      } catch (err: any) {
        alert("Errore di connessione: " + err.message)
      } finally {
        setActionLoading(false)
      }
      return
    }

    // ATTENZIONE - NON RISOLTO: "Rimborsato" invece scrive solo l'etichetta
    // di stato, come prima - nessun rimborso Stripe reale parte da qui.
    // Non ho aggiunto io la chiamata a stripe.refunds.create(...): quanto
    // rimborsare (intero? trattenendo la commissione già presa?) e se va
    // gestito diversamente in caso i fondi al venditore siano già stati
    // sbloccati sono scelte che spettano a te, non qualcosa che dovrei
    // decidere al posto tuo.
    const { error } = await supabase.from('transactions').update({ status: newStatus }).eq('id', txId)
    if (error) {
      alert("Errore durante l'aggiornamento: " + error.message)
      return
    }
    checkAdminAndFetchData()
  }

  const updateShipping = async (txId: string, courier: string, track: string, code: string) => {
    if (!confirm(`Vuoi salvare la spedizione con ${courier} e segnare l'ordine come Spedito?`)) return;
    
    const { error } = await supabase
      .from('transactions')
      .update({ 
        courier_name: courier, 
        tracking_number: track, 
        package_id_code: code,
        status: 'Spedito' 
      })
      .eq('id', txId);
      
    if (!error) {
      alert("Spedizione aggiornata!");
      checkAdminAndFetchData();
    } else {
      alert("Errore: " + error.message);
    }
  };

  const deleteReview = async (id: string) => {
    if (!confirm("Eliminare definitivamente questa recensione?")) return
    // FIX: prima l'esito non veniva controllato - la recensione poteva
    // restare visibile pur avendo premuto "elimina", senza alcun avviso.
    const { error } = await supabase.from('reviews').delete().eq('id', id)
    if (error) {
      alert("Errore durante l'eliminazione: " + error.message)
      return
    }
    checkAdminAndFetchData()
  }

  const viewUserDetails = async (profile: Profile) => {
    setSelectedUser(profile)
    setIsModalOpen(true)
    
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},receiver_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        
      if (error) {
        console.error("Errore recupero messaggi:", error)
        setUserMessages([])
      } else {
        setUserMessages(data || [])
      }
    } catch (err) {
      console.error("Errore catch messaggi:", err)
    }
  }

  const deleteChats = async (userId: string) => {
    if (!confirm("Sei sicuro? Questa azione eliminerà TUTTE le chat (inviate e ricevute) di questo utente in modo irreversibile.")) return
    
    try {
      const { error } = await supabase.rpc('delete_user_chats', { target_user_id: userId })
      
      if (!error) {
        alert("Tutte le chat dell'utente sono state spazzate via con successo. 🌪️")
        setUserMessages([]) 
        if (selectedUser?.id === userId) {
          viewUserDetails(selectedUser)
        }
      } else {
        alert("Errore durante l'eliminazione: " + error.message)
      }
    } catch (err: any) {
      alert("Errore: " + err.message)
    }
  }

  // NUOVA VERSIONE: USA LA SUPER-FUNZIONE SQL NUCLEARE POTENZIATA
  const deleteProfile = async (userId: string) => {
    if (!confirm("AZIONE NUCLEARE: Verranno eliminati messaggi, recensioni, transazioni, annunci, notifiche e l'ACCESSO AL SITO di questo utente. Sicuro di voler distruggere questi dati?")) return
    
    try {
      const { error } = await supabase.rpc('delete_user_cascade', { target_user_id: userId })
      
      if (error) {
        throw error
      }
      
      alert("L'utente è stato disintegrato con successo. 💥 Non esiste più nel database e non potrà più fare login.")
      setIsModalOpen(false)
      checkAdminAndFetchData()
    } catch (err: any) {
      alert("Il Database ha bloccato l'eliminazione per questo motivo:\n\n" + err.message + "\n\nAssicurati di aver eseguito l'ultimo script SQL in Supabase!")
    }
  }

  // --- LOGICA DEL TRIBUNALE ---
  const resolveDispute = async (disputeId: string, resolution: 'Rimborso Acquirente' | 'Fondi al Venditore', buyerId: string, sellerId: string, transactionId?: string) => {
    const confirmMessage = resolution === 'Rimborso Acquirente' 
      ? "⚠️ Sicuro di voler RIMBORSARE il compratore? L'azione è irreversibile." 
      : "⚠️ Sicuro di voler sbloccare i fondi e PAGARE il venditore?";

    if (!confirm(confirmMessage)) return;
    setActionLoading(true)

    // FIX: "Fondi al Venditore" chiudeva la contestazione e notificava "i
    // fondi sono stati sbloccati" senza mai trasferire un euro davvero.
    // Ora, per questa risoluzione specifica, tentiamo prima il vero
    // trasferimento Stripe (stessa route usata sopra per "Sblocca") - se
    // fallisce, la contestazione NON viene chiusa, così non risulta
    // "risolta" una pratica dove i soldi non si sono davvero mossi.
    if (resolution === 'Fondi al Venditore' && transactionId) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const res = await fetch('/api/orders/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionId, action: 'confirm_receipt', userId: user?.id, userRole: 'staff' }),
        })
        const data = await res.json()
        if (!res.ok || data.error) {
          alert("Errore nel trasferimento fondi: " + (data.error || 'errore sconosciuto') + "\nLa contestazione resta aperta.")
          setActionLoading(false)
          return
        }
      } catch (err: any) {
        alert("Errore di connessione durante il trasferimento: " + err.message + "\nLa contestazione resta aperta.")
        setActionLoading(false)
        return
      }
    }
    // ATTENZIONE - NON RISOLTO: "Rimborso Acquirente" chiude comunque solo
    // la pratica, senza un vero stripe.refunds.create(...) - stessa nota di
    // forceStatus qui sopra: decidere la policy di rimborso spetta a te.

    const { error } = await supabase.from('disputes').update({ status: `Risolta (${resolution})` }).eq('id', disputeId)

    if (!error) {
      alert(`Pratica chiusa con successo: ${resolution}!`);
      
      const sentenzaMsg = resolution === 'Rimborso Acquirente'
        ? `⚖️ Lo Staff ha chiuso la controversia a favore dell'Acquirente. È stato emesso un rimborso.`
        : `⚖️ Lo Staff ha chiuso la controversia a favore del Venditore. I fondi sono stati sbloccati.`;

      if (buyerId) await supabase.from('notifications').insert([{ user_id: buyerId, message: sentenzaMsg, is_read: false }]);
      if (sellerId) await supabase.from('notifications').insert([{ user_id: sellerId, message: sentenzaMsg, is_read: false }]);

      checkAdminAndFetchData()
    } else {
      alert("Errore: " + error.message)
    }
    setActionLoading(false)
  }

  const closeSupportTicket = async (disputeId: string, userId: string) => {
    const risposta = prompt("Scrivi la risposta da inviare all'utente (Riceverà una notifica nel sito):");
    if (!risposta) return;

    setActionLoading(true)
    const { error } = await supabase.from('disputes').update({ status: 'Risolta (Risposto)' }).eq('id', disputeId)

    if (!error) {
      alert("Risposta inviata con successo!");
      await supabase.from('notifications').insert([{ user_id: userId, message: `💬 Risposta Supporto: ${risposta}`, is_read: false }]);
      checkAdminAndFetchData()
    } else {
       alert("Errore durante l'invio della risposta.")
    }
    setActionLoading(false)
  }


  // --- CALCOLI DASHBOARD ---
  const earnings = transactions
    .filter(t => t.status === 'Ricevuto' || t.status === 'Concluso')
    .reduce((acc, t) => acc + ((t.announcements?.price || 0) * 0.10), 0)

  if (loading && transactions.length === 0) return <div className="min-h-screen bg-stone-900 flex items-center justify-center font-black uppercase text-rose-500 tracking-widest animate-pulse">Caricamento Hub Re-love Staff...</div>

  return (
    <div className="min-h-screen bg-[#1c1c1c] p-6 md:p-12 font-sans text-stone-200">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6 border-b border-stone-800 pb-8">
          <div>
            <span className="bg-rose-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 inline-block shadow-lg shadow-rose-500/20">Staff Only</span>
            <h1 className="text-4xl font-black uppercase italic text-white tracking-tighter">Stanza dei Bottoni 👑</h1>
          </div>
          <button onClick={() => router.push('/')} className="bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-stone-700">← Torna al Sito</button>
        </div>

        {/* DASHBOARD FINANZIARIA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-8 rounded-[2.5rem] border border-emerald-500/20">
            <h3 className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-2">💰 Commissioni Reali (10%)</h3>
            <p className="text-5xl font-black text-white italic">€ {earnings.toFixed(2)}</p>
          </div>
          <div className="bg-stone-800/50 p-8 rounded-[2.5rem] border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-2">📦 Ordini Gestiti</h3>
            <p className="text-5xl font-black text-white italic">{transactions.length}</p>
          </div>
          <div className="bg-stone-800/50 p-8 rounded-[2.5rem] border border-stone-700">
            <h3 className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-2">👤 Utenti Registrati</h3>
            <p className="text-5xl font-black text-white italic">{profiles.length}</p>
          </div>
        </div>

        {/* ---------------- NUOVA SEZIONE: TRIBUNALE E SUPPORTO ---------------- */}
        <div className="bg-stone-800/40 p-8 rounded-[2.5rem] border border-rose-900/50 mb-12 shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-stone-800 pb-4">
            <h2 className="text-lg font-black uppercase italic text-rose-500 tracking-tighter flex items-center gap-3">
              <span className="text-2xl">⚖️</span> Tribunale & Supporto Clienti
            </h2>
          </div>
          
          {disputes.length === 0 ? (
            <p className="text-center text-xs font-bold text-stone-500 uppercase py-10">Nessuna segnalazione attiva. Tutto tranquillo.</p>
          ) : (
            <div className="space-y-4">
              {disputes.map(dispute => {
                const isClosed = dispute.status.includes('Risolta');
                const isSupport = !dispute.seller_id; // Se non c'è venditore, è supporto
                
                return (
                  <div key={dispute.id} className={`p-6 rounded-3xl border ${isClosed ? 'border-[#333] bg-[#1f1f1f] opacity-60' : isSupport ? 'border-blue-900/50 bg-[#1c2433]' : 'border-rose-900/50 bg-[#331c1c]'} flex flex-col md:flex-row justify-between items-start md:items-center gap-6`}>
                    <div className="flex-1">
                      <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${isClosed ? 'bg-[#333] text-stone-400' : isSupport ? 'bg-blue-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {dispute.status}
                      </span>
                      <h4 className="text-white font-black mt-3 uppercase text-sm">{dispute.reason}</h4>
                      <p className="text-xs text-stone-300 mt-2 italic font-medium">"{dispute.description}"</p>
                      
                      {!isSupport && dispute.transaction && (
                        <p className="text-[10px] font-bold text-stone-400 mt-3 uppercase tracking-widest bg-black/20 p-2 rounded-lg inline-block border border-black/10">
                          📦 Ordine: {dispute.transaction.announcements?.title} (€{dispute.transaction.amount})
                        </p>
                      )}
                      
                      <div className="flex gap-4 mt-3">
                        <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Da Utente: <span className="text-stone-300">{dispute.buyer_id.slice(0,8)}</span></p>
                        {!isSupport && dispute.seller_id && (
                          <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest">Vs Utente: <span className="text-stone-300">{dispute.seller_id.slice(0,8)}</span></p>
                        )}
                      </div>
                    </div>

                    {/* AZIONI GIUDICE */}
                    {!isClosed && (
                      <div className="flex flex-col gap-2 w-full md:w-56 min-w-[200px]">
                        {isSupport ? (
                          <button onClick={() => closeSupportTicket(dispute.id, dispute.buyer_id)} disabled={actionLoading} className="bg-blue-600 text-white py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg">
                            💬 Rispondi all'utente
                          </button>
                        ) : (
                          <>
                            <button onClick={() => resolveDispute(dispute.id, 'Rimborso Acquirente', dispute.buyer_id, dispute.seller_id, dispute.transaction_id)} disabled={actionLoading} className="bg-rose-600 text-white py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all shadow-lg">
                              💸 Rimborsa Acquirente
                            </button>
                            <button onClick={() => resolveDispute(dispute.id, 'Fondi al Venditore', dispute.buyer_id, dispute.seller_id, dispute.transaction_id)} disabled={actionLoading} className="bg-emerald-600 text-white py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-lg">
                              ✅ Paga Venditore
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>


        {/* TABELLA TRANSAZIONI */}
        <div className="bg-stone-800/40 rounded-[2.5rem] border border-stone-800 overflow-hidden mb-12 backdrop-blur-sm shadow-2xl">
          <div className="p-8 bg-stone-900/40 border-b border-stone-800 flex justify-between items-center">
            <h2 className="text-lg font-black uppercase italic text-white">Gestione Flussi Cassa & Spedizioni</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-stone-900/60 text-[10px] font-black uppercase text-stone-500 tracking-widest">
                <tr>
                  <th className="px-8 py-5">Annuncio</th>
                  <th className="px-8 py-5">Compratore</th>
                  <th className="px-8 py-5">Stato & Spedizione</th>
                  <th className="px-8 py-5 text-right">Intervento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/50">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img src={tx.announcements?.image_url} className="w-12 h-12 rounded-xl object-cover border border-stone-700" alt="img" />
                        <div>
                          <p className="font-black text-white uppercase text-sm italic">{tx.announcements?.title}</p>
                          <p className="text-[10px] text-stone-500 font-bold">€ {tx.announcements?.price}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs font-bold text-stone-400">{tx.buyer?.email}</p>
                      <p className="text-[9px] text-stone-600 mt-1 uppercase">Venditore: {tx.seller?.email}</p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-3">
                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-md w-fit ${
                          tx.status === 'Pagato' ? 'bg-orange-500/20 text-orange-400' : 
                          tx.status === 'Spedito' ? 'bg-blue-500/20 text-blue-400' :
                          tx.status === 'Ricevuto' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>{tx.status}</span>
                        
                        {(tx.status === 'Pagato' || tx.status === 'Spedito') && (
                          <div className="flex flex-col gap-2 w-48">
                            <input id={`cour-${tx.id}`} defaultValue={tx.courier_name} placeholder="Corriere (es. BRT)" className="bg-stone-900 text-[10px] font-bold text-white p-2 rounded-lg border border-stone-700 outline-none focus:border-emerald-500" />
                            <input id={`track-${tx.id}`} defaultValue={tx.tracking_number} placeholder="N. Spedizione" className="bg-stone-900 text-[10px] font-bold text-white p-2 rounded-lg border border-stone-700 outline-none focus:border-emerald-500" />
                            <button 
                              onClick={() => {
                                const c = (document.getElementById(`cour-${tx.id}`) as HTMLInputElement).value;
                                const t = (document.getElementById(`track-${tx.id}`) as HTMLInputElement).value;
                                updateShipping(tx.id, c, t, "REV-" + tx.id.substring(0,8).toUpperCase());
                              }}
                              className="bg-stone-800 hover:bg-emerald-600 text-stone-400 hover:text-white text-[9px] font-black uppercase p-2 rounded-lg transition-colors border border-stone-700 hover:border-emerald-500 mt-1"
                            >
                              {tx.status === 'Spedito' ? 'Aggiorna Dati' : 'Salva & Segna Spedito'}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right align-top">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => forceStatus(tx.id, 'Ricevuto')} disabled={actionLoading} className="bg-emerald-500 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase disabled:opacity-50">Sblocca</button>
                        <button onClick={() => forceStatus(tx.id, 'Rimborsato')} disabled={actionLoading} className="bg-rose-500 text-white px-3 py-2 rounded-lg text-[9px] font-black uppercase disabled:opacity-50">Refund</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* GESTIONE UTENTI */}
          <div className="bg-stone-800/40 rounded-[2.5rem] border border-stone-800 overflow-hidden">
            <div className="p-8 bg-stone-900/40 border-b border-stone-800"><h2 className="text-lg font-black uppercase italic text-white">Anagrafica & Sicurezza</h2></div>
            <div className="max-h-[600px] overflow-y-auto">
              {profiles.map(p => (
                <div key={p.id} className="p-6 border-b border-stone-800/50 flex justify-between items-center hover:bg-white/[0.02] transition-colors">
                  <div>
                    <p className="font-black text-white text-sm">{p.email}</p>
                    <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{p.city || 'Città non impostata'}</p>
                  </div>
                  <button onClick={() => viewUserDetails(p)} className="bg-blue-500/10 border border-blue-500/40 text-blue-400 hover:bg-blue-50 hover:text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all">Ispeziona</button>
                </div>
              ))}
            </div>
          </div>

          {/* GESTIONE RECENSIONI */}
          <div className="bg-stone-800/40 rounded-[2.5rem] border border-stone-800 overflow-hidden">
            <div className="p-8 bg-stone-900/40 border-b border-stone-800"><h2 className="text-lg font-black uppercase italic text-white">Feedback Community</h2></div>
            <div className="max-h-[600px] overflow-y-auto p-6 space-y-4">
              {reviews.map(r => (
                <div key={r.id} className="bg-stone-900/50 p-5 rounded-3xl border border-stone-700/50 relative group">
                  <button onClick={() => deleteReview(r.id)} className="absolute top-4 right-4 text-stone-600 hover:text-rose-500 text-xl transition-colors">&times;</button>
                  <p className="text-[9px] font-black uppercase text-stone-500 mb-2">Da: {r.reviewer?.email || 'Sconosciuto'} → Per: {r.reviewed?.email || 'Sconosciuto'}</p>
                  <div className="flex gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < r.rating ? 'text-yellow-500' : 'text-stone-700'}>★</span>
                    ))}
                  </div>
                  <p className="text-xs text-stone-300 italic font-medium leading-relaxed">"{r.comment}"</p>
                </div>
              ))}
              {reviews.length === 0 && <p className="text-center text-stone-600 text-xs py-10 uppercase font-black">Nessuna recensione da moderare.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* MODALE DI ISPEZIONE TOTALE */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-[3rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            
            <div className="p-10 border-b border-stone-800 flex justify-between items-center bg-stone-900">
              <div>
                <h2 className="text-3xl font-black uppercase italic text-white">Profilo Sotto Lente</h2>
                <p className="text-rose-500 text-xs font-bold uppercase tracking-[0.3em] mt-1">{selectedUser.email || 'Nessuna Email'}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-500 hover:text-white text-5xl transition-colors leading-none">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-10">
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { l: '📧 Indirizzo Email', v: selectedUser.email || '⚠️ Vuota (Inseriscila da Supabase)' },
                  { l: '👤 Nome', v: selectedUser.first_name || 'Non inserito' },
                  { l: '👥 Cognome', v: selectedUser.last_name || 'Non inserito' },
                  { l: '🏙️ Città', v: selectedUser.city || 'Non inserito' },
                  { l: '📍 Indirizzo', v: selectedUser.address || 'Non inserito' },
                  { l: '📅 Data Iscrizione', v: new Date(selectedUser.created_at).toLocaleString('it-IT') },
                  { l: '🛡️ Ruolo Sistema', v: selectedUser.role || 'user' },
                  { l: '🆔 ID Database', v: selectedUser.id },
                  { l: '💳 Stripe Connect', v: selectedUser.stripe_account_id || 'Account non collegato' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-stone-800 p-5 rounded-2xl border border-stone-700/50">
                    <p className="text-[9px] font-black uppercase text-stone-500 tracking-widest mb-2">{item.l}</p>
                    <p className="text-sm font-bold text-white truncate" title={item.v}>{item.v}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[11px] font-black uppercase text-blue-400 tracking-[0.3em] mb-6 flex items-center gap-3">
                  <span className="w-10 h-[1px] bg-blue-500/30"></span> 
                  Cronologia Chat (Sola Lettura)
                </h3>
                <div className="space-y-4">
                  {userMessages.length === 0 ? (
                    <p className="text-stone-600 text-xs italic text-center py-10 bg-stone-800/30 rounded-3xl border border-dashed border-stone-700">L'utente non ha ancora scambiato messaggi sulla piattaforma.</p>
                  ) : (
                    userMessages.map(msg => (
                      <div key={msg.id} className={`p-5 rounded-[2rem] text-sm border flex flex-col ${msg.sender_id === selectedUser.id ? 'bg-stone-800 border-stone-700 ml-12' : 'bg-stone-900 border-stone-800 mr-12'}`}>
                        <div className="flex justify-between items-center mb-3">
                          <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md ${msg.sender_id === selectedUser.id ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                            {msg.sender_id === selectedUser.id ? 'Messaggio Inviato' : 'Messaggio Ricevuto'}
                          </span>
                          <span className="text-[9px] font-bold text-stone-600 uppercase">{new Date(msg.created_at).toLocaleString('it-IT')}</span>
                        </div>
                        <p className="text-stone-200 font-medium leading-relaxed italic">"{msg.content}"</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-10 border-t border-stone-800 flex flex-wrap gap-4">
                <button onClick={() => deleteChats(selectedUser.id)} className="bg-orange-500/10 border border-orange-500/40 text-orange-500 hover:bg-orange-500 hover:text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  🔥 Svuota Chat
                </button>
                <button onClick={() => deleteProfile(selectedUser.id)} className="bg-rose-500 text-white hover:bg-rose-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20">
                  ⚠️ Elimina Utente a Cascata
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
