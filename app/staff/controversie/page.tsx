'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { inviaNotifica } from '@/lib/pushNotify'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ControversiePage() {
  const [disputes, setDisputes] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  // STATI PER IL MODULO NUOVA SEGNALAZIONE
  const [showModal, setShowModal] = useState(false)
  const [selectedTx, setSelectedTx] = useState('')
  const [reason, setReason] = useState('Oggetto non ricevuto')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setLoadError(false)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    // FIX: prima, chi non era loggato vedeva la pagina restare bloccata per
    // sempre su "Caricamento pratiche..." - il "return" qui usciva dalla
    // funzione PRIMA di raggiungere il setLoading(false) finale, quindi lo
    // stato di caricamento non si sbloccava mai. In più mancava il
    // reindirizzamento al login, presente invece in tutte le altre pagine
    // dell'area riservata (acquisti, chat, ecc.).
    if (!currentUser) {
      router.push('/login')
      return
    }
    setUser(currentUser)

    // 1. Recupera le controversie già aperte
    const { data: dispData, error: dispError } = await supabase
      .from('disputes')
      .select('*, transaction:transactions(*, announcements(*))')
      .or(`buyer_id.eq.${currentUser.id},seller_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: false })

    // 2. Recupera gli acquisti per permettere di sceglierne uno nel modulo
    const { data: purchData, error: purchError } = await supabase
      .from('transactions')
      .select('*, announcements(*)')
      .eq('buyer_id', currentUser.id)
      .order('created_at', { ascending: false })

    // FIX: prima un errore di caricamento veniva ignorato in silenzio - la
    // pagina mostrava "Tutto tranquillo, nessuna controversia aperta",
    // identico a come appare quando davvero non ce ne sono. Su questa
    // pagina in particolare è un problema serio: chi la visita di solito lo
    // fa perché preoccupato per un ordine, e vedersi dire "tutto ok" per un
    // errore di rete invece che per la verità può essere fuorviante proprio
    // nel momento sbagliato.
    if (dispError || purchError) {
      console.error('Errore caricamento controversie/acquisti:', dispError || purchError)
      setLoadError(true)
      setLoading(false)
      return
    }

    if (dispData) setDisputes(dispData)

    if (purchData) {
      setPurchases(purchData)
      if (purchData.length > 0) {
        setSelectedTx(purchData[0].id) // Seleziona il primo di default
      }
    }

    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      alert("Descrivi il problema per favore.")
      return
    }
    setSubmitting(true)

    // FIX: aggiunto try/catch - senza, un fallimento di rete (Android
    // instabile) durante l'invio lasciava il pulsante bloccato su "Invio in
    // corso..." per sempre, proprio nel momento in cui l'utente sta già
    // segnalando un problema e ha meno pazienza per un altro imprevisto.
    try {
      // Troviamo il venditore di quell'ordine (se l'ordine esiste)
      const tx = purchases.find(p => p.id === selectedTx)
      const sellerId = tx?.announcements?.user_id || null

      const { error } = await supabase.from('disputes').insert([{
        transaction_id: selectedTx || null, // Se non c'è, sarà null (segnalazione generica)
        buyer_id: user.id,
        seller_id: sellerId,
        reason: reason,
        description: description,
        status: 'Aperta'
      }])

      if (error) {
        alert("Errore nell'invio: " + error.message)
        return
      }

      alert("Segnalazione inviata allo Staff con successo! I fondi sono stati congelati.")

      // Notifica al venditore (se esiste)
      if (sellerId) {
        // FIX: vietata dalla RLS se scritta dal browser (vedi /api/notify).
        await inviaNotifica({
          userId: sellerId,
          message: `⚠️ L'acquirente ha aperto una controversia per "${tx?.announcements?.title || 'un ordine'} ". Lo Staff interverrà a breve.`,
          title: 'Controversia aperta ⚠️',
          url: '/dashboard/controversie',
        })
      }

      setShowModal(false)
      setDescription('')
      fetchData() // Ricarica la pagina per far vedere la nuova pratica
    } catch (err: any) {
      console.error('Errore invio segnalazione:', err)
      alert("Errore di connessione. Riprova.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-rose-50 border-b border-rose-100 flex items-center justify-center relative overflow-hidden">
         <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">⚖️</div>
         <div className="text-center max-w-2xl px-6 relative z-10">
            <h1 className="text-4xl font-black uppercase italic text-stone-900 tracking-tighter mb-2">Tribunale Re-love</h1>
            <p className="text-rose-500 font-bold text-[10px] uppercase tracking-[0.3em]">Centro Risoluzione Controversie</p>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-stone-100 pb-4 gap-4">
          <h2 className="text-sm font-black uppercase text-stone-400 tracking-widest">Le tue pratiche attive</h2>
          
          {/* BOTTONE CHE APRE IL MODULO */}
          <button 
            onClick={() => setShowModal(true)} 
            className="bg-stone-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 transition-all shadow-md"
          >
            + Apri Segnalazione
          </button>
        </div>

        {loading ? (
          <p className="text-center text-stone-400 font-bold text-xs uppercase tracking-widest mt-12">Caricamento pratiche...</p>
        ) : loadError ? (
          <div className="bg-white border border-red-200 rounded-[3rem] p-16 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Controlla la connessione e riprova.</p>
            <button onClick={fetchData} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        ) : disputes.length === 0 ? (
          <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-[3rem] p-16 text-center">
            <span className="text-6xl block mb-4">🕊️</span>
            <h3 className="text-xl font-black uppercase text-stone-900 mb-2">Tutto tranquillo</h3>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Non ci sono controversie aperte. Le tue vendite vanno a gonfie vele!</p>
            <Link href="/dashboard/analitiche" className="text-[10px] font-black uppercase text-rose-500 hover:text-stone-900 tracking-widest underline">
              ← Torna al Seller Hub
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {disputes.map(dispute => (
              <div key={dispute.id} className="p-6 bg-white border border-stone-200 rounded-3xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${dispute.status === 'Aperta' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                    {dispute.status}
                  </span>
                  <h4 className="text-sm font-black text-stone-900 mt-2 uppercase">{dispute.reason}</h4>
                  <p className="text-[10px] font-bold text-stone-500 mt-1 uppercase tracking-widest">
                    Ordine: {dispute.transaction?.announcements?.title || 'Segnalazione Generica'}
                  </p>
                </div>
                <div className="bg-stone-50 px-4 py-3 rounded-xl border border-stone-100 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                  In attesa dello Staff
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODULO REALE PER LA SEGNALAZIONE (Ora appare sempre) */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative animate-in zoom-in duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-800 text-xl font-bold">✕</button>
            <div className="text-center mb-6">
              <span className="text-6xl block mb-2">📝</span>
              <h2 className="text-2xl font-black uppercase italic text-stone-900">Nuova Segnalazione</h2>
              <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest mt-1">Invia il modulo allo Staff</p>
            </div>
            
            <div className="space-y-4">
              
              <div>
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Quale ordine ha un problema?</label>
                <select value={selectedTx} onChange={(e) => setSelectedTx(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400">
                  {purchases.length === 0 ? (
                    <option value="">Nessun ordine (Segnalazione Generica)</option>
                  ) : (
                    purchases.map(p => (
                      <option key={p.id} value={p.id}>{p.announcements?.title} (€{p.amount})</option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Motivo della segnalazione</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400">
                  <option>Oggetto non ricevuto</option>
                  <option>Oggetto danneggiato / Diverso</option>
                  <option>Sospetto Oggetto Falso</option>
                  <option>Venditore non risponde</option>
                  <option>Altro problema generico</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Spiega la situazione allo Staff</label>
                <textarea 
                  rows={4} 
                  placeholder="Scrivi qui i dettagli per aiutarci a giudicare..." 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-medium text-sm outline-none mt-1 resize-none focus:border-rose-400"
                />
              </div>

              <button onClick={handleSubmit} disabled={submitting} className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-stone-900 transition-all disabled:opacity-50 mt-4 shadow-md">
                {submitting ? 'Invio in corso...' : 'Invia allo Staff'}
              </button>
              
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
