'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardOrdini() {
  const [activeTab, setActiveTab] = useState<'acquisti' | 'vendite'>('acquisti')
  const [purchases, setPurchases] = useState<any[]>([])
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingInput, setTrackingInput] = useState<{ [key: string]: string }>({})
  const [actionLoading, setActionLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetchOrders()
  }, [router])

  async function fetchOrders() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // 1. Recupera gli Acquisti (dove tu sei il buyer_id)
    const { data: myPurchases } = await supabase
      .from('transactions')
      .select('*, announcements(*)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })

    if (myPurchases) setPurchases(myPurchases)

    // 2. Recupera le Vendite (dove tu sei il proprietario dell'annuncio)
    const { data: mySales } = await supabase
      .from('transactions')
      .select('*, announcements!inner(*)')
      .eq('announcements.user_id', user.id)
      .order('created_at', { ascending: false })

    if (mySales) setSales(mySales)

    setLoading(false)
  }

  // Azione per il VENDITORE: Inserisce il tracking e segna come Spedito
  const handleMarkAsShipped = async (transactionId: string) => {
    const tracking = trackingInput[transactionId]
    if (!tracking || tracking.trim() === '') {
      alert("Inserisci un codice di tracciamento valido prima di confermare.")
      return
    }

    setActionLoading(true)
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'Spedito', tracking_code: tracking })
      .eq('id', transactionId)

    if (!error) {
      alert("Ordine segnato come SPEDITO!")
      fetchOrders() // Ricarica i dati
    } else {
      alert("Errore durante l'aggiornamento.")
    }
    setActionLoading(false)
  }

  // Azione per il COMPRATORE: Conferma di aver ricevuto il pacco
  const handleConfirmReceipt = async (transactionId: string) => {
    if (!confirm("Confermi di aver ricevuto l'oggetto in buone condizioni? Questo rilascerà i fondi al venditore.")) return

    setActionLoading(true)
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'Ricevuto' })
      .eq('id', transactionId)

    if (!error) {
      alert("Ottimo! Transazione conclusa. Ora puoi lasciare una recensione al venditore!")
      fetchOrders() // Ricarica i dati
    } else {
      alert("Errore durante l'aggiornamento.")
    }
    setActionLoading(false)
  }

  if (loading) return <div className="min-h-screen bg-stone-50 p-10 text-center font-bold uppercase text-[10px] tracking-widest text-stone-400">Caricamento ordini...</div>

  const displayedItems = activeTab === 'acquisti' ? purchases : sales

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 pt-10">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-8">I Miei Ordini <span className="text-rose-500">SECURE</span></h1>

        {/* TABS SELECTION */}
        <div className="flex gap-4 mb-8 bg-white p-2 rounded-2xl shadow-sm border border-stone-100">
          <button 
            onClick={() => setActiveTab('acquisti')} 
            className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'acquisti' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
          >
            I miei Acquisti
          </button>
          <button 
            onClick={() => setActiveTab('vendite')} 
            className={`flex-1 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'vendite' ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
          >
            Le mie Vendite
          </button>
        </div>

        {/* LISTA ORDINI */}
        {displayedItems.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center shadow-sm">
            <span className="text-5xl block mb-4">📭</span>
            <p className="text-stone-500 font-bold uppercase tracking-widest text-[11px]">Nessun ordine trovato qui.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {displayedItems.map((item) => (
              <div key={item.id} className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm flex flex-col md:flex-row gap-6 items-center">
                
                {/* Immagine Oggetto */}
                <div className="w-24 h-24 rounded-2xl overflow-hidden bg-stone-50 border border-stone-200 flex-shrink-0">
                  <img src={item.announcements?.image_url || '/usato.png'} className="w-full h-full object-cover" alt="Oggetto" />
                </div>

                {/* Dettagli Base */}
                <div className="flex-1 text-center md:text-left">
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded tracking-widest ${
                    item.status === 'Pagato' ? 'bg-blue-50 text-blue-500' : 
                    item.status === 'Spedito' ? 'bg-orange-50 text-orange-500' : 
                    'bg-emerald-50 text-emerald-500'
                  }`}>
                    Stato: {item.status || 'Pagato'}
                  </span>
                  <h3 className="text-lg font-bold uppercase text-stone-900 mt-2">{item.announcements?.title || 'Annuncio Eliminato'}</h3>
                  <p className="text-[10px] text-stone-400 font-medium uppercase tracking-wider mt-1">
                    Data: {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  {item.tracking_code && (
                    <p className="text-xs font-bold text-stone-700 mt-2 bg-stone-50 inline-block px-3 py-1 rounded-lg border border-stone-200">
                      🚚 Tracking: {item.tracking_code}
                    </p>
                  )}
                </div>

                {/* LOGICA AZIONI (Cambia tra Acquirente e Venditore) */}
                <div className="w-full md:w-auto flex flex-col gap-2 min-w-[200px]">
                  
                  {/* SEZIONE ACQUISTI (Compratore) */}
                  {activeTab === 'acquisti' && (
                    <>
                      {item.status === 'Pagato' && (
                        <p className="text-[10px] text-center font-bold text-stone-400 uppercase tracking-widest bg-stone-50 p-3 rounded-xl border border-stone-100">
                          In attesa di spedizione
                        </p>
                      )}
                      {item.status === 'Spedito' && (
                        <button 
                          disabled={actionLoading}
                          onClick={() => handleConfirmReceipt(item.id)}
                          className="bg-emerald-500 text-white w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md"
                        >
                          {actionLoading ? 'Attendi...' : '✓ Conferma Ricezione'}
                        </button>
                      )}
                      {item.status === 'Ricevuto' && (
                         <Link href={`/announcement/${item.announcements?.id}`} className="block text-center bg-stone-900 text-white w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-all shadow-md">
                           Lascia Recensione
                         </Link>
                      )}
                    </>
                  )}

                  {/* SEZIONE VENDITE (Venditore) */}
                  {activeTab === 'vendite' && (
                    <>
                      {item.status === 'Pagato' && (
                        <div className="flex flex-col gap-2">
                          <input 
                            type="text" 
                            placeholder="Es. IT123456789 (SDA)" 
                            className="w-full p-2 text-xs border border-stone-200 rounded-lg outline-none focus:border-rose-400"
                            onChange={(e) => setTrackingInput({...trackingInput, [item.id]: e.target.value})}
                          />
                          <button 
                            disabled={actionLoading}
                            onClick={() => handleMarkAsShipped(item.id)}
                            className="bg-gradient-to-r from-rose-500 to-orange-400 text-white w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] transition-all shadow-md"
                          >
                            {actionLoading ? 'Attendi...' : 'Segna come Spedito'}
                          </button>
                        </div>
                      )}
                      {item.status === 'Spedito' && (
                        <p className="text-[10px] text-center font-bold text-stone-400 uppercase tracking-widest bg-stone-50 p-3 rounded-xl border border-stone-100">
                          In attesa che l'acquirente confermi
                        </p>
                      )}
                      {item.status === 'Ricevuto' && (
                        <p className="text-[10px] text-center font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                          ✓ Transazione Conclusa
                        </p>
                      )}
                    </>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
