'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

function AnnouncementContent() {
  const { id } = useParams()
  const router = useRouter()
  const [ann, setAnn] = useState<any>(null)
  const [seller, setSeller] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCoffeeModal, setShowCoffeeModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  
  const [usePickup, setUsePickup] = useState(false)
  
  const [reviews, setReviews] = useState<any[]>([])
  const [hasPurchased, setHasPurchased] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [visibleReviews, setVisibleReviews] = useState(3)

  // STATI PER "FAI UNA PROPOSTA"
  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerPrice, setOfferPrice] = useState<string>('')
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [existingOffer, setExistingOffer] = useState<any>(null)

  useEffect(() => {
    async function fetchData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
      if (data) {
        setAnn(data)
        fetchReviews(data.user_id)
        fetchSellerProfile(data.user_id) 
        if (currentUser) {
          checkIfPurchased(currentUser.id, data.id)
          checkExistingOffer(currentUser.id, data.id) 
        }
      }
      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  async function fetchSellerProfile(sellerId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', sellerId).single()
    if (data) setSeller(data)
  }

  async function fetchReviews(sellerId: string) {
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviewer_id(first_name)')
      .eq('reviewed_user_id', sellerId)
      .order('created_at', { ascending: false })
    if (data) setReviews(data)
  }

  async function checkIfPurchased(buyerId: string, annId: string) {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('announcement_id', annId)
      .eq('status', 'Pagato') 
      .limit(1)
    if (data && data.length > 0) setHasPurchased(true)
  }

  async function checkExistingOffer(buyerId: string, annId: string) {
    const { data } = await supabase
      .from('offers')
      .select('*')
      .eq('buyer_id', buyerId)
      .eq('announcement_id', annId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data) setExistingOffer(data)
  }

  const handleSponsor = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/stripe/sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: ann.id, userId: user.id })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("Errore durante l'avvio del pagamento.");
    } catch (err) {
      alert("Errore di connessione.");
    }
    setActionLoading(false)
  };

  const handleContact = () => {
    if (!user) { alert("Devi accedere per continuare!"); return; }
    if (user.id === ann.user_id) { alert("Questo è il tuo annuncio."); return; }

    if (ann.condition === 'Nuovo' || ann.condition === 'Usato') {
      alert("Per sbloccare la chat e parlare col venditore, devi prima completare l'acquisto dell'oggetto.");
      handleSecureBuy();
    } else {
      setShowCoffeeModal(true);
    }
  }

  const handleBuyCoffee = async () => {
    setActionLoading(true)
    const res = await fetch('/api/stripe/coffee', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcementId: ann.id,
        buyerId: user.id
      })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else alert("Errore durante l'avvio del pagamento.")
    setActionLoading(false)
  }

  const handleSecureBuy = async () => {
    if (!user) { alert("Devi accedere per acquistare."); return; }
    if (user.id === ann.user_id) { alert("Non puoi acquistare un tuo stesso oggetto."); return; }
    setActionLoading(true)

    const { data: sellerProfile } = await supabase.from('profiles').select('stripe_account_id').eq('id', ann.user_id).single()

    if (!sellerProfile || !sellerProfile.stripe_account_id) {
      alert("Il venditore non ha ancora configurato il suo conto per ricevere pagamenti.");
      setActionLoading(false);
      return;
    }

    const finalPrice = (existingOffer && existingOffer.status === 'Accettata') 
      ? existingOffer.offer_price 
      : ann.price;

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
            id: ann.id,
            title: ann.title,
            price: finalPrice, 
            quantity: selectedQuantity,
            image_url: ann.image_url
        }],
        buyerId: user.id,
        usePickup: usePickup
      })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setActionLoading(false); return; }
    if (data.url) window.location.href = data.url
  }

  const submitOffer = async () => {
    if (!offerPrice || isNaN(Number(offerPrice)) || Number(offerPrice) <= 0) {
      alert("Inserisci una cifra valida."); return;
    }
    if (Number(offerPrice) >= ann.price) {
      alert(`L'oggetto costa già €${ann.price}. Puoi acquistarlo direttamente!`); return;
    }

    setSubmittingOffer(true)
    const { error } = await supabase.from('offers').insert([{
      announcement_id: ann.id,
      buyer_id: user.id,
      seller_id: ann.user_id,
      offer_price: Number(offerPrice),
      status: 'In attesa'
    }])

    if (!error) {
      alert("Proposta inviata al venditore! Incrocia le dita 🤞")
      setShowOfferModal(false)
      checkExistingOffer(user.id, ann.id)
    } else {
      alert("Errore nell'invio della proposta.")
    }
    setSubmittingOffer(false)
  }

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingReview(true)
    const { error } = await supabase.from('reviews').insert([{
      reviewer_id: user.id,
      reviewed_user_id: ann.user_id,
      announcement_id: ann.id,
      rating: newReview.rating,
      comment: newReview.comment
    }])

    if (!error) {
      alert('Recensione pubblicata!')
      setNewReview({ rating: 5, comment: '' })
      setHasPurchased(false)
      fetchReviews(ann.user_id)
    } else {
      alert('Errore: ' + error.message)
    }
    setSubmittingReview(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400">Caricamento Re-love...</div>
  if (!ann) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs text-rose-500">Annuncio non trovato.</div>

  const maxQty = ann.quantity !== undefined ? ann.quantity : 1;
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1) : 'Nuovo'
  
  // MODIFICATO: Mappa basata solo sulla CITTÀ
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(ann.city || 'Italia')}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 font-sans pb-32">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLONNA SINISTRA */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white p-3 rounded-[2.5rem] shadow-sm border border-stone-200 relative">
             {ann.is_sponsored && (
               <div className="absolute top-8 left-8 z-20 bg-gradient-to-r from-rose-500 to-orange-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">
                 ✨ In Vetrina
               </div>
             )}
             <div className="rounded-[2rem] overflow-hidden bg-stone-100">
               <img src={ann.image_url || "/usato.png"} className="w-full h-auto object-cover aspect-square" alt={ann.title} />
             </div>
             {ann.image_urls && ann.image_urls.length > 1 && (
               <div className="flex gap-3 p-4 overflow-x-auto">
                 {ann.image_urls.map((img: string, i: number) => (
                    <img key={i} src={img} className="w-24 h-24 rounded-2xl object-cover border-2 border-stone-100 hover:border-rose-400 cursor-pointer transition-all flex-shrink-0 shadow-sm" />
                 ))}
               </div>
             )}
          </div>

          {/* POSIZIONE AGGIORNATA (SOLO CITTÀ) */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm overflow-hidden">
            <h3 className="text-xs font-black uppercase text-stone-400 tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> Posizione
            </h3>
            <div className="w-full h-64 rounded-3xl overflow-hidden border border-stone-100">
              <iframe width="100%" height="100%" frameBorder="0" scrolling="no" src={mapUrl}></iframe>
            </div>
            <p className="mt-3 text-xs font-bold text-stone-500 uppercase italic">Località: {ann.city || 'Non specificata'}</p>
          </div>
        </div>

        {/* COLONNA DESTRA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-stone-200 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
               <div className="space-y-1">
                  <span className="bg-stone-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded-md tracking-widest">
                    {ann.category_id || ann.category} • {ann.condition}
                  </span>
                  <h1 className="text-4xl font-black uppercase italic text-stone-900 leading-none pt-3">{ann.title}</h1>
               </div>
               {ann.type === 'offered' && <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg shadow-rose-200">Gift</span>}
            </div>

            {/* MODIFICATO: MOSTRA SOLO IL NICKNAME */}
            <Link href={`/profile/${ann.user_id}`} className="flex items-center justify-between bg-stone-50 p-4 rounded-2xl border border-stone-100 hover:border-rose-200 transition-all mb-8 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center font-black text-sm text-white uppercase">
                    {seller?.nickname?.[0] || seller?.first_name?.[0] || 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-stone-400">Venditore</span>
                    <span className="text-sm font-black uppercase text-stone-800 group-hover:text-rose-500 transition-colors">
                      {seller?.nickname || 'Utente Re-love'} →
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-400 text-lg">★</span>
                  <span className="text-sm font-black text-stone-700">{avgRating}</span>
                  <span className="text-[10px] text-stone-400 font-bold">({reviews.length})</span>
                </div>
            </Link>

            <div className="mb-8">
               {ann.condition === 'Baratto' ? (
                 <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl">
                    <p className="text-xs font-black text-blue-500 uppercase tracking-widest">Modalità Baratto</p>
                    <p className="text-2xl font-black text-stone-900 uppercase italic mt-1">
                      🔄 Cerca: {ann.exchange_item || 'Oggetto da concordare'}
                    </p>
                 </div>
               ) : (
                 <>
                   <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400 italic">
                      {ann.type === 'offered' || ann.condition === 'Regalo' ? 'GRATIS' : `€ ${(ann.price * selectedQuantity).toFixed(2)}`}
                   </p>
                   {!usePickup && ann.shipping_cost > 0 && (
                     <p className="text-xs font-black text-stone-400 uppercase mt-2">+ Spese Spedizione € {ann.shipping_cost}</p>
                   )}
                 </>
               )}
            </div>

            {ann.condition !== 'Baratto' && ann.condition !== 'Regalo' && (
              <div className="space-y-6 mb-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em]">Quantità (Max: {maxQty})</p>
                    <div className="flex items-center gap-4">
                      <input type="range" min="1" max={maxQty} value={selectedQuantity} onChange={(e) => setSelectedQuantity(Number(e.target.value))} className="flex-grow accent-rose-500" />
                      <span className="w-12 h-12 flex items-center justify-center bg-stone-900 text-white rounded-xl font-black text-sm">{selectedQuantity}</span>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em]">Metodo di ricezione</p>
                    <button onClick={() => setUsePickup(false)} className={`w-full p-5 rounded-2xl border flex justify-between items-center transition-all ${!usePickup ? 'border-rose-500 bg-rose-50/50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                      <div className="text-left">
                         <p className="text-xs font-black uppercase text-stone-800">Spedizione Standard</p>
                         <p className="text-[10px] font-bold text-stone-400 italic mt-0.5">Tracciata Re-love</p>
                      </div>
                      <span className="font-black text-sm text-stone-900">€ {ann.shipping_cost || '0.00'}</span>
                    </button>

                    {ann.allow_local_pickup && (
                      <button onClick={() => setUsePickup(true)} className={`w-full p-5 rounded-2xl border flex justify-between items-center transition-all ${usePickup ? 'border-emerald-500 bg-emerald-50' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                        <div className="text-left">
                           <p className="text-xs font-black uppercase text-emerald-800">Consegna a mano</p>
                           <p className="text-[10px] font-bold text-emerald-600 italic mt-0.5">Presso {ann.city || 'località del venditore'}</p>
                        </div>
                        <span className="font-black text-xs uppercase text-emerald-600 bg-emerald-100 px-2 py-1 rounded">Gratis</span>
                      </button>
                    )}
                 </div>
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-stone-100">
               {user?.id !== ann.user_id ? (
                 <>
                   {ann.condition === 'Nuovo' || ann.condition === 'Usato' ? (
                     <div className="space-y-3 flex flex-col items-center">
                       <button onClick={handleSecureBuy} disabled={actionLoading || maxQty <= 0} className="w-full bg-stone-900 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-rose-500 transition-all disabled:opacity-30">
                          {actionLoading ? 'In corso...' : 'Acquista Ora'}
                       </button>

                       {existingOffer ? (
                         <div className={`w-full p-4 rounded-2xl text-center border ${existingOffer.status === 'In attesa' ? 'bg-orange-50 border-orange-200' : existingOffer.status === 'Rifiutata' ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                           <p className="text-xs font-black uppercase text-stone-600 tracking-widest">
                             La tua offerta (€{existingOffer.offer_price}): <span className={existingOffer.status === 'In attesa' ? 'text-orange-500' : existingOffer.status === 'Rifiutata' ? 'text-rose-500' : 'text-emerald-500'}>{existingOffer.status}</span>
                           </p>
                         </div>
                       ) : (
                         <button onClick={() => { if(!user){ router.push('/login'); return; } setShowOfferModal(true); }} disabled={actionLoading || maxQty <= 0} className="w-full bg-white border-2 border-stone-200 text-stone-700 p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:border-stone-900 hover:text-stone-900 transition-all disabled:opacity-30">
                           💡 Fai una Proposta
                         </button>
                       )}
                     </div>
                   ) : (
                     <button onClick={handleContact} disabled={actionLoading} className="w-full bg-rose-500 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-stone-900 transition-all disabled:opacity-30">
                        {ann.condition === 'Regalo' ? 'Prendi Regalo' : 'Inizia Baratto'}
                     </button>
                   )}
                   
                   <button onClick={handleContact} disabled={actionLoading} className="text-stone-400 font-bold text-xs underline hover:text-stone-900 transition-all mt-4 w-full text-center disabled:opacity-30">
                     Hai dubbi? Contatta il venditore in chat
                   </button>
                 </>
               ) : (
                 <div className="space-y-3">
                    <div className="p-4 bg-stone-50 rounded-2xl text-center border border-stone-100">
                      <p className="text-[10px] font-black uppercase text-stone-400">Questo è il tuo annuncio</p>
                    </div>
                    {!ann.is_sponsored && (
                      <button onClick={handleSponsor} disabled={actionLoading} className="w-full bg-gradient-to-r from-orange-400 to-rose-500 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-105 transition-transform disabled:opacity-30">
                         ✨ Metti in Vetrina (2,99€)
                      </button>
                    )}
                 </div>
               )}
            </div>
          </div>
          
          <div className="bg-stone-900 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20 text-5xl">🚚</div>
             <h3 className="text-xs font-black uppercase text-rose-400 tracking-[0.3em] mb-6">Stato Spedizione</h3>
             
             <div className="space-y-6 relative">
                <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-stone-800"></div>
                <div className="flex items-center gap-4 relative">
                  <div className="w-3 h-3 bg-rose-500 rounded-full border-4 border-stone-900 z-10 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
                  <p className="text-xs font-black uppercase text-stone-200 italic tracking-wider">In attesa di acquisto</p>
                </div>
                <div className="flex items-center gap-4 relative opacity-40">
                  <div className="w-3 h-3 bg-stone-700 rounded-full border-4 border-stone-900 z-10"></div>
                  <p className="text-xs font-black uppercase text-stone-400 italic">Pacco affidato al corriere</p>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 border border-stone-200 shadow-sm">
            <h3 className="text-sm font-black uppercase italic text-stone-900 mb-6">Feedback della Community</h3>
            {hasPurchased && (
              <form onSubmit={submitReview} className="mb-8 p-6 bg-rose-50 rounded-3xl border border-rose-100">
                <h4 className="text-xs font-black uppercase text-rose-600 mb-4">Lascia la tua opinione</h4>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setNewReview({...newReview, rating: star})} className={`text-3xl ${newReview.rating >= star ? 'text-orange-400' : 'text-stone-300'} transition-transform hover:scale-125`}>★</button>
                  ))}
                </div>
                <textarea required className="w-full p-4 rounded-2xl border border-rose-200 outline-none text-sm font-medium mb-4 text-stone-700" placeholder="Come ti sei trovato con il venditore?" value={newReview.comment} onChange={(e) => setNewReview({...newReview, comment: e.target.value})} />
                <button disabled={submittingReview} type="submit" className="w-full bg-rose-500 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Pubblica Feedback</button>
              </form>
            )}
            
            <div className="space-y-4">
              {reviews.length === 0 ? <p className="text-xs font-bold text-stone-400 italic text-center py-6">Nessun feedback ancora.</p> : reviews.slice(0, visibleReviews).map(review => (
                  <div key={review.id} className="p-5 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-stone-800 italic">{review.reviewer?.first_name || 'Utente Re-love'}</span>
                      <div className="flex text-orange-400 text-sm">{'★'.repeat(review.rating)}</div>
                    </div>
                    <p className="text-sm font-medium text-stone-600 italic">"{review.comment}"</p>
                  </div>
              ))}
              {reviews.length > visibleReviews && (
                <button onClick={() => setVisibleReviews(prev => prev + 3)} className="w-full py-4 text-[10px] font-black uppercase text-stone-400 hover:text-stone-900 transition-all tracking-widest">↓ Vedi altri</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALE PER FARE UNA PROPOSTA */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md">
          <div className="bg-white max-w-sm w-full rounded-[3rem] p-10 shadow-2xl text-center border-t-8 border-rose-500 animate-in zoom-in">
            <h2 className="text-2xl font-black uppercase italic text-stone-900 mb-2">Fai un'offerta</h2>
            <p className="text-xs font-black uppercase text-stone-400 mb-6 tracking-widest">Prezzo originale: €{ann.price}</p>
            
            <div className="relative mb-8 flex items-center justify-center">
              <span className="absolute left-6 text-3xl font-black text-stone-300">€</span>
              <input 
                type="number" 
                min="1" 
                max={ann.price - 1} 
                value={offerPrice} 
                onChange={(e) => setOfferPrice(e.target.value)} 
                className="w-full text-center text-5xl font-black text-stone-900 p-6 bg-stone-50 rounded-3xl outline-none focus:ring-4 focus:ring-rose-500/20 transition-all" 
                placeholder="0"
              />
            </div>
            
            <div className="space-y-3">
               <button onClick={submitOffer} disabled={submittingOffer} className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-rose-500 transition-all disabled:opacity-30">
                 Invia Proposta
               </button>
               <button onClick={() => setShowOfferModal(false)} className="w-full text-stone-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 transition-all">
                 Annulla
               </button>
            </div>
          </div>
        </div>
      )}

      {showCoffeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md">
          <div className="bg-white max-w-sm w-full rounded-[3rem] p-10 shadow-2xl text-center border-t-8 border-rose-500">
            <span className="text-6xl mb-6 block animate-bounce">🔒</span>
            <h2 className="text-2xl font-black uppercase italic text-stone-900 mb-2">Sblocca la Chat</h2>
            <p className="text-sm font-medium text-stone-500 mb-10 leading-relaxed italic">
              Per sbloccare la conversazione in modalità {ann.condition} è richiesta una commissione simbolica di €2.50.
            </p>
            <div className="space-y-3">
               <button onClick={handleBuyCoffee} disabled={actionLoading} className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-rose-500 transition-all disabled:opacity-30">
                 {actionLoading ? 'Elaborazione...' : 'Paga €2.50 e Sblocca'}
               </button>
               <button onClick={() => setShowCoffeeModal(false)} className="w-full bg-stone-50 text-stone-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-200">
                 Annulla
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnnouncementClientWrapper({ announcementId }: { announcementId?: string }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase tracking-widest text-stone-400 text-xs">In caricamento...</div>}>
      <AnnouncementContent />
    </Suspense>
  )
}