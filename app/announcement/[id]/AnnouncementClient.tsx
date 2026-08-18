'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Timer, Gavel, ShoppingCart, Sparkles } from 'lucide-react'
import { inviaNotifica } from '@/lib/pushNotify'
import { registraRilancio } from '@/lib/azioniUtente'
import BottoneCondividi from '@/components/BottoneCondividi'
import BottoneCandidatura from '@/components/BottoneCandidatura'
import { PARAMETRO_CURATORE } from '@/lib/candidature'
import { useCartStore } from '@/store/cartStore'
import type { User } from '@supabase/supabase-js'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

interface Announcement {
  id: string
  title: string
  description?: string
  price: number
  category?: string
  category_id?: string
  condition: string
  image_url?: string
  image_urls?: string[]
  user_id: string
  shipping_cost?: number
  quantity?: number
  allow_local_pickup?: boolean
  accepts_returns?: boolean
  exchange_item?: string
  city?: string
  is_sponsored?: boolean
  type?: string
  is_auction?: boolean
  auction_end?: string
  current_bid?: number
  // NUOVO: presenti solo per un annuncio del sistema "Curatore Locale" -
  // per un annuncio normale restano vuoti. owner_id e' il vero
  // Proprietario, diverso da user_id (che resta il Curatore).
  curator_id?: string
  owner_id?: string
  cerca_curatore?: boolean
  curator_percentage?: number | null
  mandate_id?: string
}

interface SellerProfile {
  id: string
  nickname?: string
  first_name?: string
  stripe_account_id?: string
}

interface Review {
  id: string
  rating: number
  comment: string
  reviewer?: { first_name?: string }
}

interface Offer {
  id: string
  offer_price: number
  status: string
  buyer_id: string
  seller_id: string
  announcement_id: string
}

