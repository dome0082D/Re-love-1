import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Metadata, ResolvingMetadata } from 'next'

// OTTIMIZZAZIONE SEO - METADATA DINAMICI PER LA CONDIVISIONE
export async function generateMetadata(
  { params }: { params: { id: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const id = params.id
  const { data } = await supabase.from('announcements').select('*').eq('id', id).single()

  if (!data) return { title: 'Annuncio non trovato - Re-love' }

  return {
    title: `${data.title} - Re-love`,
    description: data.notes || data.description || 'Acquista su Re-love',
    openGraph: {
      title: `${data.title} a soli €${data.price}`,
      description: data.notes || data.description || 'Vieni a scoprire questo annuncio su Re-love!',
      images: [data.image_url || '/usato.png'],
    },
  }
}

function AnnouncementContent() {
  const { id } = useParams()
  const router = useRouter()
  const [ann, setAnn] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCoffeeModal, setShowCoffeeModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  
  // STATI PER LE RECENSIONI E LA PAGINAZIONE
  const [reviews, setReviews] = useState<any[]>([])
  const [hasPurchased, setHasPurchased] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [visibleReviews, setVisibleReviews] = useState(3) // Ne carichiamo solo 3 per volta

  useEffect(() => {
    async function fetchData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
      if (data) {
        setAnn(data)
        // Ora carichiamo le recensioni del venditore
        fetchReviews(data.user_id)
        if (currentUser) checkIfPurchased(currentUser.id, data.id)
      }
      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  async function fetchReviews(sellerId: string) {
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviewer_id(first_name)')
      .eq('reviewed_user_id', sellerId)
      .order('created_at', { ascending: false })
    if (data) setReviews(data)
  }

  async function checkIfPurchased(buyerId: string, annId: string) {
    // Controlla se l'utente ha una transazione pagata per questo annuncio
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('announcement_id', annId)
      .eq('status', 'Pagato') 
      .limit(1)
    if (data && data.length > 0) setHasPurchased(true)
  }

  const handleContact = () => {
    if (ann.type === 'offered') setShowCoffeeModal(true)
    else router.push(`/chat`)
  }

  const handleBuyCoffee = async () => {
    setActionLoading(true)
    const res = await fetch('/api/stripe/coffee', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
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

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `${ann.title} (x${selectedQuantity})`,
        price: ann.price * selectedQuantity,
        sellerStripeId: sellerProfile.stripe_account_id,
        buyerId: user.id,
        productId: ann.id
      })
    })
    const data = await res.json()
    if (data.error) { alert(data.error); setActionLoading(false); return; }
    if (data.url) window.location.href = data.url
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
      setHasPurchased(false) // Nasconde il form dopo la recensione
      fetchReviews(ann.user_id) // Aggiorna la lista
    } else {
      alert('Errore: ' + error.message)
    }
    setSubmittingReview(false)
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs">Caricamento in corso...</div>
  if (!ann) return <div className="p-10 text-center font-black uppercase text-xs text-red-500">Annuncio non trovato.</div>

  const maxQty = ann.quantity !== undefined ? ann.quantity : 1;

  // Calcolo media recensioni
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1) 
    : 'Nuovo'

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans flex flex-col items-center justify-start relative pb-20">
      <div className="max-w-4xl w-full mx-auto bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col md:flex-row mb-8">
        
        {/* GALLERIA IMMAGINI */}
        <div className="md:w-1/2 bg-stone-100 p-6 flex flex-col gap-4">
           <div className="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-sm">
             <img src={ann.image_url || "/usato.png"} className="w-full h-auto object-cover aspect-square" alt={ann.title} />
           </div>
           {ann.image_urls && ann.image_urls.length > 1 && (
             <div className="flex gap-2 overflow-x-auto pb-2">
               {ann.image_urls.map((img: string, i: number) => (
                  <img key={i} src={img} className="w-20 h-20 rounded-lg object-cover border border-stone-200 shadow-sm flex-shrink-0" />
               ))}
             </div>
           )}
        </div>

        {/* DETTAGLI PRODOTTO */}
        <div className="md:w-1/2 p-8 flex flex-col justify-between bg-white">
           <div>
              <div className="flex justify-between items-start mb-2">
                 <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">{ann.category} • {ann.condition}</p>
                 {ann.type === 'offered' && <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded uppercase shadow-sm">Regalo</span>}
              </div>
              
              <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">{ann.title}</h1>
              
              <Link href={`/user/${ann.user_id}`} className="group flex items-center justify-between mb-4 bg-stone-50 p-3 rounded-xl border border-stone-100 hover:border-rose-200 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-stone-400">Venditore:</span>
                  <span className="text-xs font-bold text-stone-800">Profilo</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm">⭐️</span>
                  <span className="text-xs font-bold text-stone-700">{avgRating}</span>
                  <span className="text-[9px] text-stone-400">({reviews.length})</span>
                </div>
              </Link>

              <p className="text-2xl font-black text-rose-600 mb-8">
                 {ann.type === 'offered' ? 'GRATIS' : `€ ${(ann.price * selectedQuantity).toFixed(2)}`}
              </p>
              
              <div className="space-y-4 mb-8">
                 {ann.brand && (
                   <div>
                     <p className="text-[9px] font-black uppercase text-stone-400">Marca</p>
                     <p className="text-sm font-bold text-stone-800">{ann.brand}</p>
                   </div>
                 )}
                 
                 {/* SELETTORE QUANTITÀ */}
                 <div className="flex flex-col gap-1">
                    <p className="text-[9px] font-black uppercase text-stone-400">Quantità desiderata (Disponibili: {maxQty})</p>
                    {ann.type !== 'offered' ? (
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="1" 
                          max={maxQty} 
                          value={selectedQuantity} 
                          onChange={(e) => setSelectedQuantity(Number(e.target.value))}
                          className="w-full md:w-1/2 cursor-pointer accent-rose-500"
                          disabled={maxQty <= 0}
                        />
                        <span className="text-sm font-bold text-stone-800 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
                          {maxQty <= 0 ? 0 : selectedQuantity}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-stone-800">{maxQty}</p>
                    )}
                 </div>

                 <div className="pt-4 border-t border-stone-100">
                   <p className="text-[9px] font-black uppercase text-stone-400 mb-1">Descrizione / Note</p>
                   <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{ann.description || ann.notes || 'Nessuna descrizione fornita dal venditore.'}</p>
                 </div>
              </div>
           </div>

           {/* AZIONI */}
           <div className="space-y-3 pt-6 border-t border-stone-100">
              {ann.type !== 'offered' && (
                <button 
                  onClick={handleSecureBuy} 
                  disabled={actionLoading || user?.id === ann.user_id || maxQty <= 0} 
                  className={`w-full p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-md ${
                    user?.id === ann.user_id || maxQty <= 0
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-rose-500 to-orange-400 text-white hover:scale-[1.02]'
                  }`}
                >
                  {actionLoading ? 'Elaborazione...' : user?.id === ann.user_id ? 'Tuo Oggetto' : maxQty <= 0 ? 'ESAURITO' : 'Acquista in Sicurezza'}
                </button>
              )}

              <button 
                onClick={handleContact} 
                disabled={actionLoading} 
                className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-700 transition-all shadow-md"
              >
                Contatta il Venditore
              </button>
              
              <Link href="/" className="block text-center w-full bg-stone-100 text-stone-800 p-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-200 transition-all">
                ← Torna alla Vetrina
              </Link>
           </div>
        </div>
      </div>

      {/* SEZIONE RECENSIONI E FEEDBACK */}
      <div className="max-w-4xl w-full mx-auto bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
        <h3 className="text-lg font-black uppercase italic text-stone-900 mb-6">Recensioni del Venditore</h3>
        
        {/* FORM INSERIMENTO RECENSIONE (Visibile solo se ha comprato) */}
        {hasPurchased && (
          <form onSubmit={submitReview} className="mb-8 p-6 bg-rose-50 rounded-2xl border border-rose-100">
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-rose-600 mb-3">Lascia un Feedback per questo acquisto</h4>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
                  type="button"
                  onClick={() => setNewReview({...newReview, rating: star})}
                  className={`text-2xl ${newReview.rating >= star ? 'text-orange-400' : 'text-stone-300'} transition-colors`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea 
              required
              className="w-full p-3 rounded-xl border border-rose-200 outline-none focus:border-rose-400 text-sm mb-3"
              placeholder="Come ti sei trovato con questo venditore?"
              value={newReview.comment}
              onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
            />
            <button disabled={submittingReview} type="submit" className="bg-rose-500 text-white px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50">
              {submittingReview ? 'Invio...' : 'Pubblica Recensione'}
            </button>
          </form>
        )}

        {/* LISTA RECENSIONI (Con Paginazione "Mostra Altri") */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <p className="text-sm text-stone-400 italic">Nessuna recensione presente per questo venditore.</p>
          ) : (
            reviews.slice(0, visibleReviews).map(review => (
              <div key={review.id} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-stone-800">{review.reviewer?.first_name || 'Utente Re-love'}</span>
                  <span className="text-orange-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                </div>
                <p className="text-sm text-stone-600">{review.comment}</p>
                <p className="text-[9px] text-stone-400 mt-2 uppercase">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
          
          {reviews.length > visibleReviews && (
            <button 
              onClick={() => setVisibleReviews(prev => prev + 3)}
              className="w-full mt-4 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-stone-800 transition-colors p-2"
            >
              ↓ Carica altre recensioni
            </button>
          )}
        </div>
      </div>

      {/* POP-UP CAFFÈ */}
      {showCoffeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white max-w-sm rounded-3xl p-8 shadow-2xl relative text-center">
            <h2 className="text-xl font-black uppercase italic text-stone-900 mb-4">Supportaci ☕</h2>
            <p className="text-xs text-stone-600 mb-8">Hai appena trovato un oggetto gratuito! Se ti va, offrici un caffè (2.50€) per aiutarci a mantenere Re-love attivo e gratuito.</p>
            <div className="space-y-3">
               <button onClick={handleBuyCoffee} disabled={actionLoading} className="w-full bg-rose-500 text-white p-4 rounded-xl font-black uppercase text-[10px] hover:bg-rose-600 transition-colors">
                 {actionLoading ? 'Reindirizzamento...' : 'Offri un caffè (2.50€)'}
               </button>
               <button onClick={() => router.push(`/chat`)} className="w-full bg-stone-100 text-stone-600 p-4 rounded-xl font-black uppercase text-[10px] hover:bg-stone-200 transition-colors">
                 No, grazie. Vai alla chat
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnnouncementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Caricamento annuncio...</div>}>
      <AnnouncementContent />
    </Suspense>
  )
}
