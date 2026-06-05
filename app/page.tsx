'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Mic, MicOff, Search, MapPin, Heart, Crown, Mail } from 'lucide-react'
import { toast } from 'sonner'

interface Announcement {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  category_id?: string;
  category?: string;
  condition: string;
  type?: string;
  image_url: string;
  image_urls?: string[];
  user_id: string;
  created_at: string;
  is_sponsored?: boolean;
}

// --- COMPONENTE TOOLTIP RIUTILIZZABILE 💬 ---
const Tooltip = ({ children, text, wrapperClass = "relative w-full h-full" }: { children: React.ReactNode, text: string, wrapperClass?: string }) => {
  return (
    <div className={`${wrapperClass} group flex justify-center items-center`}>
      {children}
      {/* La Nuvoletta (Nascosta di default, appare in hover) */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-300 z-[999] pointer-events-none">
        <div className="bg-stone-900 text-white text-[10px] font-bold tracking-wide uppercase px-3 py-2 rounded-xl shadow-xl whitespace-nowrap border border-stone-700">
          {text}
        </div>
        {/* Triangolino sotto la nuvoletta */}
        <div className="w-3 h-3 bg-stone-900 border-r border-b border-stone-700 rotate-45 transform origin-top-left mx-auto -mt-2"></div>
      </div>
    </div>
  )
}

function HomePageContent() {
  const [user, setUser] = useState<User | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // STATI PER LA RICERCA AVANZATA (FILTRI GRANULARI) E VOCALE 🎙️
  const [mainSearch, setMainSearch] = useState('') 
  const [isListening, setIsListening] = useState(false)
  
  const [searchCategory, setSearchCategory] = useState('all')
  const [condition, setSearchCondition] = useState('all')
  const [minPrice, setMinPrice] = useState('') 
  const [maxPrice, setMaxPrice] = useState('') 
  const [distance, setDistance] = useState(0) 
  
  const [visibleCount, setVisibleCount] = useState(12)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const catFilter = searchParams.get('cat')
  const typeFilter = searchParams.get('type')
  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { 
    fetchInitialData() 
  }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    
    const { data: ads, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && ads) {
      setAnnouncements(ads as Announcement[])
    }
    
    if (u) {
      const { data: favs } = await supabase.from('favorites').select('announcement_id').eq('user_id', u.id)
      if (favs) setFavorites(favs.map(f => f.announcement_id))
    }
    setLoading(false)
  }

  // --- MOTORE DI RICERCA VOCALE REALE 🎙️ ---
  const handleVoiceSearch = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Il tuo browser non supporta la ricerca vocale.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      toast("🎙️ In ascolto... Parla ora", { duration: 3000 });
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setMainSearch(transcript);
      toast.success(`Hai cercato: "${transcript}"`);
    };

    recognition.onerror = (event: any) => {
      toast.error("Non ho capito, riprova.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }

  const handleNearbySearch = () => {
    if (distance > 0) { 
      setDistance(0)
      fetchInitialData() 
    } else {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setDistance(20) 
        const { data, error } = await supabase.rpc('get_nearby_announcements', {
          user_lat: pos.coords.latitude, 
          user_lon: pos.coords.longitude, 
          radius_meters: 20000
        })
        if (!error && data) {
          setAnnouncements(data as Announcement[])
        }
      })
    }
  }

  async function handleToggleFavorite(e: React.MouseEvent, announcementId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { toast.error("Devi accedere per salvare i tuoi preferiti ❤️"); return; }
    
    if (favorites.includes(announcementId)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('announcement_id', announcementId)
      if (!error) setFavorites(favorites.filter(id => id !== announcementId))
    } else {
      const { error } = await supabase.from('favorites').insert([{ user_id: user.id, announcement_id: announcementId }])
      if (!error) setFavorites([...favorites, announcementId])
    }
  }

  // --- MOTORE DI RICERCA A FACCETTE MULTIPLE ---
  const filteredData = announcements.filter(item => {
    const titleMatch = item.title.toLowerCase().includes(mainSearch.toLowerCase())
    const categoryMatch = catFilter ? item.category_id?.toString() === catFilter : (searchCategory === 'all' || item.category === searchCategory)
    const conditionMatch = condition === 'all' || item.condition === condition
    const typeMatch = !typeFilter || item.type === typeFilter
    const availableMatch = item.quantity > 0 
    
    const itemPrice = Number(item.price);
    const minP = minPrice ? Number(minPrice) : 0;
    const maxP = maxPrice ? Number(maxPrice) : Infinity;
    const priceMatch = itemPrice >= minP && itemPrice <= maxP;

    return titleMatch && categoryMatch && conditionMatch && typeMatch && availableMatch && priceMatch;
  })

  const sortedData = [...filteredData].sort((a, b) => {
    if (a.is_sponsored && !b.is_sponsored) return -1;
    if (!a.is_sponsored && b.is_sponsored) return 1;
    return 0; 
  })

  const topItems = sortedData.filter(i => i.condition === 'Nuovo').slice(0, 5)
  const regularItems = sortedData.filter(i => !topItems.find(t => t.id === i.id))

  // SKELETON LOADER COMPONENT (Sagome pulsanti senza sfocature) 🦴
  const SkeletonCard = ({ isTop = false }) => (
    <div className={`bg-white rounded-[2rem] p-4 shadow-sm border border-stone-200 animate-pulse flex flex-col relative overflow-hidden ${isTop ? 'h-64' : 'h-56'}`}>
       <div className={`w-full bg-stone-200 rounded-2xl mb-4 ${isTop ? 'h-32' : 'h-28'}`}></div>
       <div className="w-3/4 h-4 bg-stone-200 rounded mb-2"></div>
       <div className="w-1/2 h-6 bg-stone-200 rounded mt-auto"></div>
       {!isTop && <div className="w-full h-8 bg-stone-200 rounded mt-3"></div>}
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20 relative">
      
      {IS_STAFF && (
        <Link href="/staff" className="fixed bottom-8 right-8 z-[99] bg-stone-900 text-rose-400 w-16 h-16 rounded-full shadow-lg font-bold flex items-center justify-center border-2 border-rose-400 hover:scale-105 active:scale-95 transition-all text-2xl">
          <Crown size={28} />
        </Link>
      )}

      {/* BARRA DI RICERCA SENZA SFUMATURE ED EFFETTI SFOCATI */}
      <div className="w-full max-w-7xl mx-auto px-4 pt-4 flex justify-center sticky top-0 z-[100] bg-stone-50">
        <div className="relative w-full max-w-2xl shadow-md rounded-[2rem] bg-white border border-stone-200">
          <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
            <Search className="text-stone-400" size={24} strokeWidth={2.5} />
          </div>
          <input 
            type="text" 
            value={mainSearch}
            placeholder="Cerca vestiti, elettronica, arredamento..." 
            className="w-full py-4 pl-16 pr-20 rounded-[2rem] bg-white border-none outline-none text-base md:text-lg font-black text-stone-900 focus:ring-4 focus:ring-rose-100 transition-all placeholder:text-stone-400" 
            onChange={(e) => setMainSearch(e.target.value)} 
          />
          {/* TOOLTIP: PULSANTE VOCALE */}
          <Tooltip text={isListening ? "In ascolto..." : "Ricerca con la voce! 🎙️"} wrapperClass="absolute inset-y-2 right-2">
            <button 
             onClick={handleVoiceSearch}
             className={`w-11 h-11 md:w-12 md:h-12 rounded-[1.5rem] flex items-center justify-center transition-all ${isListening ? 'bg-rose-600 text-white' : 'bg-stone-100 text-rose-500 hover:bg-stone-200 shadow-sm'}`}
            >
             {isListening ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* --- HERO SECTION 16/9 CON INQUADRATURA COMPLETA --- */}
      <div className="relative w-full aspect-[16/9] max-h-[580px] flex flex-col items-center justify-center overflow-hidden bg-transparent mt-2">
          <div className="absolute inset-0 z-0 w-full h-full">
            <img 
              src="/hero-2.png" 
              alt="Re-love Hero Completa"
              className="w-full h-full object-contain object-center scale-100"
            />
          </div>
      </div>

      {/* --- CONFIGURAZIONE GRIGLIA CON BANNER LATERALI ADATTIVI RIPORTATI A MISURE CORRETTE --- */}
      <div className="w-full max-w-[1750px] mx-auto px-4 md:px-6 mt-6 lg:-mt-12 relative z-20 flex flex-col lg:flex-row gap-6">
        
        {/* SIDEBAR BANNER SINISTRA (SPONSOR) - ORA FLUIDA E ORDINATA */}
        <aside className="flex flex-col gap-6 w-full lg:w-[280px] xl:w-[320px] shrink-0 self-start lg:sticky lg:top-24 order-2 lg:order-1 mt-8 lg:mt-0">
          <div className="bg-white border border-stone-200 rounded-[2rem] p-5 shadow-md flex flex-col items-center text-center justify-between min-h-[560px] w-full">
            <div className="w-full h-full flex flex-col">
              <span className="bg-stone-100 text-stone-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4 inline-block self-center">Sponsor</span>
              <div className="w-full flex-1 bg-stone-100 rounded-2xl border border-stone-200 flex items-center justify-center mb-4 overflow-hidden relative min-h-[360px]">
                <img 
                  src="/adv-riuso-sostenibile.png" 
                  alt="Servizi di Riuso e Riparazione Re-love" 
                  className="w-full h-full object-contain p-2 absolute inset-0"
                />
              </div>
              <h3 className="text-base font-black uppercase text-stone-900 tracking-tight leading-tight mt-2">Servizi di Riuso e Riparazione</h3>
              <p className="text-xs text-stone-500 mt-1 font-medium">dome0082@gmail.com</p>
            </div>
            
            <a 
              href="mailto:dome0082@gmail.com?subject=Richiesta%20Spazio%20Pubblicitario%20Re-love" 
              className="relative z-[100] pointer-events-auto block w-full mt-4 bg-stone-950 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 transition-colors text-center shadow-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <span className="flex items-center justify-center gap-2">
                <Mail size={12} />
                Contattaci
              </span>
            </a>
          </div>

          <div className="bg-stone-100 border border-stone-200 rounded-[2rem] p-5 shadow-sm text-center">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">Offerte Esclusive</h4>
            <p className="text-xs font-bold text-stone-800 leading-snug">Gli oggetti più rari scelti dalla community.</p>
          </div>
        </aside>

        {/* CONTENUTO CENTRALE - ORDINE AGGIORNATO PER MOBILE */}
        <main className="flex-1 w-full overflow-hidden order-1 lg:order-2">
          
          {/* VIDEO IN FORMATO MAX 420PX BLOCCATO AL CENTRO IN AUTOMATICO E IN LOOP PIU IN BASSO */}
          <div className="w-full max-w-[420px] mx-auto mt-8 mb-10 rounded-[2rem] overflow-hidden border border-stone-200 shadow-md bg-white">
            <video 
              src="/hero-video.mp4" 
              className="w-full h-auto object-cover block"
              autoPlay 
              muted 
              loop 
              playsInline
            />
          </div>

          {/* FILTRI CON COLORI SOLIDI E PIATTI */}
          <section className="mb-12 bg-white p-6 rounded-[2.5rem] shadow-md border border-stone-200 flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-stone-900 ml-2 tracking-widest">Categoria</label>
                <select onChange={(e) => setSearchCategory(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-black uppercase tracking-wide outline-none border border-stone-200 hover:bg-white transition-colors cursor-pointer text-stone-900">
                  <option value="all">Tutte le Categorie</option>
                  <option value="Abbigliamento e Accessori">👕 Abbigliamento e Accessori</option>
                  <option value="Elettronica e Informatica">💻 Elettronica e Informatica</option>
                  <option value="Casa, Arredamento e Giardino">🛋️ Casa, Arredo, Giardino</option>
                  <option value="Alimentari e Bevande">🍎 Alimentari e Bevande</option>
                  <option value="Libri, Film e Musica">📚 Libri, Film e Musica</option>
                  <option value="Salute e Bellezza">💄 Salute e Bellezza</option>
                  <option value="Sport e Tempo Libero">⚽ Sport e Tempo Libero</option>
                  <option value="Motori e Veicoli">🚗 Motori e Veicoli</option>
                  <option value="Altro / Varie">📦 Altro / Varie</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-stone-900 ml-2 tracking-widest">Condizione</label>
                <select onChange={(e) => setSearchCondition(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-black uppercase tracking-wide outline-none border border-stone-200 hover:bg-white transition-colors cursor-pointer text-stone-900">
                  <option value="all">Tutte</option>
                  <option value="Nuovo">✨ Nuovo</option>
                  <option value="Usato">♻️ Usato</option>
                  <option value="Regalo">🎁 In Regalo</option>
                  <option value="Baratto">🤝 Baratto</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-black uppercase text-stone-900 ml-2 tracking-widest">Fascia di Prezzo (€)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full p-3 bg-stone-50 rounded-xl text-[11px] font-black outline-none border border-stone-200 hover:bg-white focus:bg-white focus:border-rose-500 transition-colors"
                  />
                  <span className="text-stone-400 font-black">-</span>
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full p-3 bg-stone-50 rounded-xl text-[11px] font-black outline-none border border-stone-200 hover:bg-white focus:bg-white focus:border-rose-500 transition-colors"
                  />
                </div>
              </div>

              {/* TOOLTIP: PULSANTE RADAR */}
              <div className="flex flex-col gap-2">
                <Tooltip text="Trova annunci in un raggio di 20km 📍" wrapperClass="relative w-full">
                  <button onClick={handleNearbySearch} className={`w-full p-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 ${distance > 0 ? 'bg-rose-600 text-white' : 'bg-stone-900 text-white hover:bg-rose-600'}`}>
                    <MapPin size={16} />
                    {distance > 0 ? 'Filtro 20km Attivo' : 'Radar Zona'}
                  </button>
                </Tooltip>
              </div>
            </div>
          </section>

          {/* QUATTRO RIQUADRI CENTRALI - RIPORTATI A WIDTH COMPLETA E IMMAGINI CONTAIN */}
          {!catFilter && !typeFilter && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16 max-w-5xl mx-auto px-2">
              
              {/* TOOLTIP: VENDI NUOVO */}
              <Tooltip text="Metti in vendita un oggetto mai usato ✨" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=new" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-white hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/nuovo.png" className="w-full h-full object-contain p-4 pb-10" alt="Nuovo" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Vendi Nuovo</span>
                   </div>
                </Link>
              </Tooltip>
              
              {/* TOOLTIP: VENDI USATO */}
              <Tooltip text="Dai una seconda vita ai tuoi oggetti ♻️" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=used" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-white hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/usato.png" className="w-full h-full object-contain p-4 pb-10" alt="Usato" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Vendi Usato</span>
                   </div>
                </Link>
              </Tooltip>
              
              {/* TOOLTIP: REGALO */}
              <Tooltip text="Regala o trova oggetti gratis in regalo 🎁" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=gift" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-white hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/regalo.png" className="w-full h-full object-contain p-4 pb-10" alt="Regalo" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Regalo</span>
                   </div>
                </Link>
              </Tooltip>

              {/* TOOLTIP: BARATTO */}
              <Tooltip text="Scambia i tuoi oggetti senza usare soldi 🤝" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=barter" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-white hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/baratto.png" className="w-full h-full object-contain p-4 pb-10" alt="Baratto" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Baratto</span>
                   </div>
                </Link>
              </Tooltip>
            </div>
          )}

          {/* SEZIONE VETRINA TOP */}
          <section className="mb-20">
            <div className="flex justify-between items-end mb-8 border-b border-stone-300 pb-4">
              <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900">Vetrina Top Nuovo</h2>
              <Link href="/?condition=Nuovo" className="text-[10px] font-black uppercase text-rose-600 hover:text-stone-900 transition-colors">Vedi tutti →</Link>
            </div>
            
            {loading ? (
               <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                 {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`top-skel-${i}`} isTop={true} />)}
               </div>
            ) : topItems.length === 0 ? (
               <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-center my-10">Nessun oggetto TOP trovato con questi filtri.</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                {topItems.map(item => (
                  <div key={item.id} className={`group bg-white p-4 rounded-[2rem] shadow-md border ${item.is_sponsored ? 'border-orange-400 ring-2 ring-orange-400' : 'border-stone-200'} hover:bg-stone-50 transition-all relative overflow-hidden`}>
                    {item.is_sponsored && (
                      <div className="absolute top-0 left-0 bg-orange-500 text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-br-2xl z-40 tracking-widest shadow-sm">
                        TOP ✨
                      </div>
                    )}
                    <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-6 right-6 z-30 bg-white w-8 h-8 flex items-center justify-center rounded-full shadow-md hover:scale-110 transition-all">
                      <Heart size={16} className={favorites.includes(item.id) ? "fill-rose-500 text-rose-500" : "text-stone-400"} />
                    </button>
                    <Link href={`/announcement/${item.id}`}>
                      <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 mb-4 relative border border-stone-200">
                        <img src={item.image_url || "/nuovo.png"} className="w-full h-full object-contain" alt={item.title} />
                      </div>
                      <h4 className="text-[12px] font-black uppercase truncate text-stone-900 mb-1">{item.title}</h4>
                      <p className="text-xl font-black text-rose-600 italic">€ {item.price}</p>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* TUTTI GLI ANNUNCI */}
          <section className="mb-20">
            <div className="flex justify-between items-end mb-8 border-b border-stone-300 pb-4">
              <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 opacity-50">Tutti gli Annunci</h2>
            </div>
            
            {loading ? (
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                 {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={`reg-skel-${i}`} isTop={false} />)}
               </div>
            ) : regularItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-stone-200">
                 <Search size={64} className="text-stone-300 mx-auto mb-4" strokeWidth={1.5} />
                 <p className="text-sm font-black text-stone-900 uppercase tracking-widest">Nessun risultato</p>
                 <p className="text-[10px] font-bold text-stone-500 uppercase mt-2">Prova ad allargare i filtri di ricerca o la fascia di prezzo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                {regularItems.slice(0, visibleCount).map(item => (
                  <div key={item.id} className={`group bg-white rounded-3xl overflow-hidden shadow-sm border ${item.is_sponsored ? 'border-orange-400' : 'border-stone-200'} hover:bg-stone-50 transition-all flex flex-col relative`}>
                    {item.is_sponsored && (
                      <div className="absolute top-0 left-0 bg-orange-500 text-white text-[7px] font-black uppercase px-2 py-1 rounded-br-xl z-40 tracking-widest shadow-sm">
                        TOP 🌟
                      </div>
                    )}
                    <Link href={`/announcement/${item.id}`} className="aspect-square bg-stone-100 relative block overflow-hidden">
                      <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-2 right-2 z-30 bg-white w-8 h-8 flex items-center justify-center rounded-full shadow-sm hover:scale-110 transition-all">
                        <Heart size={16} className={favorites.includes(item.id) ? "fill-rose-500 text-rose-500" : "text-stone-400"} />
                      </button>
                      <img src={item.image_url || "/usato.png"} className="w-full h-full object-contain" alt={item.title} />
                    </Link>
                    <div className="p-3 flex flex-col justify-between flex-grow">
                      <div>
                        <h4 className="text-[10px] font-black uppercase line-clamp-2 text-stone-800 leading-tight mb-1">{item.title}</h4>
                        <p className="text-[14px] font-black text-rose-600 italic">
                          {item.condition === 'Regalo' || item.condition === 'Baratto' ? '€ 0' : `€ ${item.price}`}
                        </p>
                      </div>
                      <Link href={`/announcement/${item.id}`} className="mt-3 block text-center w-full bg-stone-900 text-white text-[9px] font-black uppercase py-2 rounded-xl hover:bg-rose-600 transition-all">
                        {item.condition === 'Baratto' ? 'Baratta' : item.condition === 'Regalo' ? 'Ricevi' : 'Acquista'}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && regularItems.length > visibleCount && (
              <div className="mt-12 flex justify-center w-full">
                <button 
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="bg-stone-900 text-white px-10 py-4 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-md"
                >
                  ↓ Carica Altri ({regularItems.length - visibleCount})
                </button>
              </div>
            )}
          </section>

        </main>

        {/* SIDEBAR BANNER DESTRA (PARTNER) - ORA FLUIDA E ORDINATA */}
        <aside className="flex flex-col gap-6 w-full lg:w-[280px] xl:w-[320px] shrink-0 self-start lg:sticky lg:top-24 order-3 mt-8 lg:mt-0">
          <div className="bg-white border border-stone-200 rounded-[2rem] p-5 shadow-md flex flex-col items-center text-center justify-between min-h-[560px] w-full">
            <div className="w-full h-full flex flex-col">
              <span className="bg-stone-100 text-stone-500 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4 inline-block self-center">Partner</span>
              <div className="w-full flex-1 bg-stone-100 rounded-2xl border border-stone-200 flex items-center justify-center mb-4 overflow-hidden relative min-h-[360px]">
                <img 
                  src="/adv-rete-partner.png" 
                  alt="Rete di Partner Sostenibili Re-love" 
                  className="w-full h-full object-contain p-2 absolute inset-0"
                />
              </div>
              <h3 className="text-base font-black uppercase text-stone-900 tracking-tight leading-tight mt-2">Rete di Partner Sostenibili</h3>
              <p className="text-xs text-stone-500 mt-1 font-medium">dome0082@gmail.com</p>
            </div>
            
            <a 
              href="mailto:dome0082@gmail.com?subject=Richiesta%20Banner%20Re-love" 
              className="relative z-[100] pointer-events-auto block w-full mt-4 bg-stone-950 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 transition-colors text-center shadow-sm cursor-pointer"
              onClick={(e) => { e.stopPropagation(); }}
            >
              <span className="flex items-center justify-center gap-2">
                <Mail size={12} />
                Invia Email
              </span>
            </a>
          </div>

          <div className="bg-stone-100 border border-stone-200 rounded-[2rem] p-5 shadow-sm text-center">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Eco-Friendly</h4>
            <p className="text-xs font-bold text-stone-800 leading-snug">Ogni acquisto riduce le emissioni di CO₂.</p>
          </div>
        </aside>

      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Caricamento Vetrina...</div>}>
      <HomePageContent />
    </Suspense>
  )
}