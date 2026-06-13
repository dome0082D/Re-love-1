'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Mic, MicOff, Search, MapPin, Heart, Crown, Mail, Plus, Send, Trash2, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'
import GalacticOutpost from './components/minigame/GalacticOutpost'

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

  // STATI PER LA MODALITÀ LABORATORI E CORSI 🛠️
  const [courses, setCourses] = useState([
    { id: '1', title: 'Riparazione Oggetti & Elettronica 🛠️', category: 'Riuso', creator: 'dome0082@gmail.com', members: 14 },
    { id: '2', title: 'Corsi di Cucina Antispreco 🍳', category: 'Cucina', creator: 'luca@relove.it', members: 9 },
  ])
  
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [newCourseCategory, setNewCourseCategory] = useState('Riuso')
  
  // --- NUOVI STATI PER IL MODALE COMPLETO DI CREAZIONE CORSO ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [courseForm, setCourseForm] = useState({
    title: '',
    category: 'Riuso',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    price: '',
    imageUrl: ''
  })

  // --- STATI PER LA CHAT GLOBALE IN TEMPO REALE 💬 ---
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [newChatMessage, setNewChatMessage] = useState('')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editMsgContent, setEditMsgContent] = useState('')
  const chatContainerRef = useRef<HTMLDivElement>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const catFilter = searchParams.get('cat')
  const typeFilter = searchParams.get('type')
  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { 
    fetchInitialData() 

    // Avvia l'ascolto per i messaggi chat in tempo reale
    fetchChatMessages()
    const chatChannel = supabase.channel('public:global_chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'global_chat' }, () => {
        fetchChatMessages()
      })
      .subscribe()
      
    return () => { supabase.removeChannel(chatChannel) }
  }, [])

  // Auto-scroll della chat verso il basso
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages])

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

  // --- LOGICA GESTIONE CHAT GLOBALE 💬 ---
  async function fetchChatMessages() {
    const { data, error } = await supabase
      .from('global_chat')
      .select('*')
      .order('created_at', { ascending: true }) // Ordine cronologico
      .limit(100)
    
    if (!error && data) {
      setChatMessages(data)
    }
  }

  const containsPhoneNumber = (text: string) => {
    // Blocca se ci sono 9 o più cifre consecutive
    const digitsOnly = text.replace(/\D/g, '')
    return digitsOnly.length >= 9
  }

  const handleSendChat = async () => {
    if (!user) return toast.error("Devi accedere per scrivere in chat! 🔑")
    if (!newChatMessage.trim()) return

    if (containsPhoneNumber(newChatMessage)) {
      return toast.error("⚠️ Non è consentito inviare numeri di telefono in chat pubblica!")
    }

    const content = newChatMessage
    setNewChatMessage('') 

    const { error } = await supabase.from('global_chat').insert([{
      user_id: user.id,
      user_email: user.email,
      content: content
    }])

    if (error) toast.error("Errore nell'invio del messaggio.")
  }

  const handleDeleteChat = async (id: string, msgUserId: string) => {
    if (IS_STAFF || user?.id === msgUserId) {
      await supabase.from('global_chat').delete().eq('id', id)
      toast.success("Messaggio eliminato.")
    } else {
      toast.error("Non hai i permessi per cancellare questo messaggio.")
    }
  }

  const handleUpdateChat = async (id: string) => {
    if (containsPhoneNumber(editMsgContent)) {
      return toast.error("⚠️ Non è consentito inserire numeri di telefono!")
    }
    await supabase.from('global_chat').update({ content: editMsgContent }).eq('id', id)
    setEditingMsgId(null)
    toast.success("Messaggio modificato.")
  }

  // --- LOGICA GESTIONE CORSI E LABORATORI ---
  const handleCreateCourse = () => {
    if (!user) {
      toast.error("Devi accedere per creare un corso! 🔑")
      return
    }
    
    const titleToUse = courseForm.title || newCourseTitle;
    
    if (!titleToUse.trim()) {
      toast.error("Inserisci un titolo valido per il laboratorio!")
      return
    }
    
    const newCourse = {
      id: Math.random().toString(),
      title: titleToUse,
      category: courseForm.category || newCourseCategory,
      creator: user.email || '',
      members: 1
    }
    
    setCourses([newCourse, ...courses])
    
    setNewCourseTitle('')
    setShowCreateForm(false)
    setCourseForm({ title: '', category: 'Riuso', description: '', date: '', startTime: '', endTime: '', location: '', price: '', imageUrl: '' })
    setIsCreateModalOpen(false)
    
    toast.success("Nuovo laboratorio creato con successo! 🎉")
  }

  const handleJoinCourse = (id: string) => {
    setCourses(courses.map(c => c.id === id ? { ...c, members: c.members + 1 } : c))
    toast.success("Iscrizione avvenuta! L'ingresso è libero 🤝")
  }

  const handleDeleteCourse = (id: string) => {
    setCourses(courses.filter(c => c.id !== id))
    toast.success("Laboratorio rimosso con successo.")
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
        
        {/* SIDEBAR BANNER SINISTRA (SPONSOR) */}
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

        {/* CONTENUTO CENTRALE - ORDINE AGGIORNATO E PERFETTAMENTE ADATTATO */}
        <main className="flex-1 w-full overflow-hidden order-1 lg:order-2">
          
          {/* 1. RIQUADRO VIDEO (Centrato, Allargato a tutto spazio, Altezza ridotta a 320px) */}
          <div className="w-full max-w-[1300px] mx-auto mt-8 mb-8 px-2">
            <div className="w-full rounded-[2rem] overflow-hidden border border-stone-200 shadow-md bg-white flex items-center justify-center h-[320px]">
              <video 
                src="/hero-video.mp4" 
                className="w-full h-full object-cover block"
                autoPlay 
                muted 
                loop 
                playsInline
              />
            </div>
          </div>

          {/* 2. GRIGLIA GEMELLA: LABORATORI & CORSI + CHAT DI COMUNITÀ */}
          {/* Allineati di fianco su schermi grandi, stessa altezza, centrati nel layout */}
          <div className="w-full max-w-[1300px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-6 mb-12 px-2">
            
            {/* BOX LABORATORI & CORSI (Altezza maggiorata a 400px) */}
            <div className="w-full h-full rounded-[2rem] border border-stone-200 shadow-md bg-[#f5efdf] p-6 flex flex-col justify-between min-h-[400px] text-stone-900 relative">
              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-600 block">Community</span>
                    <Link href="/laboratori" className="text-base font-black uppercase tracking-tight hover:text-rose-600 transition-colors">Laboratori & Corsi</Link>
                  </div>
                  <div className="flex gap-2">
                    <Link 
                      href="/laboratori"
                      className="bg-white text-stone-900 border border-stone-200 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:bg-stone-100 transition-all flex items-center gap-1 shadow-sm"
                    >
                      Bacheca
                    </Link>
                    <Link 
                      href="/laboratori/agenda"
                      className="bg-stone-100 text-stone-900 border border-stone-300 text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:bg-stone-200 transition-all flex items-center gap-1 shadow-sm"
                    >
                      Agenda
                    </Link>
                    <button 
                      onClick={() => {
                        if (!user) {
                          toast.error("Devi accedere per creare un corso! 🔑")
                        } else {
                          setIsCreateModalOpen(true)
                        }
                      }}
                      className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-xl hover:bg-rose-600 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Plus size={12} />
                      Crea
                    </button>
                  </div>
                </div>

                {/* SCROLLABLE LIST DEI LABORATORI (Si allunga per riempire i 400px) */}
                <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[220px]">
                  {courses.map(course => {
                    const isFounder = user?.email === course.creator;
                    const canModify = IS_STAFF || isFounder;
                    return (
                      <div key={course.id} className="bg-white/80 p-3 rounded-xl border border-stone-200/60 flex items-center justify-between gap-2 shadow-sm group">
                        <Link href={`/laboratori/${course.id}`} className="overflow-hidden flex-1 cursor-pointer hover:opacity-75 transition-opacity">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-stone-900 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider">
                              {course.category}
                            </span>
                            <span className="text-[10px] font-bold text-stone-500 truncate">
                              da {isFounder ? 'te' : course.creator.split('@')[0]}
                            </span>
                          </div>
                          <h4 className="text-xs font-black uppercase text-stone-900 truncate mt-1 group-hover:text-rose-600 transition-colors">{course.title}</h4>
                          <p className="text-[9px] font-bold text-stone-500 uppercase mt-0.5">👥 {course.members} partecipanti</p>
                        </Link>
                        <div className="flex gap-1 shrink-0">
                          <button 
                            onClick={() => handleJoinCourse(course.id)}
                            className="bg-stone-900 text-white text-[9px] font-black uppercase px-2.5 py-1.5 rounded-lg hover:bg-rose-600 transition-all"
                          >
                            Partecipa
                          </button>
                          {canModify && (
                            <button 
                              onClick={() => handleDeleteCourse(course.id)}
                              className="bg-red-100 text-red-600 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                              title="Rimuovi Corso"
                            >
                              X
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* FOOTER DEL RIQUADRO CON PULSANTE "TUTTI I CORSI" */}
              <div className="flex justify-between items-center mt-3 border-t border-stone-300/50 pt-3 shrink-0">
                <div className="text-[9px] font-bold text-stone-500 uppercase tracking-wide flex items-center gap-2">
                  <span>Ingresso Libero 🤝</span>
                  {IS_STAFF && <span className="text-rose-600 font-black">Staff 👑</span>}
                </div>
                <Link 
                  href="/laboratori" 
                  className="bg-stone-900 text-white text-[9px] font-black uppercase px-3 py-1.5 rounded-lg hover:bg-rose-600 transition-colors shadow-sm font-bold tracking-wider"
                >
                  Tutti i Corsi →
                </Link>
              </div>
            </div>

            {/* BOX CHAT DI GRUPPO REATTIVA (Gemella, 400px min-h) */}
            <div className="w-full h-full rounded-[2rem] shadow-md flex flex-col overflow-hidden relative border border-stone-200 bg-white min-h-[400px]">
              
              {/* Header Chat */}
              <div className="bg-[#f5efdf] px-4 py-3 border-b border-stone-200 flex justify-between items-center shrink-0">
                <span className="text-[11px] font-black uppercase tracking-widest text-stone-900 flex items-center gap-2">
                  Community Chat <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>
                </span>
                <span className="text-[8px] font-bold text-stone-500 uppercase">Live</span>
              </div>

              {/* Messaggi Chat */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 custom-scrollbar bg-stone-50/50 h-[220px]">
                {chatMessages.length === 0 ? (
                  <p className="text-center text-[10px] font-bold text-stone-400 uppercase mt-auto mb-auto">Nessun messaggio. Scrivi per primo!</p>
                ) : (
                  chatMessages.map(msg => {
                    const isMine = user?.id === msg.user_id;
                    const canModify = isMine || IS_STAFF;
                    const isEditingThis = editingMsgId === msg.id;

                    return (
                      <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                        {!isMine && (
                          <span className="text-[8px] font-black uppercase text-stone-400 mb-0.5 ml-1">
                            {msg.user_email.split('@')[0]}
                          </span>
                        )}
                        
                        <div className={`px-3 py-2 rounded-2xl shadow-sm text-sm relative group ${isMine ? 'bg-rose-600 text-white rounded-br-sm' : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'}`}>
                          
                          {/* Gestione Modifica Inline */}
                          {isEditingThis ? (
                            <div className="flex gap-2 items-center">
                              <input 
                                type="text" 
                                value={editMsgContent} 
                                onChange={e => setEditMsgContent(e.target.value)} 
                                className={`text-[11px] p-1.5 rounded-lg outline-none w-full min-w-[150px] font-medium ${isMine ? 'bg-rose-700 text-white placeholder-rose-300 border-none' : 'bg-stone-50 border border-stone-300'}`}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdateChat(msg.id)}
                              />
                              <button onClick={() => handleUpdateChat(msg.id)} className="shrink-0"><Send size={14} /></button>
                              <button onClick={() => setEditingMsgId(null)} className="shrink-0"><X size={14} /></button>
                            </div>
                          ) : (
                            <p className="leading-snug break-words pr-2 font-medium">{msg.content}</p>
                          )}

                          {/* Azioni del messaggio (Modifica/Elimina) */}
                          {canModify && !isEditingThis && (
                            <div className={`absolute top-1/2 -translate-y-1/2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1.5 rounded-lg shadow-sm border border-stone-200 ${isMine ? 'right-full mr-2' : 'left-full ml-2'}`}>
                              {isMine && (
                                <button onClick={() => { setEditingMsgId(msg.id); setEditMsgContent(msg.content); }} className="text-stone-400 hover:text-stone-900 transition-colors">
                                  <Edit2 size={14} />
                                </button>
                              )}
                              <button onClick={() => handleDeleteChat(msg.id, msg.user_id)} className="text-stone-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Input Chat Fissa In Basso */}
              <div className="p-3 bg-white border-t border-stone-100 shrink-0 mt-auto">
                {user ? (
                  <div className="flex gap-2 items-center bg-stone-50 border border-stone-200 rounded-xl px-2 py-1.5 focus-within:border-rose-300 focus-within:ring-2 focus-within:ring-rose-50 transition-all">
                    <input 
                      type="text" 
                      placeholder="Scrivi un messaggio alla community..." 
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                      className="flex-1 bg-transparent border-none outline-none text-xs font-bold text-stone-900 p-2"
                    />
                    <button 
                      onClick={handleSendChat}
                      disabled={!newChatMessage.trim()}
                      className="bg-stone-900 text-white w-9 h-9 rounded-lg flex items-center justify-center hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:hover:bg-stone-900 shrink-0"
                    >
                      <Send size={16} className="ml-0.5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-3">
                    <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Devi accedere per partecipare</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. FILTRI CON COLORI SOLIDI E PIATTI */}
          <section className="mb-12 max-w-[1300px] mx-auto px-2">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-md border border-stone-200 flex flex-col gap-8">
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
            </div>
          </section>

          {/* 4. I QUATTRO RIQUADRI CENTRALI DELLA VENDITA */}
          {!catFilter && !typeFilter && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-16 max-w-[1300px] mx-auto px-2">
              
              {/* TOOLTIP: VENDI NUOVO */}
              <Tooltip text="Metti in vendita un oggetto mai usato ✨" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=new" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-[#f5efdf] hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/nuovo.png" className="w-full h-full object-cover" alt="Nuovo" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Vendi Nuovo</span>
                   </div>
                </Link>
              </Tooltip>
              
              {/* TOOLTIP: VENDI USATO */}
              <Tooltip text="Dai una seconda vita ai tuoi oggetti ♻️" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=used" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-[#f5efdf] hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/usato.png" className="w-full h-full object-cover" alt="Usato" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Vendi Usato</span>
                   </div>
                </Link>
              </Tooltip>
              
              {/* TOOLTIP: REGALO */}
              <Tooltip text="Regala o trova oggetti gratis in regalo 🎁" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=gift" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-[#f5efdf] hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/regalo.png" className="w-full h-full object-cover" alt="Regalo" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Regalo</span>
                   </div>
                </Link>
              </Tooltip>

              {/* TOOLTIP: BARATTO */}
              <Tooltip text="Scambia i tuoi oggetti senza usare soldi 🤝" wrapperClass="relative w-full h-full">
                <Link href="/add?mode=barter" className="w-full h-full flex flex-col items-center justify-center rounded-[2rem] border border-stone-200 overflow-hidden bg-[#f5efdf] hover:bg-stone-100 transition-all shadow-md text-center aspect-square relative mx-auto">
                   <div className="absolute inset-0 w-full h-full overflow-hidden">
                     <img src="/baratto.png" className="w-full h-full object-cover" alt="Baratto" />
                   </div>
                   <div className="absolute bottom-3 z-10 w-full px-2">
                     <span className="inline-block bg-stone-950 text-white text-[11px] font-black uppercase tracking-wide px-3 py-1 rounded-xl shadow-md">Baratto</span>
                   </div>
                </Link>
              </Tooltip>
            </div>
          )}

          {/* 5. SEZIONE VETRINA TOP */}
          <section className="mb-20 max-w-[1300px] mx-auto px-2">
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

          {/* 6. TUTTI GLI ANNUNCI */}
          <section className="mb-20 max-w-[1300px] mx-auto px-2">
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
                  Carica Altri ({regularItems.length - visibleCount})
                </button>
              </div>
            )}
          </section>

          {/* 7. GIOCO GALACTIC OUTPOST IN FONDO - FORMATO 20x10 cm (800x400 PX) INVARIATO */}
          <div className="w-full max-w-[800px] mx-auto mt-12 mb-10 rounded-[2rem] overflow-hidden shadow-sm bg-[#020205] relative h-[400px] flex">
            <GalacticOutpost />
          </div>

        </main>

        {/* SIDEBAR BANNER DESTRA (PARTNER) */}
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
            <p className="text-xs font-bold text-stone-800 leading-snug">Ogni acquisto ruduce le emissioni di CO₂.</p>
          </div>
        </aside>

      </div>

      {/* --- MODALE CREAZIONE CORSO COMPLETO (MOBILE-FRIENDLY, 3 SEZIONI) --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[999] bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-stone-200">
            
            {/* HEADER FISSO */}
            <div className="px-5 py-4 border-b border-stone-100 shrink-0 bg-white flex justify-between items-center z-10">
              <h2 className="text-lg md:text-2xl font-black uppercase tracking-tight text-stone-900">Crea Nuovo Corso</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-stone-400 hover:text-stone-900 transition-colors p-1">
                <span className="font-black text-xl leading-none">✕</span>
              </button>
            </div>

            {/* CORPO CENTRALE SCROLLABILE */}
            <div className="p-5 overflow-y-auto flex-1 bg-stone-50/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Titolo del Corso</label>
                  <input type="text" value={courseForm.title} onChange={(e) => setCourseForm({...courseForm, title: e.target.value})} placeholder="Es. Riparazione Bici Elettriche" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Descrizione Completa</label>
                  <textarea value={courseForm.description} onChange={(e) => setCourseForm({...courseForm, description: e.target.value})} rows={3} placeholder="Cosa impareremo in questo corso? Cosa serve portare?" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-medium resize-none text-stone-900 shadow-sm" />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Categoria</label>
                  <select value={courseForm.category} onChange={(e) => setCourseForm({...courseForm, category: e.target.value})} className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-[11px] font-black uppercase text-stone-900 shadow-sm">
                    <option value="Riuso">🛠️ Riuso / Riparazione</option>
                    <option value="Cucina">🍳 Cucina Sostenibile</option>
                    <option value="Fai da te">🎨 Fai da Te</option>
                    <option value="Altro">📦 Altro</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Prezzo (€)</label>
                  <input type="number" value={courseForm.price} onChange={(e) => setCourseForm({...courseForm, price: e.target.value})} placeholder="0 per Gratuito" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Luogo / Indirizzo / Zona</label>
                  <input type="text" value={courseForm.location} onChange={(e) => setCourseForm({...courseForm, location: e.target.value})} placeholder="Es. Cortile Gemme, Via delle Rose" className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                </div>

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Data</label>
                    <input type="date" value={courseForm.date} onChange={(e) => setCourseForm({...courseForm, date: e.target.value})} className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Ora Inizio</label>
                      <input type="time" value={courseForm.startTime} onChange={(e) => setCourseForm({...courseForm, startTime: e.target.value})} className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Ora Fine</label>
                      <input type="time" value={courseForm.endTime} onChange={(e) => setCourseForm({...courseForm, endTime: e.target.value})} className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pb-2">
                  <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Immagine (URL o link)</label>
                  <input type="text" value={courseForm.imageUrl} onChange={(e) => setCourseForm({...courseForm, imageUrl: e.target.value})} placeholder="https://..." className="w-full p-3 bg-white border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold text-stone-900 shadow-sm" />
                </div>
              </div>
            </div>

            {/* FOOTER FISSO */}
            <div className="px-5 py-4 border-t border-stone-100 shrink-0 bg-white z-10 flex gap-2 md:gap-3">
              <button onClick={() => setIsCreateModalOpen(false)} className="flex-1 p-3 md:p-4 rounded-xl bg-stone-100 text-stone-600 text-[11px] font-black uppercase tracking-widest hover:bg-stone-200 transition-colors">Annulla</button>
              <button onClick={handleCreateCourse} className="flex-1 p-3 md:p-4 rounded-xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-stone-900 transition-colors shadow-md">Pubblica Corso</button>
            </div>

          </div>
        </div>
      )}

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