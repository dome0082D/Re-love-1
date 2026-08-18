'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [offersList, setOffersList] = useState<any[]>([]) 
  const [loading, setLoading] = useState(true)
  const [myId, setMyId] = useState('')

  // STATI PER IL SISTEMA RECENSIONI
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [orderToReview, setOrderToReview] = useState<any>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  useEffect(() => {
    fetchOrders()
  }, [])

  async function fetchOrders() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    // Recupero Ordini
    const { data: txData } = await supabase
      .from('transactions')
      .select('*, announcements(*)')
      // FIX: mancava "curator_id". Su una vendita con curatore, "seller_id" e'
      // il Proprietario: il Curatore - che e' proprio la persona incaricata di
      // seguire la vendita - non vedeva l'ordine da nessuna parte, quindi non
      // poteva ne' scrivere al compratore ne' seguire la spedizione.
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id},curator_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (txData) setOrders(txData)

    // Recupero Proposte
    const { data: offData } = await supabase
      .from('offers')
      .select('*, announcements(*)')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (offData) setOffersList(offData)

    setLoading(false)
  }

  const handleOfferAction = async (offerId: string, newStatus: string) => {
    if (!window.confirm(`Vuoi davvero ${newStatus.toLowerCase()} questa proposta?`)) return;
    setLoading(true);
    const { error } = await supabase.from('offers').update({ status: newStatus }).eq('id', offerId);
    if (error) alert("Errore: " + error.message);
    fetchOrders(); 
  }

  const handleAction = async (transactionId: string, action: string, userRole: string) => {
    if (!window.confirm("Sei sicuro di voler procedere?")) return;
    
    setLoading(true)
    const res = await fetch('/api/orders/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, action, userId: myId, userRole })
    })
    const data = await res.json()
    if (data.success) {
      alert(data.message)
      fetchOrders()
    } else {
      alert("Errore: " + data.error)
      setLoading(false)
    }
  }

  const submitReview = async () => {
    if (!orderToReview) return
    setSubmittingReview(true)

    // FIX: due colonne sbagliate insieme - "reviewed_user_id" (in tabella si
    // chiama "reviewed_id") e "announcement_id", che nella tabella delle
    // recensioni non esiste proprio. Il database rispondeva 400 e nessuna
    // recensione veniva mai salvata.
    const { error } = await supabase.from('reviews').insert([{
      transaction_id: orderToReview.id,
      reviewer_id: myId,
      reviewed_id: orderToReview.seller_id,
      rating: rating,
      comment: comment
    }])

    if (!error) {
      alert("Grazie! La tua recensione è stata pubblicata. ⭐")
      setShowReviewModal(false)
      setRating(5)
      setComment('')
      fetchOrders() 
    } else {
      alert("Errore: " + error.message)
    }
    setSubmittingReview(false)
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex justify-center items-center font-black text-stone-400 text-xs tracking-widest uppercase">Caricamento Hub...</div>

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10 pb-32">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black uppercase italic text-stone-900 mb-12">Hub Transazioni</h1>

        {/* SEZIONE PROPOSTE MIGLIORATA */}
        {offersList.length > 0 && (
          <div className="mb-14 space-y-4">
            <h2 className="text-xs font-black uppercase text-stone-400 tracking-[0.2em] mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> Negoziazioni in corso
            </h2>
            {offersList.map(offer => {
              const isBuyer = offer.buyer_id === myId
              const ann = offer.announcements

              return (
                <div key={offer.id} className={`p-6 rounded-[2.5rem] border shadow-sm transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 
                  ${offer.status === 'In attesa' ? 'bg-orange-50/50 border-orange-200' : 
                    offer.status === 'Accettata' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'}`}>
                  
                  <div className="flex items-center gap-5">
                    <img loading="lazy" decoding="async" src={srcFoto(ann.image_url, 120)} srcSet={srcSetFoto(ann.image_url, 120)} className="w-16 h-16 object-cover rounded-2xl border border-stone-200 shadow-sm" alt="Item" />
                    <div>
                      <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest">{isBuyer ? 'Hai proposto' : 'Ti hanno proposto'}</p>
                      <h3 className="text-base font-black uppercase italic text-stone-900 mt-1">{ann.title}</h3>
                      <p className="text-xl font-black text-stone-900 mt-1">€ {offer.offer_price} <span className="text-xs text-stone-400 font-bold line-through ml-2">(era €{ann.price})</span></p>
                    </div>
                  </div>

                  <div className="w-full md:w-auto">
                    {!isBuyer && offer.status === 'In attesa' ? (
                      <div className="flex gap-3">
                        <button onClick={() => handleOfferAction(offer.id, 'Accettata')} className="flex-1 md:flex-none bg-emerald-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-emerald-600 transition-all shadow-md">✅ Accetta</button>
                        <button onClick={() => handleOfferAction(offer.id, 'Rifiutata')} className="flex-1 md:flex-none border-2 border-rose-200 text-rose-500 bg-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-rose-50 transition-all">❌ Rifiuta</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end w-full">
                        <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-lg mb-3 ${
                          offer.status === 'In attesa' ? 'bg-orange-200 text-orange-800' : 
                          offer.status === 'Accettata' ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-800'
                        }`}>{offer.status}</span>
                        {offer.status === 'Accettata' && (
                          <Link href={`/chat/${isBuyer ? offer.seller_id : offer.buyer_id}?ann=${ann.id}`} className="w-full md:w-auto bg-stone-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-rose-500 transition-all text-center shadow-md">
                            Vai in Chat per concludere
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <h2 className="text-xs font-black uppercase text-stone-400 tracking-[0.2em] mb-6">Ordini Definitivi</h2>
        
        <div className="space-y-8">
          {orders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[3rem] border border-stone-200 shadow-sm">
              <span className="text-6xl mb-6 block animate-bounce">🛍️</span>
              <h3 className="text-2xl font-black uppercase italic text-stone-900 mb-3">Tutto tace... per ora!</h3>
              <p className="text-sm font-medium text-stone-500 mb-8 max-w-sm mx-auto leading-relaxed">Non hai ancora completato acquisti o vendite. Il prossimo affare ti sta aspettando là fuori.</p>
              <Link href="/" className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-stone-900 transition-all">
                Esplora Re-love
              </Link>
            </div>
          ) : (
            orders.map(order => {
              const isBuyer = order.buyer_id === myId
              const role = isBuyer ? 'buyer' : 'seller'
              const ann = order.announcements

              return (
                <div key={order.id} className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm transition-all hover:shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg text-white ${ann.condition === 'Baratto' ? 'bg-blue-500' : 'bg-stone-900'}`}>
                        {ann.condition}
                      </span>
                      <h3 className="text-2xl font-black uppercase italic text-stone-900 mt-4 leading-none">{ann.title}</h3>
                      <p className="text-xs font-bold text-stone-500 uppercase mt-2">
                        Ruolo: <span className="text-stone-900">{isBuyer ? 'Acquirente' : 'Venditore'}</span> | Stato: <span className="text-rose-500 font-black">{order.status}</span>
                      </p>
                    </div>
                    <img loading="lazy" decoding="async" src={srcFoto(ann.image_url, 120)} srcSet={srcSetFoto(ann.image_url, 120)} className="w-20 h-20 object-cover rounded-2xl border border-stone-100 shadow-sm" alt="Item" />
                  </div>

                  {/* BOX TRACCIAMENTO SPEDIZIONE MIGLIORATO */}
                  {(order.status === 'Spedito' || order.status === 'Ricevuto' || order.status === 'Concluso') && isBuyer && order.tracking_number && (
                    <div className="mt-6 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
                      <h4 className="text-[10px] font-black uppercase text-emerald-600 mb-4 tracking-widest">🚚 Tracciamento Spedizione</h4>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-[10px] font-black text-stone-400 uppercase">Corriere</p>
                          <p className="text-sm font-bold text-stone-900 mt-1">{order.courier_name || 'In elaborazione...'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-stone-400 uppercase">Codice Tracking</p>
                          <p className="text-sm font-bold text-stone-900 mt-1">{order.tracking_number || 'Richiedi in chat'}</p>
                        </div>
                        <div className="col-span-2 pt-4 border-t border-emerald-200/50">
                          <p className="text-[10px] font-black text-stone-400 uppercase">Identificativo Pacco Re-love</p>
                          <p className="text-xs font-mono font-bold text-emerald-800 mt-1 bg-white/50 w-fit px-2 py-1 rounded">{order.package_id_code}</p>
                        </div>
                      </div>
                      <a 
                        href={`https://www.google.com/search?q=tracking+spedizione+${order.courier_name}+${order.tracking_number}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full mt-5 bg-white border border-emerald-200 text-emerald-700 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all flex justify-center items-center shadow-sm"
                      >
                        Cerca Tracking Online
                      </a>
                    </div>
                  )}

                  {/* AZIONI ORDINE */}
                  {(ann.condition === 'Nuovo' || ann.condition === 'Usato') && isBuyer && (order.status === 'Pagato' || order.status === 'Spedito') && (
                    <div className="mt-8 flex gap-4 pt-6 border-t border-stone-100">
                      <button onClick={() => handleAction(order.id, 'confirm_receipt', role)} className="flex-1 bg-stone-900 text-white p-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-md">
                        📦 Pacco Ricevuto
                      </button>
                      <button onClick={() => handleAction(order.id, 'request_refund', role)} className="flex-1 border-2 border-stone-200 text-stone-600 bg-white p-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-rose-500 hover:text-rose-500 transition-all">
                        ❌ Reclamo
                      </button>
                    </div>
                  )}

                  {ann.condition === 'Baratto' && order.status === 'Pagato' && (
                    <div className="mt-8 pt-6 border-t border-stone-100">
                      {(isBuyer && order.barter_confirmed_buyer) || (!isBuyer && order.barter_confirmed_seller) ? (
                        <p className="text-xs font-black uppercase text-orange-500 text-center tracking-widest bg-orange-50 p-5 rounded-2xl border border-orange-200">
                          Hai confermato. In attesa dell'altro utente...
                        </p>
                      ) : (
                        <button onClick={() => handleAction(order.id, 'confirm_barter', role)} className="w-full bg-blue-500 text-white p-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-lg">
                          🤝 Conferma Avvenuto Scambio
                        </button>
                      )}
                    </div>
                  )}

                  {isBuyer && (order.status === 'Ricevuto' || order.status === 'Concluso') && (
                    <div className="mt-6 pt-6 border-t border-stone-100">
                       <button 
                         onClick={() => { setOrderToReview(order); setShowReviewModal(true); }}
                         className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-900 p-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-md"
                       >
                         ⭐ Lascia Feedback al Venditore
                       </button>
                    </div>
                  )}

                  <div className="mt-8 text-center">
                    <Link href={`/chat/${isBuyer ? order.seller_id : order.buyer_id}?ann=${ann.id}`} className="text-xs font-black uppercase text-stone-400 hover:text-stone-900 tracking-widest underline decoration-stone-300 underline-offset-8">
                      Apri Chat Annuncio
                    </Link>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODALE RECENSIONE MIGLIORATA */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/95 backdrop-blur-md">
          <div className="bg-white max-w-md w-full rounded-[3.5rem] p-12 shadow-2xl border-t-[12px] border-yellow-400 animate-in zoom-in duration-300">
            <h2 className="text-3xl font-black uppercase italic text-stone-900 mb-3">Com'è andata?</h2>
            <p className="text-sm font-medium text-stone-500 mb-10 italic">La tua opinione aiuta la community di Re-love a crescere sicura.</p>
            <div className="flex justify-center gap-4 mb-10">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} className={`text-5xl transition-transform hover:scale-125 ${rating >= star ? 'text-yellow-400 drop-shadow-lg' : 'text-stone-200'}`}>★</button>
              ))}
            </div>
            <textarea 
              className="w-full p-6 bg-stone-50 border border-stone-200 rounded-3xl text-sm font-medium outline-none focus:border-yellow-400 focus:bg-white transition-all mb-10 min-h-[140px] text-stone-800"
              placeholder="Scrivi un commento..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="space-y-4">
              <button onClick={submitReview} disabled={submittingReview} className="w-full bg-stone-900 text-white py-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-emerald-500 transition-all disabled:opacity-50">
                {submittingReview ? 'Pubblicazione...' : 'Pubblica Recensione'}
              </button>
              <button onClick={() => setShowReviewModal(false)} className="w-full text-stone-400 py-3 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:text-stone-900 bg-stone-50 hover:bg-stone-100 transition-all">
                Annulla e chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}