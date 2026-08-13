'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import Link from 'next/link'
import { Timer, Tag } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileData {
  stripe_account_id?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

const CATEGORIES = [
  'Abbigliamento e Accessori',
  'Elettronica e Informatica',
  'Casa, Arredamento e Giardino',
  'Alimentari e Bevande',
  'Libri, Film e Musica',
  'Salute e Bellezza',
  'Sport e Tempo Libero',
  'Motori e Veicoli',
  'Altro / Varie'
]

// Soglia minima per attivare la modalità Arena - stessa identica regola
// già imposta a livello di database (vedi 01-tabelle-arena.sql), qui
// serve solo per dare un feedback immediato all'utente mentre scrive.
const SOGLIA_ARENA = 100

function AddAnnouncementForm() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  const router = useRouter()
  const searchParams = useSearchParams()
  const modeParam = searchParams.get('mode') 

  const initialCondition = modeParam === 'new' ? 'Nuovo' : modeParam === 'gift' ? 'Regalo' : modeParam === 'barter' ? 'Baratto' : 'Usato'
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [condition, setCondition] = useState(initialCondition)
  const [shippingCost, setShippingCost] = useState('0')
  const [quantity, setQuantity] = useState('1')
  const [allowLocalPickup, setAllowLocalPickup] = useState(false)

  // --- INDIRIZZO DI RITIRO ---
  const [address, setAddress] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number; city: string; label: string } | null>(null)
  const [geocoding, setGeocoding] = useState(false)
  const [acceptsReturns, setAcceptsReturns] = useState(false)
  const [exchangeItem, setExchangeItem] = useState('')

  // --- STATI PER LE ASTE ---
  const [isAuction, setIsAuction] = useState(false)
  const [auctionDurationDays, setAuctionDurationDays] = useState('3') // 1, 3 o 7 giorni

  // --- STATO PER ARENA RELOVE ---
  // NUOVO: attivabile solo a prezzo fisso (non aste) e solo da 100€ in su -
  // stessa regola già imposta anche a livello di database come rete di
  // sicurezza finale.
  const [isArena, setIsArena] = useState(false)

  const [images, setImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const imageUrlsRef = useRef<string[]>([])
  useEffect(() => { imageUrlsRef.current = imageUrls }, [imageUrls])
  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    }
  }, [])

  // Controllo utente
  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      
      const { data } = await supabase.from('profiles').select('stripe_account_id, first_name, last_name, city, latitude, longitude').eq('id', user.id).single()
      setProfile(data)
      setLoadingUser(false)
    }
    checkUser()
  }, [router])

  // Reset del modulo se l'utente torna alla scelta delle 4 categorie
  useEffect(() => {
    if (!modeParam) {
      setTitle('')
      setDescription('')
      setPrice('')
      setShippingCost('0')
      setQuantity('1')
      setImages([])
      setImageUrls(prev => {
        prev.forEach(url => URL.revokeObjectURL(url))
        return []
      })
      setExchangeItem('')
      setAcceptsReturns(false)
      setIsAuction(false)
      setIsArena(false)
      setAddress('')
      setCoords(null)
    } else {
      setCondition(modeParam === 'new' ? 'Nuovo' : modeParam === 'gift' ? 'Regalo' : modeParam === 'barter' ? 'Baratto' : 'Usato')
      if (modeParam === 'gift' || modeParam === 'barter') {
        setPrice('0')
        setIsAuction(false) // Niente aste per regali e baratti
        setIsArena(false) // Niente Arena per regali e baratti
      }
    }
  }, [modeParam])

  // NUOVO: se il prezzo scende sotto i 100€ (o si passa ad asta) mentre
  // Arena era già selezionata, la disattiviamo automaticamente - non deve
  // mai restare spuntata su una combinazione non più valida.
  useEffect(() => {
    if (isArena) {
      const numPrice = parseFloat(price) || 0
      if (numPrice < SOGLIA_ARENA || isAuction) {
        setIsArena(false)
      }
    }
  }, [price, isAuction, isArena])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      if (images.length + selectedFiles.length > 5) {
         toast.error("Massimo 5 foto consentite.")
         return
      }
      setImages([...images, ...selectedFiles])
      
      const newUrls = selectedFiles.map(file => URL.createObjectURL(file))
      setImageUrls([...imageUrls, ...newUrls])
    }
  }

  const removeImage = (index: number) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)

    const newUrls = [...imageUrls]
    URL.revokeObjectURL(newUrls[index])
    newUrls.splice(index, 1)
    setImageUrls(newUrls)
  }

  const uploadWithRetry = async (file: File, filePath: string, attempts = 2) => {
    let lastError: any = null
    for (let i = 0; i < attempts; i++) {
      const { error } = await supabase.storage.from('announcements').upload(filePath, file)
      if (!error) return
      lastError = error
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    throw lastError
  }

  const handleGenerateDescription = async () => {
    if (!title) {
      toast.error("Scrivi prima il titolo dell'oggetto!");
      return;
    }
    const toastId = toast.loading("🪄 L'IA sta scrivendo per te...");
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, condition, category })
      });
      const data = await res.json();
      if (data.description) {
        setDescription(data.description);
        toast.success("Magia completata! ✨", { id: toastId });
      } else {
        toast.error(data.error || "Errore con l'IA", { id: toastId });
      }
    } catch (err) {
      toast.error("Errore di connessione all'IA", { id: toastId });
    }
  };

  const handleCercaIndirizzo = async () => {
    if (!address.trim()) {
      toast.error('Scrivi prima un indirizzo.')
      return
    }
    setGeocoding(true)
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Indirizzo non trovato.')
        setCoords(null)
        return
      }
      setCoords({ lat: data.latitude, lng: data.longitude, city: data.city, label: data.displayName })
      toast.success('Posizione trovata!')
    } catch (err) {
      console.error('Errore geocodifica:', err)
      toast.error('Errore di connessione. Riprova.')
      setCoords(null)
    } finally {
      setGeocoding(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!profile?.stripe_account_id && condition !== 'Regalo' && condition !== 'Baratto') {
      toast.error("Collega il tuo account Stripe per ricevere i pagamenti.")
      router.push('/profile')
      return
    }

    if (images.length === 0) {
      toast.error('Carica almeno una foto!')
      return
    }

    // NUOVO: rete di sicurezza lato client, oltre a quella già presente nel
    // database - non dovrebbe mai scattare (l'interfaccia già disattiva
    // Arena in questi casi), ma se scattasse per un motivo imprevisto è
    // meglio bloccare qui con un messaggio chiaro invece di far fallire la
    // richiesta con un errore SQL poco comprensibile.
    const numPriceCheck = parseFloat(price) || 0
    if (isArena && (numPriceCheck < SOGLIA_ARENA || isAuction)) {
      toast.error(`La modalità Arena richiede un prezzo fisso di almeno €${SOGLIA_ARENA}.`)
      return
    }

    setUploading(true)
    try {
      const uploadedImageUrls: string[] = []

      for (const file of images) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        await uploadWithRetry(file, filePath)

        const { data } = supabase.storage.from('announcements').getPublicUrl(filePath)
        uploadedImageUrls.push(data.publicUrl)
      }

      const numPrice = condition === 'Regalo' || condition === 'Baratto' ? 0 : parseFloat(price)
      const numShipping = parseFloat(shippingCost) || 0
      const qty = isAuction ? 1 : (parseInt(quantity) || 1) // Le aste hanno sempre qty=1

      let auctionEndTime = null
      if (isAuction) {
         const endDate = new Date()
         endDate.setDate(endDate.getDate() + parseInt(auctionDurationDays))
         auctionEndTime = endDate.toISOString()
      }

      const { data: insertedData, error } = await supabase.from('announcements').insert([
        {
          title,
          description,
          price: numPrice,
          category,
          condition,
          image_url: uploadedImageUrls[0],
          image_urls: uploadedImageUrls,
          user_id: user.id,
          shipping_cost: numShipping,
          quantity: qty,
          allow_local_pickup: allowLocalPickup,
          accepts_returns: acceptsReturns,
          exchange_item: condition === 'Baratto' ? exchangeItem : null,
          address: address.trim() || null,
          city: coords?.city || profile?.city || null,
          latitude: coords?.lat ?? profile?.latitude ?? null,
          longitude: coords?.lng ?? profile?.longitude ?? null,
          // CAMPI ASTA
          is_auction: isAuction,
          auction_end: auctionEndTime,
          current_bid: isAuction ? numPrice : 0,
          // CAMPO ARENA RELOVE
          is_arena: isArena,
        }
      ]).select()

      if (error) throw error

      toast.success(isAuction ? 'Asta creata con successo! ⏳' : isArena ? 'Oggetto messo in Arena! 🏆' : 'Annuncio pubblicato! 🚀')
      router.push(`/announcement/${insertedData[0].id}`)
    } catch (error: any) {
      toast.error('Errore durante la pubblicazione: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  if (loadingUser) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-stone-400 tracking-widest text-xs animate-pulse">Accesso in corso...</div>

  // --- SCHERMATA INTERMEDIA ---
  if (!modeParam) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-20 px-4 pb-32">
        <h1 className="text-4xl md:text-5xl font-black uppercase italic text-stone-900 mb-4 text-center tracking-tighter">Cosa vuoi proporre?</h1>
        <p className="text-stone-400 font-bold text-xs uppercase tracking-widest mb-12 text-center">Scegli la tipologia del tuo annuncio</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
          <Link href="/add?mode=new" className="p-10 bg-white border border-stone-200 rounded-[2.5rem] text-center hover:border-rose-400 hover:shadow-xl transition-all group">
             <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">✨</div>
             <h3 className="text-2xl font-black uppercase text-stone-900">Nuovo</h3>
             <p className="text-[10px] font-bold text-stone-400 mt-2 uppercase tracking-widest">Sigillato o mai usato</p>
          </Link>
          <Link href="/add?mode=used" className="p-10 bg-white border border-stone-200 rounded-[2.5rem] text-center hover:border-orange-400 hover:shadow-xl transition-all group">
             <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">♻️</div>
             <h3 className="text-2xl font-black uppercase text-stone-900">Usato</h3>
             <p className="text-[10px] font-bold text-stone-400 mt-2 uppercase tracking-widest">Dai una seconda vita</p>
          </Link>
          <Link href="/add?mode=gift" className="p-10 bg-white border border-stone-200 rounded-[2.5rem] text-center hover:border-red-400 hover:shadow-xl transition-all group">
             <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🎁</div>
             <h3 className="text-2xl font-black uppercase text-stone-900">Regalo</h3>
             <p className="text-[10px] font-bold text-stone-400 mt-2 uppercase tracking-widest">Dona a chi ha bisogno</p>
          </Link>
          <Link href="/add?mode=barter" className="p-10 bg-white border border-stone-200 rounded-[2.5rem] text-center hover:border-blue-400 hover:shadow-xl transition-all group">
             <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🤝</div>
             <h3 className="text-2xl font-black uppercase text-stone-900">Baratto</h3>
             <p className="text-[10px] font-bold text-stone-400 mt-2 uppercase tracking-widest">Scambia senza soldi</p>
          </Link>
        </div>
      </div>
    )
  }

  // --- MODULO DI INSERIMENTO ANNUNCIO ---
  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="relative z-10">
        <div className="w-full py-16 md:py-24 flex items-center justify-center border-b border-stone-100 bg-stone-50/50">
           <div className="text-center max-w-2xl px-6">
              <h1 className="text-4xl md:text-5xl font-black uppercase italic text-stone-900 tracking-tighter mb-4">
                 {modeParam === 'new' && 'Vendi il tuo Nuovo'}
                 {modeParam === 'used' && 'Dai una Seconda Vita'}
                 {modeParam === 'gift' && 'Regalo Solidale'}
                 {modeParam === 'barter' && 'Inizia il Baratto'}
              </h1>
              <p className="text-stone-400 font-bold text-[10px] md:text-xs uppercase tracking-[0.3em]">
                 {modeParam === 'new' && 'Sigillato, intatto, mai aperto. Trasformalo in guadagno.'}
                 {modeParam === 'used' && 'Vendi ciò che non usi più, proteggi il pianeta.'}
                 {modeParam === 'gift' && 'Un piccolo gesto che può significare molto per qualcuno.'}
                 {modeParam === 'barter' && 'Scambia i tuoi oggetti senza bisogno di denaro.'}
              </p>
           </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 mt-12 relative z-20">
          
          {(!profile?.stripe_account_id && modeParam !== 'gift' && modeParam !== 'barter') && (
            <div className="bg-orange-50 border border-orange-200 p-6 rounded-3xl mb-8 text-center shadow-sm">
              <h3 className="font-black uppercase text-orange-600 mb-2 text-sm">Attenzione</h3>
              <p className="text-[10px] font-bold text-orange-500 mb-6 uppercase tracking-widest leading-relaxed">Devi collegare Stripe prima di poter incassare i pagamenti degli annunci in vendita.</p>
              <Link href="/profile" className="inline-block bg-orange-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-stone-900 transition-all">
                Configura Portafoglio
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-stone-200 space-y-10">
            
            {/* SEZIONE FOTO */}
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-stone-900">Le tue foto</h3>
                  <p className="text-[10px] font-bold uppercase text-stone-400 mt-1">Carica fino a 5 immagini (La prima sarà la copertina)</p>
                </div>
                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded">{images.length}/5</span>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative w-32 h-32 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-stone-100 group">
                    <img src={url} className="w-full h-full object-cover" alt="Preview" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-2 right-2 bg-stone-900/80 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500">✕</button>
                    {i === 0 && <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 text-[8px] font-black uppercase rounded shadow-sm">Cover</span>}
                  </div>
                ))}
                
                {images.length < 5 && (
                  <label className="w-32 h-32 flex-shrink-0 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer">
                    <span className="text-2xl mb-1">+</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Aggiungi</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* INFO BASE */}
            <div className="space-y-6 pt-6 border-t border-stone-100">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Cosa vuoi proporre?</label>
                 <input required type="text" placeholder="Es. Giacca Vintage anni 80" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-rose-400 transition-all" />
               </div>

               <div className="space-y-2 relative">
                 <div className="flex justify-between items-end ml-2 mb-1">
                   <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Descrizione (Sii sincero sui difetti)</label>
                   <button 
                     type="button" 
                     onClick={handleGenerateDescription}
                     disabled={!title || uploading}
                     className="bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 disabled:opacity-50"
                   >
                     ✨ Scrivi con IA
                   </button>
                 </div>
                 <textarea required rows={4} placeholder="Descrivi taglia, marca, eventuali segni d'usura..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-rose-400 transition-all resize-none" />
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Categoria</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-bold outline-none focus:bg-white focus:border-rose-400 transition-all appearance-none cursor-pointer">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Condizione</label>
                    <div className="w-full p-5 bg-stone-100 border border-stone-200 rounded-2xl font-black text-stone-600 uppercase">
                      {condition}
                    </div>
                  </div>
               </div>
            </div>

            {/* PREZZO E MODALITÀ ASTA/COMPRALO SUBITO */}
            <div className="space-y-6 pt-6 border-t border-stone-100">
               
               {condition === 'Baratto' && (
               <div className="space-y-2 bg-blue-50 p-6 rounded-3xl border border-blue-100">
                   <label className="text-[10px] font-black uppercase text-blue-500 tracking-widest ml-2">Cosa cerchi in cambio?</label>
                   <input required type="text" placeholder="Es. Cerco vinili rock, oppure libri fantasy..." value={exchangeItem} onChange={(e) => setExchangeItem(e.target.value)} className="w-full p-5 bg-white border border-blue-200 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all text-blue-900" />
                 </div>
               )}

               {condition !== 'Regalo' && condition !== 'Baratto' && (
                 <>
                   {/* SELETTORE MODALITÀ DI VENDITA */}
                   <div className="flex gap-2 p-2 bg-stone-50 border border-stone-200 rounded-[2rem] w-full max-w-sm mx-auto mb-8">
                     <button type="button" onClick={() => setIsAuction(false)} className={`flex-1 py-3 px-4 rounded-3xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${!isAuction ? 'bg-white shadow-md text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}>
                       <Tag size={16} /> Prezzo Fisso
                     </button>
                     <button type="button" onClick={() => setIsAuction(true)} className={`flex-1 py-3 px-4 rounded-3xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isAuction ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30' : 'text-stone-400 hover:text-stone-600'}`}>
                       <Timer size={16} /> Fai un'Asta
                     </button>
                   </div>

                   {/* CONTENUTO PREZZO */}
                   <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2 flex justify-between">
                          {isAuction ? 'Prezzo di Partenza' : 'Prezzo di Vendita'}
                          {!isAuction && <span className="text-rose-500 bg-rose-50 px-1 rounded">-10% Comm.</span>}
                        </label>
                        <div className="relative">
                          <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-stone-400">€</span>
                          <input required type="number" step="0.01" min="0.50" value={price} onChange={(e) => setPrice(e.target.value)} className={`w-full p-5 pl-10 border rounded-2xl font-black outline-none transition-all text-xl ${isAuction ? 'bg-rose-50 border-rose-200 focus:bg-white focus:border-rose-400 text-rose-600' : 'bg-stone-50 border-stone-100 focus:bg-white focus:border-stone-400'}`} placeholder="0.00" />
                        </div>
                      </div>
                      
                      {/* CAMPO DINAMICO A DESTRA */}
                      {isAuction ? (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Durata Asta</label>
                          <select value={auctionDurationDays} onChange={(e) => setAuctionDurationDays(e.target.value)} className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-black outline-none focus:bg-white focus:border-rose-400 transition-all appearance-none cursor-pointer">
                            <option value="1">24 Ore</option>
                            <option value="3">3 Giorni</option>
                            <option value="7">7 Giorni</option>
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest ml-2">Tu Guadagni</label>
                          <div className="w-full p-5 bg-emerald-50 border border-emerald-100 rounded-2xl font-black text-emerald-700 text-xl flex items-center h-[68px]">
                            € {price ? (parseFloat(price) * (isArena ? 0.60 : 0.90)).toFixed(2) : '0.00'}
                          </div>
                        </div>
                      )}
                   </div>

                   {/* NUOVO: TOGGLE ARENA RELOVE - solo a prezzo fisso
                       (non in asta), e solo da 100€ in su. Sotto soglia
                       mostriamo un riquadro informativo al posto del
                       toggle, invece di un checkbox disattivato senza
                       spiegazione - più chiaro per chi non sa perché non
                       può selezionarlo. */}
                   {!isAuction && (
                     <div className="mt-6">
                       {(parseFloat(price) || 0) >= SOGLIA_ARENA ? (
                         <label className="flex items-start gap-4 p-6 bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-2xl cursor-pointer hover:shadow-md transition-all">
                           <input
                             type="checkbox"
                             checked={isArena}
                             onChange={(e) => setIsArena(e.target.checked)}
                             className="w-6 h-6 accent-rose-600 rounded mt-1 shrink-0"
                           />
                           <div className="flex flex-col">
                             <span className="text-xs font-black uppercase text-stone-900 flex items-center gap-2">🏆 Metti in Arena</span>
                             <span className="text-[10px] font-bold text-stone-600 mt-1 leading-relaxed">
                               La community competerà per trovarti un acquirente. Se un promotore chiude la vendita, tu guadagni il <span className="font-black text-rose-600">60%</span> invece del 90% (30% al promotore, 10% alla piattaforma). Se nessuno la promuove, resta comunque un annuncio normale.
                             </span>
                           </div>
                         </label>
                       ) : (
                         <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl">
                           <p className="text-[9px] font-bold uppercase text-stone-400 tracking-widest">
                             🏆 La modalità Arena è disponibile solo per oggetti da €{SOGLIA_ARENA} in su.
                           </p>
                         </div>
                       )}
                     </div>
                   )}
                 </>
               )}

               <div className="grid grid-cols-2 gap-6 mt-6">
                  {!isAuction && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Pezzi disponibili</label>
                      <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-5 bg-stone-50 border border-stone-100 rounded-2xl font-black outline-none focus:bg-white focus:border-stone-400 transition-all" />
                    </div>
                  )}

                  <div className={`space-y-2 ${isAuction ? 'col-span-2' : ''}`}>
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Spese Spedizione a carico di chi compra</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-stone-400">€</span>
                      <input type="number" step="0.10" min="0" value={shippingCost} onChange={(e) => setShippingCost(e.target.value)} className="w-full p-5 pl-10 bg-stone-50 border border-stone-100 rounded-2xl font-black outline-none focus:bg-white focus:border-stone-400 transition-all" placeholder="0.00 (Gratis)" />
                    </div>
                  </div>
               </div>

               {/* --- INDIRIZZO DI RITIRO / POSIZIONE --- */}
               <div className="space-y-3 mt-6 p-6 bg-stone-50 border border-stone-200 rounded-3xl">
                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">
                      Dove si trova l&apos;oggetto? (Via e Citt&agrave;)
                    </label>
                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest ml-2 mb-2">
                      Serve per farlo comparire nel Radar Zona e sulla mappa
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Es. Via Roma 12, Milano"
                        value={address}
                        onChange={(e) => { setAddress(e.target.value); setCoords(null) }}
                        className="flex-1 p-4 bg-white border border-stone-200 rounded-2xl font-bold text-sm outline-none focus:border-rose-400 transition-all"
                      />
                      <button
                        type="button"
                        onClick={handleCercaIndirizzo}
                        disabled={geocoding || !address.trim()}
                        className="shrink-0 bg-stone-900 text-white px-5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-40"
                      >
                        {geocoding ? '...' : 'Trova'}
                      </button>
                    </div>
                  </div>

                  {coords ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">
                        Posizione confermata
                      </p>
                      <p className="text-xs font-bold text-emerald-800 leading-snug">{coords.label}</p>
                    </div>
                  ) : (
                    <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest ml-2">
                      Senza posizione l&apos;annuncio non comparir&agrave; nelle ricerche per zona
                    </p>
                  )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {/* SPUNTA RITIRO A MANO */}
                  <label className="flex items-center gap-4 p-5 bg-stone-50 border border-stone-100 rounded-2xl cursor-pointer hover:bg-stone-100 transition-colors">
                    <input type="checkbox" checked={allowLocalPickup} onChange={(e) => setAllowLocalPickup(e.target.checked)} className="w-6 h-6 accent-rose-500 rounded" />
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase text-stone-800">Consenti Ritiro</span>
                      <span className="text-[9px] font-bold uppercase text-stone-400">Gli utenti vicini non pagheranno la spedizione</span>
                    </div>
                  </label>

                  {/* SPUNTA ACCETTA RESI */}
                  {condition !== 'Regalo' && condition !== 'Baratto' && (
                    <label className="flex items-center gap-4 p-5 bg-blue-50 border border-blue-100 rounded-2xl cursor-pointer hover:bg-blue-100 transition-colors">
                      <input type="checkbox" checked={acceptsReturns} onChange={(e) => setAcceptsReturns(e.target.checked)} className="w-6 h-6 accent-blue-600 rounded" />
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-blue-900">Accetto i Resi</span>
                        <span className="text-[9px] font-bold uppercase text-blue-500">I clienti comprano più volentieri</span>
                      </div>
                    </label>
                  )}
               </div>
            </div>

            <div className="pt-8">
              <button disabled={uploading || (!profile?.stripe_account_id && condition !== 'Regalo' && condition !== 'Baratto')} type="submit" className={`w-full text-white py-6 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-lg transition-all disabled:opacity-50 ${isAuction ? 'bg-rose-500 hover:bg-rose-600' : isArena ? 'bg-gradient-to-r from-rose-600 to-orange-500 hover:opacity-90' : 'bg-stone-900 hover:bg-stone-800'}`}>
                {uploading ? 'Pubblicazione in corso...' : (isAuction ? 'Avvia L\'Asta Ora ⏳' : isArena ? 'Metti in Arena 🏆' : 'Pubblica il tuo annuncio 🚀')}
              </button>
              <p className="text-center mt-6 text-[10px] font-bold uppercase text-stone-400 tracking-widest">
                Cliccando accetti il manifesto etico di Re-love.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-screen"></div>}>
      <AddAnnouncementForm />
    </Suspense>
  )
}
