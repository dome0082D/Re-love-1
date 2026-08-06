'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'
import { 
  Menu, Sun, Moon, ShieldCheck, Sparkles, Radar, Plus, Bell, 
  MoreVertical, ShoppingCart, Settings, TrendingUp, HelpCircle, 
  LogOut, Trash2, X, Inbox, User as UserIcon, FileText, Package, 
  MessageCircle, Heart, MapPin, Handshake, Truck 
} from 'lucide-react'

// CARICAMENTO MAPPA: PUNTA AL FILE Mappa.tsx
const Mappa = dynamic(() => import('./Mappa'), { 
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-stone-100 flex flex-col items-center justify-center p-4">
      <div className="w-14 h-14 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-xs font-black uppercase text-stone-400 tracking-widest text-center">Aggancio Satellitare Mappa Italia in corso...</p>
    </div>
  )
})

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false) 
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // STATI NOTIFICHE
  const [notifications, setNotifications] = useState(0) // Contatore pallino rosso
  const [notifList, setNotifList] = useState<any[]>([]) // Lista dei messaggi reali

  // STATI PER I NUOVI STRUMENTI E LA MAPPA
  const [darkMode, setDarkMode] = useState(false)
  const [showSecurityModal, setShowSecurityModal] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [showMapModal, setShowMapModal] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [aiItemName, setAiItemName] = useState('')
  const [aiResult, setAiResult] = useState<string | null>(null)
  
  // STATI PER IL RADAR
  const [isRadarScanning, setIsRadarScanning] = useState(false)
  const radarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  const router = useRouter()
  const { items, isCartOpen, openCart, closeCart, removeItem, updateQuantity } = useCartStore()
  const total = items.reduce((acc, i) => acc + (Number(i.price) * i.quantity), 0)

  // NOTA: la registrazione del service worker avviene ANCHE in layout.tsx.
  // Registrarlo due volte non causa danni (il browser riconosce lo stesso
  // file e non lo duplica), ma se un giorno vuoi fare pulizia, questa è la
  // copia ridondante da togliere - quella in layout.tsx è più affidabile
  // perché gira su tutte le pagine, non solo dove compare la Navbar.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW fallito:', err));
    }
  }, []);

  const triggerNativePush = (message: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      navigator.serviceWorker?.getRegistration().then(function(reg) {
        if (reg) {
          reg.showNotification('🔔 Re-love', { 
            body: message, 
            vibrate: [200, 100, 200], 
            icon: '/usato.png' 
          } as any);
        } else {
          // FIX ANDROID: su Chrome Android (e su Android in generale) il costruttore
          // `new Notification()` non è supportato ed è previsto che lanci un errore -
          // l'unico modo per mostrare notifiche è ServiceWorkerRegistration.showNotification(),
          // usato nel ramo sopra. Senza questo try/catch, ogni volta che il service worker
          // non risultava ancora pronto (es. primo avvio dell'app), qui si generava
          // un'eccezione non gestita su ogni telefono Android.
          try {
            new Notification('🔔 Re-love', { body: message });
          } catch {
            console.warn('Notifica nativa non disponibile su questo dispositivo.');
          }
        }
      }).catch(() => {
        try {
          new Notification('🔔 Re-love', { body: message });
        } catch {
          console.warn('Notifica nativa non disponibile su questo dispositivo.');
        }
      });
    }
  }

  // --- EFFETTO MODALITÀ NOTTE ---
  useEffect(() => {
    let styleEl = document.getElementById('dark-mode-hack') as HTMLStyleElement;
    if (darkMode) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dark-mode-hack';
        styleEl.innerHTML = `
          html { filter: invert(1) hue-rotate(180deg); background: #fff; transition: filter 0.5s ease; will-change: filter; }
          img, video, iframe, .leaflet-container, .site-fixed-background { filter: invert(1) hue-rotate(180deg); }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      if (styleEl) styleEl.remove();
    }
  }, [darkMode])

  useEffect(() => {
    let notificationHandler: ((e: Event) => void) | null = null;

    const getData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)
        
        try {
          const { data: cats } = await supabase.from('categories').select('*').order('name')
          if (cats) setCategories(cats)
        } catch (catErr) {}

        try {
          const { data: anns } = await supabase.from('announcements').select('*')
          if (anns) setAnnouncements(anns)
        } catch (annsErr) {}

        if (currentUser) {
          await fetchNotifications(currentUser.id)

          // Ascoltiamo l'evento inoltrato da RealtimeNotifications.tsx invece
          // di aprire una nostra sottoscrizione Supabase parallela agli
          // stessi identici INSERT (due connessioni WebSocket per lo stesso
          // evento significherebbero doppio consumo di banda e batteria).
          notificationHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            fetchNotifications(currentUser.id)
            if (detail?.message) triggerNativePush(detail.message)
          }
          window.addEventListener('relove:new-notification', notificationHandler)
        }
      } catch (mainErr) {}
    }
    
    getData()
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    
    return () => {
      if (notificationHandler) {
        window.removeEventListener('relove:new-notification', notificationHandler)
      }
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  const fetchNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setNotifList(data);
        setNotifications(data.filter(n => !n.is_read).length);
      }
    } catch (e) {}
  }

  const handleOpenNotifs = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    setIsNotifOpen(!isNotifOpen);
    setIsQuickMenuOpen(false);

    if (!isNotifOpen && notifications > 0 && user) {
      // FIX: l'esito di questo aggiornamento non veniva controllato - se
      // falliva (regole del database, rete instabile), il pallino rosso
      // spariva comunque dallo schermo ma le notifiche restavano "non
      // lette" nel database: riaprendo la pagina il pallino sarebbe
      // ricomparso, dando l'impressione di notifiche che tornano da sole.
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Errore aggiornamento notifiche lette:', error)
        return
      }

      setNotifications(0);
      setNotifList(prev => prev.map(n => ({...n, is_read: true})));
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    const firstConfirm = window.confirm("⚠️ ATTENZIONE: Sei sicuro di voler cancellare il tuo profilo? Questa azione eliminerà i tuoi dati. Non potrai tornare indietro.");
    if (firstConfirm) {
      const secondConfirm = window.confirm("Sei PROPRIO sicuro? Dovrai registrarti di nuovo se vorrai tornare su Re-love.");
      if (secondConfirm && user) {
        setLoading(true);
        try {
          const { error } = await supabase.from('profiles').delete().eq('id', user.id);
          if (error) throw error;
          await supabase.auth.signOut();
          alert("Profilo eliminato con successo. Ci dispiace vederti andare via! 🌹");
          window.location.href = '/';
        } catch (err: any) {
          alert("Errore durante l'eliminazione: " + err.message);
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleCheckout = async () => {
    if (!user) { alert("Devi accedere o registrarti per completare l'acquisto"); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items, buyerId: user.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; 
      } else {
        alert("Errore Checkout Stripe.");
        setLoading(false);
      }
    } catch (err) {
      alert("Errore di connessione.");
      setLoading(false);
    }
  };

  const handleRadar = () => {
    // Evita di accumulare più timer se l'utente tocca "Radar" più volte di fila
    // (facile su touchscreen Android con tap ravvicinati)
    if (radarTimeoutRef.current) {
      clearTimeout(radarTimeoutRef.current)
    }

    setIsSidebarOpen(false);
    setIsRadarScanning(true);
    
    radarTimeoutRef.current = setTimeout(() => {
      setIsRadarScanning(false);
      setShowMapModal(true);
      radarTimeoutRef.current = null
    }, 3000);
  }

  // Ferma il timer del radar se il componente si smonta prima che scada
  useEffect(() => {
    return () => {
      if (radarTimeoutRef.current) clearTimeout(radarTimeoutRef.current)
    }
  }, [])

  const handleAiValuation = () => {
    if (!aiItemName) return;
    setLoading(true);
    setTimeout(() => {
      const randomPrice = Math.floor(Math.random() * 50) + 10;
      setAiResult(`Basato sull'attuale mercato dell'usato, un "${aiItemName}" potrebbe valere circa €${randomPrice}.00.`);
      setLoading(false);
    }, 1500);
  }

  return (
    <>
      {/* FIX: sfondo bianco pieno forzato tramite "style". Quando abbiamo reso
          semi-trasparenti tutti i riquadri per far vedere l'immagine di sfondo
          del sito, la regola globale ha preso ANCHE questa barra, che infatti
          risultava trasparente e lasciava intravedere il cielo
          dell'illustrazione dietro le icone. Lo "style" ha la precedenza sulla
          regola globale, quindi qui torna bianca piena come deve essere. */}
      <nav
        style={{ backgroundColor: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
        className="border-b border-rose-100 sticky top-0 z-[5000] shadow-sm flex justify-between items-center h-20 md:h-24 px-4 md:px-8 transition-colors"
      >
        <div className="flex items-center gap-4 md:gap-6">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-stone-600 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all focus:outline-none">
            <Menu size={28} strokeWidth={2.5} />
          </button>
          
          <Link 
            href="/" 
            className="text-4xl md:text-5xl text-rose-500 select-none bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-400"
            style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 700 }}
          >
            Re-love
          </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          
          <div className="hidden lg:flex items-center gap-2 border-r border-stone-200 pr-5 mr-3 text-stone-500">
            <button onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Modalità Chiara" : "Modalità Notte"} className="p-3 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
              {darkMode ? <Sun size={24} strokeWidth={2} /> : <Moon size={24} strokeWidth={2} />}
            </button>
            <button onClick={() => setShowSecurityModal(true)} title="Scudo Sicurezza" className="p-3 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
              <ShieldCheck size={24} strokeWidth={2} />
            </button>
            <button onClick={() => setShowAiModal(true)} title="Valutatore Magico" className="p-3 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
              <Sparkles size={24} strokeWidth={2} />
            </button>
            <button onClick={handleRadar} title="Radar Italia" className="p-3 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
              <Radar size={24} strokeWidth={2} />
            </button>
          </div>

          {!user && (
            <Link href="/login" className="hidden lg:block text-stone-600 font-bold uppercase text-xs md:text-sm tracking-widest hover:text-rose-500 transition-colors px-3">
              Accedi
            </Link>
          )}

          <Link href="/add" className="hidden lg:flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-400 text-white px-5 py-3 rounded-xl font-bold uppercase text-xs md:text-sm tracking-widest hover:shadow-lg hover:scale-105 transition-all shadow-md">
            <Plus size={18} strokeWidth={3} /> Vendi
          </Link>

          <div className="relative">
            <button 
              onClick={handleOpenNotifs} 
              className="relative p-3 text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"
            >
              <Bell size={28} strokeWidth={2} />
              {notifications > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {notifications}
                </span>
              )}
            </button>
            
            {/* FIX (POPUP TAGLIATO): questo pannello è largo 320px e si
                allineava al bordo destro della CAMPANELLA - che però non è
                l'ultima icona della fila (dopo ci sono i tre puntini e il
                carrello). Il pannello si estendeva quindi verso sinistra
                uscendo dallo schermo, e su telefono la prima lettera di ogni
                riga finiva tagliata fuori ("essuna" invece di "Nessuna").
                Ora su telefono si ancora ai due bordi dello schermo, quindi
                non può più uscire; da tablet in su resta esattamente com'era. */}
            {isNotifOpen && (
              <div className="fixed left-4 right-4 top-24 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80 bg-white border border-stone-200 rounded-3xl shadow-2xl p-5 z-[6000]">
                <div className="flex justify-between items-center border-b border-stone-100 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-stone-400">Notifiche</h4>
                  <button onClick={() => setIsNotifOpen(false)} className="text-stone-400 hover:text-stone-800 text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-50">
                    <X size={18} strokeWidth={2.5} />
                  </button>
                </div>
                
                {notifList.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center text-stone-300">
                    <Inbox size={48} strokeWidth={1.5} className="mb-4" />
                    <p className="text-sm text-stone-500 font-bold uppercase tracking-widest">Tutto tace</p>
                    <p className="text-xs text-stone-400 font-medium mt-2">Nessuna nuova notifica.</p>
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {notifList.map(n => (
                      <div key={n.id} className={`p-4 rounded-2xl border text-sm transition-all ${n.is_read ? 'bg-stone-50 border-stone-100 text-stone-500' : 'bg-rose-50 border-rose-200 text-stone-900 font-bold shadow-sm'}`}>
                        {n.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative">
            <button onClick={() => {
              setIsQuickMenuOpen(!isQuickMenuOpen);
              setIsNotifOpen(false);
            }} className="p-3 text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all">
              <MoreVertical size={28} strokeWidth={2} />
            </button>
            {/* Stessa correzione del pannello notifiche: su telefono si ancora
                ai bordi dello schermo invece di poterne uscire. */}
            {isQuickMenuOpen && (
              <div className="fixed left-auto right-4 top-24 w-56 sm:absolute sm:right-0 sm:top-auto sm:mt-3 bg-white border border-stone-100 shadow-2xl rounded-2xl p-3 z-[6000]">
                <Link href="/profile" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 p-4 text-base font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all">
                  <Settings size={18} /> Impostazioni
                </Link>
                {user && (
                  <Link href="/dashboard/analitiche" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 p-4 text-base font-bold text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all">
                    <TrendingUp size={18} /> Seller Hub
                  </Link>
                )}
                <Link href="/supporto" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 p-4 text-base font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all">
                  <HelpCircle size={18} /> Aiuto
                </Link>
                {user && (
                  <>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 text-left p-4 text-base font-medium text-stone-700 hover:bg-stone-50 rounded-xl transition-all">
                      <LogOut size={18} /> Esci
                    </button>
                    <div className="border-t border-stone-100 my-2"></div>
                    <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 text-left p-4 text-base font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <Trash2 size={18} /> Elimina Profilo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button onClick={openCart} className="relative p-3 hover:bg-rose-50 hover:text-rose-500 text-stone-500 rounded-full transition-all focus:outline-none">
            <ShoppingCart size={28} strokeWidth={2} />
            {items.length > 0 && (
              <span className="absolute top-1 right-0 bg-rose-500 text-white text-[11px] w-6 h-6 flex items-center justify-center rounded-full font-bold border-2 border-white shadow-md">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* OVERLAY SFONDO GLOBALE (Sidebar, Carrello, ecc) */}
      {(isSidebarOpen || isCartOpen || showSecurityModal || showAiModal || showMapModal) && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[9998] transition-opacity" 
             onClick={() => { setIsSidebarOpen(false); closeCart(); setIsQuickMenuOpen(false); setIsNotifOpen(false); setShowSecurityModal(false); setShowAiModal(false); setShowMapModal(false); }} />
      )}

      {/* OVERLAY INVISIBILE PER CHIUDERE I MENU A TENDINA (🔔 e ⋮) */}
      {(isQuickMenuOpen || isNotifOpen) && (
        <div 
          className="fixed inset-0 z-[5500]" 
          onClick={() => { setIsQuickMenuOpen(false); setIsNotifOpen(false); }} 
        />
      )}

      {/* -------------------- SIDEBAR (MENU ☰) -------------------- */}
      <div className={`fixed top-0 left-0 h-dvh w-[95%] max-w-[380px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 bg-gradient-to-br from-rose-500 to-orange-500 text-white relative">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors">
              <X size={32} strokeWidth={2.5} />
            </button>
            <div className="w-16 h-16 bg-white text-rose-500 rounded-2xl flex items-center justify-center text-3xl font-bold italic shadow-lg mb-5">
              {user?.email ? user.email[0].toUpperCase() : 'R'}
            </div>
            <p className="text-4xl mb-1 text-white" style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}>Re-love</p>
            <p className="font-medium truncate text-sm tracking-wider uppercase opacity-90">{user?.email || 'Visitatore'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
              <h3 className="text-sm font-bold uppercase text-stone-400 mb-5 tracking-[0.2em] border-b pb-3 border-stone-100">Area Riservata</h3>
              <div className="grid gap-2">
                <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="flex justify-center items-center gap-2 w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white text-center py-4 rounded-xl font-bold uppercase text-sm tracking-widest shadow-md lg:hidden mb-3">
                  <Plus size={20} strokeWidth={3} /> Vendi o Regala
                </Link>
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <UserIcon size={20} className="text-stone-500" /> Profilo
                    </Link>
                    <Link href="/dashboard/analitiche" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <div className="flex items-center gap-4"><TrendingUp size={20} className="text-stone-500" /> Seller Hub</div> 
                      <span className="bg-orange-100 text-orange-600 text-[11px] px-3 py-1 rounded-full font-bold">PRO</span>
                    </Link>
                    <Link href="/dashboard/annunci" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <FileText size={20} className="text-stone-500" /> Gestione Annunci
                    </Link>
                    <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <div className="flex items-center gap-4"><Package size={20} className="text-stone-500" /> Ordini e Resi</div> 
                      <span className="bg-rose-500 text-white text-[11px] px-3 py-1 rounded-full font-bold">SECURE</span>
                    </Link>
                    <Link href="/chat" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <div className="flex items-center gap-4"><MessageCircle size={20} className="text-stone-500" /> Messaggi</div>
                    </Link>
                    <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <Heart size={20} className="text-stone-500" /> Preferiti
                    </Link>
                    <Link href="/supporto" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 text-base font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
                      <HelpCircle size={20} className="text-stone-500" /> Aiuto
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-4 w-full text-left p-4 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl mt-4 uppercase tracking-widest transition-all">
                      <LogOut size={20} strokeWidth={2.5} /> Esci
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsSidebarOpen(false)} className="w-full block text-center p-4 text-sm font-bold text-rose-500 border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 rounded-xl mt-3 uppercase tracking-widest transition-all">Accedi / Registrati</Link>
                )}
              </div>
            </section>

            <section className="lg:hidden">
              <h3 className="text-sm font-bold uppercase text-stone-400 mb-5 tracking-[0.2em] border-b pb-3 border-stone-100">Strumenti Re-love</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setDarkMode(!darkMode); setIsSidebarOpen(false); }} className="p-4 text-sm font-bold text-stone-600 bg-stone-50 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-colors flex flex-col items-center justify-center gap-3 shadow-sm border border-stone-100">
                  {darkMode ? <Sun size={32} strokeWidth={1.5} /> : <Moon size={32} strokeWidth={1.5} />}
                  {darkMode ? 'Chiaro' : 'Scuro'}
                </button>
                <button onClick={() => { setShowSecurityModal(true); setIsSidebarOpen(false); }} className="p-4 text-sm font-bold text-stone-600 bg-stone-50 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-colors flex flex-col items-center justify-center gap-3 shadow-sm border border-stone-100">
                  <ShieldCheck size={32} strokeWidth={1.5} />
                  Scudo
                </button>
                <button onClick={() => { setShowAiModal(true); setIsSidebarOpen(false); }} className="p-4 text-sm font-bold text-stone-600 bg-stone-50 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-colors flex flex-col items-center justify-center gap-3 shadow-sm border border-stone-100">
                  <Sparkles size={32} strokeWidth={1.5} />
                  Valuta
                </button>
                <button onClick={handleRadar} className="p-4 text-sm font-bold text-stone-600 bg-stone-50 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-colors flex flex-col items-center justify-center gap-3 shadow-sm border border-stone-100">
                  <Radar size={32} strokeWidth={1.5} />
                  Radar
                </button>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold uppercase text-stone-400 mb-5 tracking-[0.2em] border-b pb-3 border-stone-100">Categorie</h3>
              <div className="grid gap-2">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/?cat=${cat.slug}`} onClick={() => setIsSidebarOpen(false)} className="p-4 text-base font-medium text-stone-600 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all capitalize">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* -------------------- CARRELLO -------------------- */}
      <div className={`fixed top-0 right-0 h-dvh w-[95%] max-w-[420px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex justify-between items-center border-b border-stone-100 bg-stone-50">
          <h2 className="text-2xl font-bold uppercase italic tracking-tighter text-rose-500 flex items-center gap-3">
            <ShoppingCart size={28} strokeWidth={2.5} /> Carrello
          </h2>
          <button onClick={closeCart} className="text-stone-400 hover:text-stone-900 bg-white w-12 h-12 flex items-center justify-center rounded-full transition-all shadow-sm">
            <X size={24} strokeWidth={2} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {items.length === 0 ? (
            <div className="text-center py-24 opacity-40 flex flex-col items-center">
              <ShoppingCart size={80} strokeWidth={1} className="mb-6 text-stone-400" />
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-stone-500">Carrello vuoto</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-5 p-5 bg-white rounded-3xl border border-stone-200 group relative transition-all shadow-sm hover:shadow-md">
                <button onClick={() => removeItem(item.id)} className="absolute -top-3 -right-3 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-all z-10">
                  <X size={16} strokeWidth={3} />
                </button>
                <img src={(item as any).imageUrl || '/usato.png'} alt={item.title} className="w-24 h-24 object-cover rounded-2xl border border-stone-200" />
                <div className="flex-1 flex flex-col justify-between py-1">
                  <h3 className="font-bold text-base text-stone-800 line-clamp-2">{item.title}</h3>
                  <div className="flex justify-between items-center mt-3">
                    <p className="font-black text-rose-500 text-base">€ {(Number(item.price)).toFixed(2)}</p>
                    <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-1.5 border border-stone-100">
                      <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-stone-600 hover:text-rose-500 transition-all">-</button>
                      <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, Math.min((item as any).maxQuantity || 99, item.quantity + 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-stone-600 hover:text-emerald-500 transition-all">+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-white border-t border-stone-100">
            <div className="flex justify-between items-center mb-6">
              <span className="text-base font-bold uppercase tracking-widest text-stone-400">Totale</span>
              <span className="text-3xl font-black text-rose-600">€ {total.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} disabled={loading} className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl hover:scale-[1.02] transition-all disabled:opacity-50">
              {loading ? 'Attendi...' : 'Procedi al Checkout'}
            </button>
          </div>
        )}
      </div>

      {/* -------------------- MODALI -------------------- */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-lg w-full relative">
            <button onClick={() => setShowSecurityModal(false)} className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 transition-colors">
              <X size={28} strokeWidth={2.5} />
            </button>
            <div className="text-center mb-8 flex flex-col items-center">
              <ShieldCheck size={80} strokeWidth={1} className="text-blue-500 mb-4" />
              <h2 className="text-3xl font-black uppercase italic text-stone-900">Scudo Re-love</h2>
              <p className="text-sm uppercase font-bold text-stone-400 tracking-widest mt-2">Acquisti e Baratti Protetti</p>
            </div>
            <div className="space-y-5 text-base font-medium text-stone-600">
              <p className="flex items-start gap-4"><ShieldCheck className="text-blue-500 mt-1 flex-shrink-0" size={24} /> <span><b>Pagamenti Sicuri:</b> Usiamo Stripe. I fondi sono congelati finché non ricevi il pacco.</span></p>
              <p className="flex items-start gap-4"><Handshake className="text-rose-500 mt-1 flex-shrink-0" size={24} /> <span><b>Baratto Diretto:</b> Per barattare, usa la chat integrata per organizzarti in sicurezza.</span></p>
              <p className="flex items-start gap-4"><Truck className="text-emerald-500 mt-1 flex-shrink-0" size={24} /> <span><b>Tracciamento:</b> Tutti gli acquisti "Nuovo" e "Usato" sono rigorosamente tracciati.</span></p>
            </div>
            <button onClick={() => setShowSecurityModal(false)} className="w-full mt-10 bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-blue-700 transition-all shadow-md">Ho Capito</button>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-lg w-full relative">
            <button onClick={() => {setShowAiModal(false); setAiResult(null); setAiItemName('');}} className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 transition-colors">
              <X size={28} strokeWidth={2.5} />
            </button>
            <div className="text-center mb-8 flex flex-col items-center">
              <Sparkles size={80} strokeWidth={1} className="text-purple-500 mb-4" />
              <h2 className="text-3xl font-black uppercase italic text-stone-900">Valutatore Magico</h2>
              <p className="text-sm uppercase font-bold text-stone-400 tracking-widest mt-2">Scopri quanto vale il tuo oggetto</p>
            </div>
            <input 
              type="text" 
              placeholder="Cosa vendi? (es. PS4)" 
              value={aiItemName}
              onChange={(e) => setAiItemName(e.target.value)}
              className="w-full p-5 bg-stone-50 border border-stone-200 rounded-2xl mb-5 font-bold text-base outline-none focus:border-purple-400"
            />
            {aiResult && (
              <div className="bg-purple-50 p-5 rounded-2xl border border-purple-200 mb-5">
                <p className="text-sm font-bold text-purple-800 leading-relaxed">{aiResult}</p>
              </div>
            )}
            {/* NOTA: questa valutazione NON usa una vera intelligenza
                artificiale - genera un numero casuale tra 10 e 60 euro,
                indipendente da cosa scrivi. Se vuoi renderla reale, si può
                collegare alla stessa route che già usi per generare le
                descrizioni (/api/generate-description). */}
            <button onClick={handleAiValuation} disabled={loading || !aiItemName} className="w-full bg-purple-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-purple-700 transition-all disabled:opacity-50 shadow-md">
              {loading ? 'Elaborazione...' : 'Calcola Valore'}
            </button>
          </div>
        </div>
      )}

      {showMapModal && (
        <div className="fixed inset-0 z-[15000] bg-white flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-white shadow-sm z-10">
            <div className="flex items-center gap-3">
              <MapPin size={32} className="text-rose-500" strokeWidth={2.5} />
              <h2 className="text-2xl font-black uppercase italic text-rose-500 tracking-tighter">Mappa Re-love Italia</h2>
            </div>
            <button onClick={() => setShowMapModal(false)} className="flex items-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-xl font-black uppercase text-xs tracking-widest shadow-md hover:bg-rose-500 transition-colors">
              <X size={16} strokeWidth={3} /> Chiudi
            </button>
          </div>
          <div className="flex-1 relative z-0">
             <Mappa announcements={announcements} />
          </div>
        </div>
      )}

      {/* -------------------- ANIMAZIONE RADAR -------------------- */}
      {isRadarScanning && (
        <div className="fixed inset-0 z-[20000] bg-stone-900/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="text-center flex flex-col items-center">
            <div className="w-56 h-56 rounded-full border-4 border-emerald-500/20 flex items-center justify-center relative overflow-hidden mb-10 shadow-[0_0_100px_rgba(16,185,129,0.2)]">
              <div className="absolute inset-0 rounded-full border border-emerald-500/40 animate-ping" style={{ animationDuration: '2s' }}></div>
              <div className="absolute inset-4 rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: '2.5s' }}></div>
              <div className="w-[50%] h-1 bg-gradient-to-r from-transparent to-emerald-400 absolute top-1/2 left-1/2 origin-left animate-spin" style={{ animationDuration: '1.5s', transform: 'translateY(-50%)' }}></div>
              <Radar size={72} strokeWidth={1.5} className="text-emerald-400 relative z-10 animate-pulse" />
            </div>
            <h2 className="text-4xl font-black uppercase italic text-emerald-400 tracking-widest mb-4">Scansione in corso...</h2>
            <p className="text-stone-300 text-sm font-bold uppercase tracking-[0.4em] animate-pulse">Ricerca oggetti in Italia</p>
          </div>
        </div>
      )}
    </>
  )
}