function AnnouncementContent() {
  const { id } = useParams()
  const router = useRouter()
  const [ann, setAnn] = useState<Announcement | null>(null)
  const [seller, setSeller] = useState<SellerProfile | null>(null)
  const [user, setUser] = useState<User | null>(null)

  const searchParams = useSearchParams()
  // Codice del link personale del Curatore. E' quello che decide se la sua
  // percentuale scatta: ce lo portiamo dietro fino alla cassa.
  const curatoreCode = searchParams.get(PARAMETRO_CURATORE)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState(1)

  const { addItem, openCart } = useCartStore()

  const [usePickup, setUsePickup] = useState(false)
  
  const [reviews, setReviews] = useState<Review[]>([])
  const [hasPurchased, setHasPurchased] = useState(false)
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' })
  const [submittingReview, setSubmittingReview] = useState(false)
  const [visibleReviews, setVisibleReviews] = useState(3)

  const [showOfferModal, setShowOfferModal] = useState(false)
  const [offerPrice, setOfferPrice] = useState<string>('')
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [existingOffer, setExistingOffer] = useState<Offer | null>(null)

  const [mapActive, setMapActive] = useState(false)

  const [timeLeft, setTimeLeft] = useState('')
  const [isAuctionEnded, setIsAuctionEnded] = useState(false)
  const [currentBid, setCurrentBid] = useState(0)
  const currentBidRef = useRef(0)
  useEffect(() => { currentBidRef.current = currentBid }, [currentBid])

  useEffect(() => {
    async function fetchData() {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)
      
      const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
      if (data) {
        setAnn(data)
        if (data.is_auction) {
          setCurrentBid(data.current_bid || data.price)
        }

        fetchReviews(data.user_id)
        fetchSellerProfile(data.user_id) 
        if (currentUser) {
          checkIfPurchased(currentUser.id, data.id)
          checkExistingOffer(currentUser.id, data.id) 
        }

        await supabase.from('page_views').insert([{ 
          announcement_id: data.id, 
          viewer_id: currentUser?.id || null 
        }]);
      }
      setLoading(false)
    }
    if (id) fetchData()
  }, [id])

  useEffect(() => {
    if (!ann?.is_auction || !ann?.auction_end) return;

    // Copiati in costanti locali: dentro il setInterval qui sotto TypeScript
    // non può più sapere che "ann" è ancora valorizzato (potrebbe cambiare
    // nel frattempo), quindi leggiamo i valori una volta sola all'avvio del
    // conto alla rovescia - che è anche il comportamento corretto.
    const auctionEnd = ann.auction_end
    const auctionId = ann.id

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const end = new Date(auctionEnd).getTime()
      const distance = end - now

      if (distance < 0) {
        clearInterval(interval)
        setTimeLeft('ASTA SCADUTA')
        setIsAuctionEnded(true)
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24))
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)
        setTimeLeft(`${days > 0 ? days + 'g ' : ''}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
      }
    }, 1000)

    const channel = supabase.channel(`auction_${auctionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'announcements', filter: `id=eq.${auctionId}` }, (payload) => {
         if (payload.new.current_bid) {
           setCurrentBid(payload.new.current_bid)
           if (payload.new.current_bid > currentBidRef.current) {
             toast("⚠️ Qualcuno ha appena rilanciato!", { style: { background: '#f43f5e', color: 'white', border: 'none' } })
           }
         }
      }).subscribe()

    return () => { 
      clearInterval(interval); 
      supabase.removeChannel(channel); 
    }
  }, [ann])


  async function fetchSellerProfile(sellerId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', sellerId).single()
    if (data) setSeller(data)
  }

  // FIX: questa lettura falliva SEMPRE, per due motivi insieme.
  //  1. Filtrava su "reviewed_user_id", colonna che non esiste: nella
  //     tabella si chiama "reviewed_id".
  //  2. Chiedeva la join "reviewer:profiles!reviewer_id(...)", ma fra
  //     "reviews" e "profiles" non c'è nessuna chiave esterna, quindi
  //     PostgREST rispondeva 400 (PGRST200) a prescindere.
  // Nessuna recensione è quindi mai comparsa sotto un annuncio, e la media
  // voto del venditore risultava sempre "Nuovo".
  async function fetchReviews(sellerId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('reviewed_id', sellerId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Errore lettura recensioni:', error)
      return
    }
    if (!data) return

    // I nomi dei recensori con una seconda query, senza dipendere da una
    // relazione che il database non ha.
    const idRecensori = Array.from(new Set(data.map(r => r.reviewer_id).filter(Boolean)))
    if (idRecensori.length > 0) {
      const { data: autori } = await supabase
        .from('profiles')
        .select('id, first_name, nickname')
        .in('id', idRecensori)
      const mappa: Record<string, { first_name?: string }> = {}
      ;(autori || []).forEach(a => { mappa[a.id] = { first_name: a.nickname || a.first_name } })
      data.forEach(r => { r.reviewer = mappa[r.reviewer_id] || null })
    }

    setReviews(data)
  }

  async function checkIfPurchased(buyerId: string, annId: string) {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('buyer_id', buyerId)
      .eq('announcement_id', annId)
      .in('status', ['Pagato', 'Spedito', 'Ricevuto', 'Concluso'])
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
      .maybeSingle()
    if (data) setExistingOffer(data)
  }

  const handleAddToCart = () => {
    if (!ann) return;
    if (!user) { toast.error("Devi accedere per usare il carrello."); return; }
    if (user.id === ann.user_id) { toast.error("Non puoi comprare un tuo stesso oggetto."); return; }

    const disponibili = ann.quantity !== undefined ? ann.quantity : 1

    addItem({
      id: ann.id,
      title: ann.title,
      price: Number(ann.price),
      imageUrl: ann.image_url,
      image_url: ann.image_url,
      quantity: selectedQuantity,
      maxQuantity: disponibili,
    })
    toast.success("Aggiunto al carrello! 🛒")
    openCart()
  }

  // FIX: prima, per oggetti "Nuovo" o "Usato", questo pulsante bloccava
  // sempre la chat con un avviso ("devi prima completare l'acquisto o
  // vincere l'asta") - su richiesta, questa restrizione è stata tolta:
  // ora si può sempre scrivere al venditore di qualsiasi annuncio, di
  // qualunque condizione, senza dover prima comprare nulla.
  const handleContact = () => {
    if (!ann) return;
    if (!user) { toast.error("Devi accedere per continuare!"); return; }
    if (user.id === ann.user_id) { toast.error("Questo è il tuo annuncio."); return; }

    const startChat = async () => {
      setActionLoading(true);
      const { error } = await supabase.from('messages').insert([{
        content: `Ciao! Sono interessato al tuo annuncio: "${ann.title}".`,
        sender_id: user.id,
        receiver_id: ann.user_id
      }]);
      setActionLoading(false);
      if (error) {
        toast.error("Errore nell'invio del messaggio. Riprova.");
        return;
      }
      router.push('/chat');
    };
    startChat();
  }


  // Stesso conteggio per il link personale del Curatore: gli serve a sapere
  // se il link che ha in giro sta portando visite, o se sta perdendo tempo.
  const clickCuratoreContato = useRef(false)
  useEffect(() => {
    if (!curatoreCode || clickCuratoreContato.current) return
    clickCuratoreContato.current = true
    fetch('/api/curatore/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingCode: curatoreCode }),
    }).catch((err) => {
      console.warn('Conteggio visite curatore non riuscito:', err)
    })
  }, [curatoreCode])

  // NUOVO: avvia una vera proposta di baratto (vedi app/api/baratto/request).
  const handleProponiBaratto = async () => {
    if (!ann) return
    if (!user) { toast.error('Devi accedere per proporre un baratto.'); router.push('/login'); return }
    if (user.id === ann.user_id) { toast.error('Non puoi barattare un tuo stesso oggetto.'); return }

    setActionLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Sessione scaduta: rientra e riprova.')
        return
      }

      const res = await fetch('/api/baratto/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ itemId: ann.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Non è stato possibile avviare il baratto.')
        // Se una richiesta esiste già, mandiamolo dove può vederla.
        if (res.status === 409) router.push('/baratti')
        return
      }

      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Errore proposta baratto:', err)
      toast.error('Errore di connessione.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSecureBuy = async () => {
    if (!ann) return;
    if (!user) { toast.error("Devi accedere per acquistare."); return; }
    if (user.id === ann.user_id) { toast.error("Non puoi acquistare un tuo stesso oggetto."); return; }
    setActionLoading(true)

    try {
      // FIX: qui il browser leggeva "stripe_account_id" del venditore e, se
      // c'era, procedeva. Ma quel campo esiste già dal momento in cui il
      // venditore preme "Attiva pagamenti", anche senza aver completato
      // niente su Stripe: l'acquirente arrivava alla pagina di pagamento di
      // un venditore che non poteva incassare. Il controllo vero (che
      // interroga Stripe) sta in /api/stripe/checkout: qui lo lasciamo fare
      // a lui e ci limitiamo a mostrarne il messaggio, invece di dare un
      // via libera che non vale nulla.
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
          usePickup: usePickup,
          // Se siamo arrivati dal link personale del Curatore, il suo codice
          // viaggia fino alla cassa: e' la sola cosa che gli fa scattare la
          // percentuale. Senza, la vendita vale come normale.
          curatoreCode: curatoreCode || undefined,
        })
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setActionLoading(false); return; }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      toast.error("Errore di connessione. Controlla la rete e riprova.")
      setActionLoading(false)
    }
  }

  const submitOffer = async () => {
    if (!ann) return;
    if (!user) { toast.error("Devi accedere per fare una proposta."); return; }
    if (!offerPrice || isNaN(Number(offerPrice)) || Number(offerPrice) <= 0) {
      toast.error("Inserisci una cifra valida."); return;
    }
    if (Number(offerPrice) >= ann.price) {
      toast.error(`L'oggetto costa già €${ann.price}. Puoi acquistarlo direttamente!`); return;
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
      toast.success("Proposta inviata al venditore! Incrocia le dita 🤞")
      setShowOfferModal(false)
      checkExistingOffer(user.id, ann.id)

      // FIX: prima queste notifiche venivano scritte direttamente dal
      // browser con supabase.from('notifications').insert(...). La RLS
      // vieta di scrivere una riga intestata a un ALTRO utente: il database
      // rispondeva 401 e, non essendo mai controllato l'errore, al
      // venditore non arrivava nulla mentre l'app diceva "Proposta
      // inviata". Ora passa da /api/notify, che scrive con la chiave di
      // servizio e manda anche la push.
      //
      // Il blocco per il Proprietario era inoltre duplicato: due notifiche
      // identiche per una sola offerta. Ne resta una.
      await inviaNotifica([
        {
          userId: ann.user_id,
          message: `Hai ricevuto una nuova proposta di €${offerPrice} per il tuo annuncio "${ann.title}"!`,
          title: 'Nuova proposta 💡',
          url: `/announcement/${ann.id}`,
        },
        ...(ann.owner_id && ann.owner_id !== ann.user_id ? [{
          userId: ann.owner_id,
          message: `💡 Il Curatore ha ricevuto una proposta di €${offerPrice} per il tuo oggetto "${ann.title}".`,
          title: 'Nuova proposta sul tuo oggetto 💡',
          url: `/announcement/${ann.id}`,
        }] : []),
      ])
    } else {
      toast.error("Errore database: " + error.message)
    }
    setSubmittingOffer(false)
  }

  const submitBid = async () => {
    if (!ann) return;
    if (!user) { toast.error("Devi accedere per rilanciare."); return; }
    if (!offerPrice || isNaN(Number(offerPrice)) || Number(offerPrice) <= currentBid) {
      toast.error(`Devi rilanciare con una cifra maggiore di €${currentBid.toFixed(2)}!`); return;
    }

    setSubmittingOffer(true)

    // FIX: lo storico dei rilanci non veniva MAI registrato, per due motivi
    // sovrapposti. La colonna scritta era "amount" mentre in tabella si
    // chiama "bid_amount" (400 dal database), e comunque la RLS rifiuta un
    // inserimento in "bids" fatto dal browser (403). Nessuno dei due errori
    // veniva controllato: il prezzo dell'asta saliva, ma non restava traccia
    // di CHI avesse rilanciato - quindi a fine asta era impossibile sapere
    // chi avesse vinto. Ora il rilancio passa da una route server che
    // ricontrolla la cifra sul database e registra lo storico.
    const esito = await registraRilancio(ann.id, Number(offerPrice))
    if (!esito.ok) {
      toast.error(esito.errore || "Errore durante il rilancio.")
      setSubmittingOffer(false)
      return
    }

    toast.success("Rilancio effettuato con successo! Sei in vantaggio. 🔨")
    setCurrentBid(Number(offerPrice))
    setShowOfferModal(false)
    setOfferPrice('')

    // Stesso motivo delle proposte: scritta dal browser questa notifica non
    // arrivava mai al venditore (RLS). Ora passa dal server.
    await inviaNotifica([
      {
        userId: ann.user_id,
        message: `🔥 Nuovo rilancio di €${offerPrice} per la tua asta "${ann.title}"!`,
        title: 'Nuovo rilancio 🔨',
        url: `/announcement/${ann.id}`,
      },
      ...(ann.owner_id && ann.owner_id !== ann.user_id ? [{
        userId: ann.owner_id,
        message: `🔨 Nuovo rilancio di €${offerPrice} sulla tua asta "${ann.title}", gestita dal Curatore.`,
        title: 'Nuovo rilancio sulla tua asta 🔨',
        url: `/announcement/${ann.id}`,
      }] : []),
    ])

    setSubmittingOffer(false)
  }

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ann) return
    if (!user) { toast.error("Devi accedere per lasciare una recensione."); return }
    setSubmittingReview(true)
    // FIX: due colonne sbagliate insieme - "reviewed_user_id" (in tabella si
    // chiama "reviewed_id") e "announcement_id", che nella tabella delle
    // recensioni non esiste. Il database rispondeva 400, e il messaggio
    // mostrato all'utente era il fuorviante "Hai già recensito questo
    // ordine" - mentre in realtà nessuna recensione era mai stata salvata.
    const { error } = await supabase.from('reviews').insert([{
      reviewer_id: user.id,
      reviewed_id: ann.user_id,
      rating: newReview.rating,
      comment: newReview.comment
    }])

    if (!error) {
      toast.success('Recensione pubblicata con successo! ⭐')
      setNewReview({ rating: 5, comment: '' })
      setHasPurchased(false)
      fetchReviews(ann.user_id)
    } else {
      toast.error('Hai già recensito questo ordine.')
    }
    setSubmittingReview(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400 animate-pulse">Apertura in corso...</div>
  if (!ann) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs text-rose-500">Annuncio non trovato.</div>

  const maxQty = ann.quantity !== undefined ? ann.quantity : 1;
  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1) : 'Nuovo'
  
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(ann.city || 'Italia')}&t=&z=13&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-10 font-sans pb-32">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/20 backdrop-blur-md p-3 rounded-[2.5rem] shadow-xl border border-white/30 relative">
             {ann.is_sponsored && (
               <div className="absolute top-8 left-8 z-20 bg-gradient-to-r from-rose-500 to-orange-400 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl">
                 ✨ In Vetrina
               </div>
             )}
             <div className="rounded-[2rem] overflow-hidden bg-transparent">
               {/* Qui la foto va vista INTERA, non tagliata: e' il momento in
                   cui si decide se comprare. Le schede negli elenchi fanno il
                   contrario (riempiono il quadrato tagliando) perche' li'
                   conta l'ordine visivo, e una fila di foto tutte della stessa
                   forma si guarda meglio di una fila di strisce con le fasce
                   grigie ai lati - il difetto segnalato. */}
               <img loading="lazy" decoding="async" src={srcFoto(ann.image_url, 900, { taglio: 'contain' }) || "/usato.png"} srcSet={srcSetFoto(ann.image_url, 900, { taglio: 'contain' })} className="w-full h-auto object-contain aspect-square bg-stone-50" alt={ann.title} />
             </div>
             {ann.image_urls && ann.image_urls.length > 1 && (
               <div className="flex gap-3 p-4 overflow-x-auto custom-scrollbar">
                 {ann.image_urls.map((img: string, i: number) => (
                    <img loading="lazy" decoding="async" key={i} src={srcFoto(img, 200)} srcSet={srcSetFoto(img, 200)} alt={`${ann.title} - foto ${i + 1}`} className="w-24 h-24 rounded-2xl object-cover border-2 border-white/40 hover:border-rose-400 cursor-pointer transition-all flex-shrink-0 shadow-sm" />
                 ))}
               </div>
             )}
          </div>

          <div className="bg-white/20 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/30 shadow-xl overflow-hidden">
            <h3 className="text-xs font-black uppercase text-stone-900 tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></span> Posizione
            </h3>
            <div className="w-full h-64 rounded-3xl overflow-hidden border border-white/20 shadow-inner relative">
              <iframe 
                width="100%" 
                height="100%" 
                frameBorder="0" 
                scrolling="no" 
                title="Mappa della località"
                src={mapUrl}
                className={mapActive ? '' : 'pointer-events-none'}
              ></iframe>
              {!mapActive && (
                <button
                  type="button"
                  onClick={() => setMapActive(true)}
                  className="absolute inset-0 w-full h-full flex items-center justify-center bg-stone-900/5"
                >
                  <span className="bg-stone-900/80 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg">
                    Tocca per interagire con la mappa
                  </span>
                </button>
              )}
            </div>
            <p className="mt-3 text-xs font-black text-stone-900 uppercase italic">Località: {ann.city || 'Non specificata'}</p>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/20 backdrop-blur-md p-8 rounded-[3rem] shadow-2xl border border-white/30 relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
               <div className="space-y-1">
                  <span className="bg-stone-900 text-white text-[10px] font-black uppercase px-3 py-1 rounded-md tracking-widest">
                    {ann.category_id || ann.category} • {ann.condition}
                  </span>
                  <h1 className="text-4xl font-black uppercase italic text-stone-900 leading-none pt-3">{ann.title}</h1>
               </div>
               {ann.type === 'offered' && <span className="bg-rose-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg shadow-rose-200">Gift</span>}
               {ann.is_auction && <span className="bg-rose-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase shadow-lg shadow-rose-500/50 animate-pulse">Asta ⏳</span>}
            </div>

            <Link href={`/seller/${ann.user_id}`} className="flex items-center justify-between bg-white/40 p-4 rounded-2xl border border-white/50 hover:bg-white/60 transition-all mb-8 group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-stone-900 rounded-full flex items-center justify-center font-black text-sm text-white uppercase">
                    {seller?.nickname?.[0] || seller?.first_name?.[0] || 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-stone-600">Venditore</span>
                    <span className="text-sm font-black uppercase text-stone-900 group-hover:text-rose-500 transition-colors">
                      {seller?.nickname || seller?.first_name || 'Utente Re-love'} →
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-orange-500 text-lg">★</span>
                  <span className="text-sm font-black text-stone-900">{avgRating}</span>
                  <span className="text-[10px] text-stone-600 font-bold">({reviews.length})</span>
                </div>
            </Link>

            <div className="mb-8">
               {ann.condition === 'Baratto' ? (
                 <div className="bg-blue-500/20 border border-blue-400/30 p-5 rounded-2xl backdrop-blur-sm">
                    <p className="text-xs font-black text-blue-700 uppercase tracking-widest">Modalità Baratto</p>
                    <p className="text-2xl font-black text-stone-900 uppercase italic mt-1">
                      🔄 Cerca: {ann.exchange_item || 'Oggetto da concordare'}
                    </p>
                 </div>
               ) : ann.is_auction ? (
                 <div className={`p-6 rounded-3xl text-white shadow-xl transition-all ${isAuctionEnded ? 'bg-stone-900' : 'bg-gradient-to-br from-red-600 to-rose-500 shadow-rose-500/30 animate-[pulse_3s_ease-in-out_infinite]'}`}>
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                          <Timer size={24} className={isAuctionEnded ? "text-stone-500" : "text-white"} />
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{isAuctionEnded ? 'Stato Asta' : 'Scadenza Asta'}</p>
                            <p className="text-xl font-black tabular-nums tracking-wider">{timeLeft || 'Calcolo...'}</p>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Offerta Attuale</p>
                          <p className="text-3xl font-black italic">€ {currentBid?.toFixed(2)}</p>
                       </div>
                    </div>
                 </div>
               ) : (
                 <>
                   <p className="text-5xl font-black text-stone-900 italic drop-shadow-sm">
                      {ann.type === 'offered' || ann.condition === 'Regalo' ? 'GRATIS' : `€ ${(ann.price * selectedQuantity).toFixed(2)}`}
                   </p>
                 </>
               )}

               {!usePickup && (ann.shipping_cost ?? 0) > 0 && ann.condition !== 'Baratto' && (
                 <p className="text-xs font-black text-stone-600 uppercase mt-2">+ Spese Spedizione € {ann.shipping_cost}</p>
               )}
            </div>

            {ann.condition !== 'Baratto' && ann.condition !== 'Regalo' && !ann.is_auction && (
              <div className="space-y-6 mb-10">
                 <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-stone-900 tracking-[0.2em]">Quantità (Max: {maxQty})</p>
                    <div className="flex items-center gap-4">
                      <input type="range" min="1" max={maxQty} value={selectedQuantity} onChange={(e) => setSelectedQuantity(Number(e.target.value))} className="flex-grow accent-rose-500" />
                      <span className="w-12 h-12 flex items-center justify-center bg-stone-900 text-white rounded-xl font-black text-sm">{selectedQuantity}</span>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-stone-900 tracking-[0.2em]">Metodo di ricezione</p>
                    <button onClick={() => setUsePickup(false)} className={`w-full p-5 rounded-2xl border flex justify-between items-center transition-all ${!usePickup ? 'border-rose-500 bg-white/60' : 'border-white/40 bg-white/20 hover:bg-white/40'}`}>
                      <div className="text-left">
                         <p className="text-xs font-black uppercase text-stone-900">Spedizione Standard</p>
                         <p className="text-[10px] font-bold text-stone-600 italic mt-0.5">Tracciata Re-love</p>
                      </div>
                      <span className="font-black text-sm text-stone-900">€ {ann.shipping_cost || '0.00'}</span>
                    </button>

                    {ann.allow_local_pickup && (
                      <button onClick={() => setUsePickup(true)} className={`w-full p-5 rounded-2xl border flex justify-between items-center transition-all ${usePickup ? 'border-emerald-500 bg-emerald-100/60' : 'border-white/40 bg-white/20 hover:bg-white/40'}`}>
                        <div className="text-left">
                           <p className="text-xs font-black uppercase text-emerald-900">Consegna a mano</p>
                           <p className="text-[10px] font-bold text-emerald-800 italic mt-0.5">Presso {ann.city || 'località del venditore'}</p>
                        </div>
                        <span className="font-black text-xs uppercase text-emerald-700 bg-emerald-200/60 px-2 py-1 rounded">Gratis</span>
                      </button>
                    )}
                 </div>
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-white/20">
               {user?.id !== ann.user_id ? (
                 <>
                   {ann.is_auction ? (
                     <button 
                       onClick={() => { if(!user){ router.push('/login'); return; } setShowOfferModal(true); }} 
                       disabled={actionLoading || isAuctionEnded} 
                       className="w-full bg-stone-900 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                     >
                        <Gavel size={20} /> {isAuctionEnded ? 'Asta Conclusa' : 'Fai un Rilancio'}
                     </button>
                   ) : ann.condition === 'Nuovo' || ann.condition === 'Usato' ? (
                     <div className="space-y-3 flex flex-col items-center">
                       <button onClick={handleSecureBuy} disabled={actionLoading || maxQty <= 0} className="w-full bg-stone-900 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-rose-500 transition-all disabled:opacity-30">
                          {actionLoading ? 'In corso...' : 'Acquista Ora'}
                       </button>

                       <button onClick={handleAddToCart} disabled={actionLoading || maxQty <= 0} className="w-full bg-white/40 border-2 border-stone-900/20 text-stone-900 p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/80 transition-all disabled:opacity-30 flex items-center justify-center gap-2">
                          <ShoppingCart size={16} /> Aggiungi al Carrello
                       </button>

                       {existingOffer ? (
                         <div className={`w-full p-4 rounded-2xl text-center border ${existingOffer.status === 'In attesa' ? 'bg-orange-100/60 border-orange-200' : existingOffer.status === 'Rifiutata' ? 'bg-rose-100/60 border-rose-200' : 'bg-emerald-100/60 border-emerald-200'}`}>
                           <p className="text-xs font-black uppercase text-stone-900 tracking-widest">
                             La tua offerta (€{existingOffer.offer_price}): <span className={existingOffer.status === 'In attesa' ? 'text-orange-600' : existingOffer.status === 'Rifiutata' ? 'text-rose-600' : 'text-emerald-600'}>{existingOffer.status}</span>
                           </p>
                         </div>
                       ) : (
                         <button onClick={() => { if(!user){ router.push('/login'); return; } setShowOfferModal(true); }} disabled={actionLoading || maxQty <= 0} className="w-full bg-white/40 border-2 border-white/60 text-stone-900 p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/80 transition-all disabled:opacity-30">
                           💡 Fai una Proposta
                         </button>
                       )}

                       {/* NUOVO: prima, per gli oggetti Nuovo/Usato, non
                           c'era ALCUN modo di scrivere al venditore prima
                           di comprare - su richiesta, questo pulsante
                           permette di farlo sempre, per qualsiasi tipo di
                           annuncio. */}
                       <button onClick={handleContact} disabled={actionLoading} className="w-full text-stone-900 font-black text-xs underline hover:text-rose-600 transition-all mt-2">
                         💬 Scrivi al venditore
                       </button>
                     </div>
                   ) : ann.condition === 'Baratto' ? (
                     /* NUOVO: questo pulsante apriva solo una chat, esattamente
                        come "Contatta il venditore" qui sotto - il sistema
                        Baratto (route /api/baratto/*, tabella "baratti") non
                        veniva mai coinvolto e restava inutilizzato. Ora avvia
                        davvero una proposta di scambio. */
                     <div className="space-y-3">
                       <button
                         onClick={handleProponiBaratto}
                         disabled={actionLoading}
                         className="w-full bg-rose-500 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-stone-900 transition-all disabled:opacity-30"
                       >
                         {actionLoading ? 'In corso...' : 'Proponi Baratto'}
                       </button>
                       <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                         <p className="text-[10px] font-bold text-blue-800 leading-relaxed">
                           Blocchi 2,50 € sulla carta, senza pagarli. L&apos;addebito scatta solo se l&apos;altra
                           persona accetta lo scambio: se rifiuta, i soldi tornano subito disponibili.
                         </p>
                       </div>
                     </div>
                   ) : (
                     <button onClick={handleContact} disabled={actionLoading} className="w-full bg-rose-500 text-white p-5 rounded-2xl font-black uppercase text-sm tracking-[0.1em] shadow-xl hover:bg-stone-900 transition-all disabled:opacity-30">
                        Prendi Regalo
                     </button>
                   )}
                   
                   {/* NUOVO: tasto condividi. Sul telefono apre il pannello
                       di sistema (WhatsApp, Telegram...), su computer copia
                       il link negli appunti. */}
                   <BottoneCondividi
                     percorso={`/announcement/${ann.id}`}
                     titolo={ann.title}
                     testo={`${ann.title} - ${ann.condition === 'Regalo' ? 'in regalo' : ann.condition === 'Baratto' ? 'in baratto' : `€ ${Number(ann.price).toFixed(2)}`} su Re-love`}
                     className="w-full bg-white/40 border-2 border-white/60 text-stone-900 p-4 rounded-2xl text-xs hover:bg-white/80 mt-3"
                   />

                   {/* CURATORE LOCALE: compare solo se il proprietario ha
                       davvero chiesto aiuto e nessuno se ne sta gia'
                       occupando. */}
                   <div className="mt-3">
                     <BottoneCandidatura
                       annuncioId={ann.id}
                       annuncio={ann}
                       percentualeOfferta={ann.curator_percentage}
                       utenteId={user?.id || null}
                       className="w-full p-4 rounded-2xl text-xs"
                     />
                   </div>

                   <button onClick={handleContact} disabled={actionLoading} className="text-stone-900 font-black text-xs underline hover:text-rose-600 transition-all mt-4 w-full text-center disabled:opacity-30">
                     Hai dubbi? Contatta il venditore in chat
                   </button>
                 </>
               ) : (
                 <div className="space-y-3">
                    <div className="p-4 bg-white/40 rounded-2xl text-center border border-white/50">
                      <p className="text-[10px] font-black uppercase text-stone-900">Questo è il tuo annuncio</p>
                    </div>

                    {ann.cerca_curatore && !ann.curator_id && (
                      <Link href="/curatore" className="block p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center hover:bg-amber-100 transition-colors">
                        <p className="text-[10px] font-black uppercase text-amber-900">Stai cercando un curatore</p>
                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                          Le candidature arrivano in Curatore Locale
                        </p>
                      </Link>
                    )}

                    {/* Anche sul proprio annuncio: è il caso in cui serve di
                        più, per farlo girare fra amici e social. */}
                    <BottoneCondividi
                      percorso={`/announcement/${ann.id}`}
                      titolo={ann.title}
                      testo={`${ann.title} - € ${Number(ann.price).toFixed(2)} su Re-love`}
                      className="w-full bg-white/40 border-2 border-white/60 text-stone-900 p-4 rounded-2xl text-xs hover:bg-white/80"
                    />
                    {!ann.is_sponsored && (
                      <Link
                        href={`/vetrina/interna?ad_id=${ann.id}`}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-400 to-rose-500 text-white p-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:scale-105 transition-transform"
                      >
                        <Sparkles size={16} /> Metti in Vetrina (2,99€)
                      </Link>
                    )}
                 </div>
               )}
            </div>
          </div>
          
          <div className="bg-stone-900/90 backdrop-blur-md p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-20 text-5xl">🚚</div>
             <h3 className="text-xs font-black uppercase text-rose-400 tracking-[0.3em] mb-6">Stato Spedizione</h3>
             
             <div className="space-y-6 relative">
                <div className="absolute left-1.5 top-0 bottom-0 w-0.5 bg-stone-700"></div>
                <div className="flex items-center gap-4 relative">
                  <div className="w-3 h-3 bg-rose-500 rounded-full border-4 border-stone-900 z-10 shadow-[0_0_10px_rgba(244,63,94,0.8)]"></div>
                  <p className="text-xs font-black uppercase text-stone-100 italic tracking-wider">In attesa di acquisto</p>
                </div>
                <div className="flex items-center gap-4 relative opacity-40">
                  <div className="w-3 h-3 bg-stone-500 rounded-full border-4 border-stone-900 z-10"></div>
                  <p className="text-xs font-black uppercase text-stone-300 italic">Pacco affidato al corriere</p>
                </div>
             </div>
          </div>

          <div className="bg-white/20 backdrop-blur-md rounded-[2.5rem] p-8 border border-white/30 shadow-xl">
            <h3 className="text-sm font-black uppercase italic text-stone-900 mb-6">Feedback della Community</h3>
            {hasPurchased && (
              <form onSubmit={submitReview} className="mb-8 p-6 bg-rose-500/20 rounded-3xl border border-rose-400/30">
                <h4 className="text-xs font-black uppercase text-rose-700 mb-4">Lascia la tua opinione</h4>
                <div className="flex gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button" onClick={() => setNewReview({...newReview, rating: star})} className={`text-3xl ${newReview.rating >= star ? 'text-orange-500' : 'text-stone-400'} transition-transform hover:scale-125`}>★</button>
                  ))}
                </div>
                <textarea required className="w-full p-4 rounded-2xl border border-white/50 bg-white/40 outline-none text-sm font-bold mb-4 text-stone-900 placeholder:text-stone-500" placeholder="Come ti sei trovato con il venditore?" value={newReview.comment} onChange={(e) => setNewReview({...newReview, comment: e.target.value})} />
                <button disabled={submittingReview} type="submit" className="w-full bg-rose-500 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md">Pubblica Feedback</button>
              </form>
            )}
            
            <div className="space-y-4">
              {reviews.length === 0 ? <p className="text-xs font-black text-stone-900 italic text-center py-6">Nessun feedback ancora.</p> : reviews.slice(0, visibleReviews).map(review => (
                  <div key={review.id} className="p-5 bg-white/30 rounded-2xl border border-white/40">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-black uppercase text-stone-900 italic">{review.reviewer?.first_name || 'Utente Re-love'}</span>
                      <div className="flex text-orange-500 text-sm">{'★'.repeat(review.rating)}</div>
                    </div>
                    <p className="text-sm font-black text-stone-800 italic">&ldquo;{review.comment}&rdquo;</p>
                  </div>
              ))}
              {reviews.length > visibleReviews && (
                <button onClick={() => setVisibleReviews(prev => prev + 3)} className="w-full py-4 text-[10px] font-black uppercase text-stone-900 hover:text-rose-600 transition-all tracking-widest">↓ Vedi altri</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showOfferModal && (
        <div className="fixed inset-0 z-[15000] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md">
          <div className="bg-white max-w-sm w-full rounded-[3rem] p-10 shadow-2xl text-center border-t-8 border-rose-500 animate-in zoom-in">
            
            <h2 className="text-2xl font-black uppercase italic text-stone-900 mb-2">
              {ann.is_auction ? "Fai un Rilancio" : "Fai un'offerta"}
            </h2>
            <p className="text-xs font-black uppercase text-stone-400 mb-6 tracking-widest">
              {ann.is_auction ? `Devi superare i €${currentBid.toFixed(2)}` : `Prezzo originale: €${ann.price}`}
            </p>
            
            <div className="relative mb-8 flex items-center justify-center">
              <span className="absolute left-6 text-3xl font-black text-stone-300">€</span>
              <input 
                type="number" 
                min={ann.is_auction ? currentBid + 1 : 1} 
                max={ann.is_auction ? 99999 : ann.price - 1} 
                value={offerPrice} 
                onChange={(e) => setOfferPrice(e.target.value)} 
                className="w-full text-center text-5xl font-black text-stone-900 p-6 bg-stone-50 rounded-3xl outline-none focus:ring-4 focus:ring-rose-500/20 transition-all" 
                placeholder="0"
              />
            </div>
            
            <div className="space-y-3">
               <button onClick={ann.is_auction ? submitBid : submitOffer} disabled={submittingOffer} className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl hover:bg-rose-500 transition-all disabled:opacity-30">
                 {ann.is_auction ? "Conferma Rilancio 🔨" : "Invia Proposta"}
               </button>
               <button onClick={() => setShowOfferModal(false)} className="w-full text-stone-400 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 transition-all">
                 Annulla
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AnnouncementClientWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center font-black uppercase tracking-widest text-stone-400 text-xs">In caricamento...</div>}>
      <AnnouncementContent />
    </Suspense>
  )
}
