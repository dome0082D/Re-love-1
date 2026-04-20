'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AnnouncementPage() {
  const { id } = useParams()
  const router = useRouter()
  const [ann, setAnn] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCoffeeModal, setShowCoffeeModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  
  // Stato per la quantità scelta dall'acquirente
  const [selectedQuantity, setSelectedQuantity] = useState(1)

  useEffect(() => {
    async function fetchData() {
      // Recupera utente loggato
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      // Recupera dettagli annuncio
      const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
      if (data) setAnn(data)
      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  const handleContact = () => {
    if (ann.type === 'offered') {
      setShowCoffeeModal(true)
    } else {
      router.push(`/chat`)
    }
  }

  const handleBuyCoffee = async () => {
    setActionLoading(true)
    const res = await fetch('/api/stripe/coffee', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setActionLoading(false)
  }

  const handleSecureBuy = async () => {
    // ECCO IL LUCCHETTO! Blocca chi non è registrato.
    if (!user) { 
      alert("Devi accedere per acquistare."); 
      return; 
    }
    if (user.id === ann.user_id) { 
      alert("Non puoi acquistare un tuo stesso oggetto."); 
      return; 
    }
    
    setActionLoading(true)

    // RECUPERA IL CONTO STRIPE DEL VENDITORE DAL DATABASE
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', ann.user_id)
      .single();

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
    if (data.error) { 
      alert(data.error); 
      setActionLoading(false); 
      return; 
    }
    if (data.url) window.location.href = data.url
  }

  if (loading) return <div className="p-10 text-center font-black uppercase text-xs">Caricamento in corso...</div>
  if (!ann) return <div className="p-10 text-center font-black uppercase text-xs text-red-500">Annuncio non trovato.</div>

  const maxQty = ann.quantity !== undefined ? ann.quantity : 1;

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans flex items-center justify-center relative">
      <div className="max-w-4xl w-full mx-auto bg-white rounded-3xl overflow-hidden border border-stone-200 shadow-sm flex flex-col md:flex-row">
        
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
                 {ann.type === 'offered' && <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded uppercase shadow-sm">Regalo</span>}
              </div>
              
              <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">{ann.title}</h1>
              
              <Link href={`/user/${ann.user_id}`} className="group flex items-center gap-2 mb-4">
                <span className="text-[10px] font-black uppercase text-stone-400 group-hover:text-emerald-500 transition-colors">Venduto da:</span>
                <span className="text-xs font-bold text-stone-800 border-b border-stone-200 group-hover:border-emerald-500 transition-all">Vedi Profilo Pubblico</span>
              </Link>

              <p className="text-2xl font-black text-emerald-600 mb-8">
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
                          className="w-full md:w-1/2 cursor-pointer accent-emerald-500"
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
                   <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{ann.notes || 'Nessuna descrizione fornita dal venditore.'}</p>
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
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  {actionLoading ? 'Elaborazione...' : user?.id === ann.user_id ? 'Tuo Oggetto (Acquisto Disabilitato)' : maxQty <= 0 ? 'ESAURITO' : 'Acquista in Sicurezza'}
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

      {/* POP-UP CAFFÈ */}
      {showCoffeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white max-w-sm rounded-3xl p-8 shadow-2xl relative text-center">
            <h2 className="text-xl font-black uppercase italic text-stone-900 mb-4">Supportaci ☕</h2>
            <p className="text-xs text-stone-600 mb-8">Hai appena trovato un oggetto gratuito! Se ti va, offrici un caffè (2.50€) per aiutarci a mantenere la piattaforma attiva e gratuita.</p>
            <div className="space-y-3">
               <button onClick={handleBuyCoffee} disabled={actionLoading} className="w-full bg-emerald-500 text-white p-4 rounded-xl font-black uppercase text-[10px] hover:bg-emerald-600 transition-colors">
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
