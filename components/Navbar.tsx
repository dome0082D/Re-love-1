'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'
import { segnaNotificheLette, eliminaNotifica, eliminaTutteLeNotifiche } from '@/lib/azioniUtente'
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

// Le stesse categorie usate nei filtri della Home, cioè i valori davvero
// scritti nella colonna "category" degli annunci. Servono da riserva quando
// la tabella "categories" non è leggibile (vedi il commento nel caricamento).
const CATEGORIE_DI_RISERVA = [
  { id: 'c1', name: 'Abbigliamento e Accessori' },
  { id: 'c2', name: 'Elettronica e Informatica' },
  { id: 'c3', name: 'Casa, Arredamento e Giardino' },
  { id: 'c4', name: 'Alimentari e Bevande' },
  { id: 'c5', name: 'Libri, Film e Musica' },
  { id: 'c6', name: 'Salute e Bellezza' },
  { id: 'c7', name: 'Sport e Tempo Libero' },
  { id: 'c8', name: 'Motori e Veicoli' },
  { id: 'c9', name: 'Altro / Varie' },
]

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

  // NUOVO: la modalità notte si ricordava solo finché non si ricaricava la
  // pagina - a ogni riapertura del sito si tornava al chiaro, e andava
  // riattivata ogni volta. Ora la scelta viene salvata sul dispositivo.
  useEffect(() => {
    try {
      // La preferenza si legge per forza QUI e non nel valore iniziale di
      // useState: localStorage non esiste sul server, e leggerlo durante il
      // primo render farebbe risultare al browser un contenuto diverso da
      // quello generato dal server (errore di idratazione).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem('relove:modalita-notte') === '1') setDarkMode(true)
    } catch {
      // Storage non disponibile (WebView in incognito): pazienza, resta chiaro.
    }
  }, [])

  // --- EFFETTO MODALITÀ NOTTE ---
  useEffect(() => {
    try {
      localStorage.setItem('relove:modalita-notte', darkMode ? '1' : '0')
    } catch {
      // vedi sopra: non poter salvare la preferenza non deve rompere nulla
    }

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
    let visibilityHandler: (() => void) | null = null;

    const getData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)
        
        // FIX: la sezione "Categorie" del menu laterale era SEMPRE vuota.
        // La tabella "categories" con la chiave anonima risponde 200 ma
        // restituisce un elenco vuoto (la RLS non ha una policy di lettura
        // pubblica), e qui l'elenco vuoto veniva accettato senza accorgersi
        // di nulla. Se il database non ci dà niente, usiamo le stesse
        // categorie già elencate nei filtri della Home: sono i valori
        // realmente presenti sugli annunci, quindi i link funzionano.
        try {
          const { data: cats } = await supabase.from('categories').select('*').order('name')
          setCategories(cats && cats.length > 0 ? cats : CATEGORIE_DI_RISERVA)
        } catch (catErr) {
          setCategories(CATEGORIE_DI_RISERVA)
        }

        try {
          const { data: anns } = await supabase.from('announcements').select('*')
          if (anns) setAnnouncements(anns)
        } catch (annsErr) {}

        if (currentUser) {
          await fetchNotifications(currentUser.id)

          notificationHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail
            fetchNotifications(currentUser.id)
            if (detail?.message) triggerNativePush(detail.message)
          }
          window.addEventListener('relove:new-notification', notificationHandler)

          // Il contatore si aggiornava SOLO all'apertura della pagina e agli
          // eventi in tempo reale. Ma la connessione realtime cade sempre
          // quando il telefono mette l'app in background o si blocca lo
          // schermo: al ritorno il pallino restava fermo al valore vecchio
          // finché non si ricaricava a mano. Ricontrolliamo ogni volta che
          // l'utente torna sull'app - è una singola query leggera.
          visibilityHandler = () => {
            if (document.visibilityState === 'visible') fetchNotifications(currentUser.id)
          }
          document.addEventListener('visibilitychange', visibilityHandler)
          window.addEventListener('focus', visibilityHandler)
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
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
        window.removeEventListener('focus', visibilityHandler)
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

  // Trasforma la chiave pubblica VAPID (testo leggibile) nel formato di
  // byte grezzi richiesto dall'API del browser per iscriversi alle push.
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
  }

  // FIX: questa logica esisteva solo in una copia MORTA della Navbar
  // (app/components/Navbar.tsx, non importata da nessuna parte). Nella
  // Navbar davvero in uso il permesso del browser veniva chiesto ma non
  // seguiva alcuna iscrizione: la tabella "push_subscriptions" restava
  // sempre vuota, quindi /api/push/send non aveva nessun dispositivo a cui
  // mandare le notifiche e ogni chiamata a pushNotify(...) sparsa nel sito
  // non faceva assolutamente nulla. Va chiamata solo a permesso già
  // concesso: non chiede nulla lei stessa, quindi non forza alcun consenso.
  const attivaPushReali = async (currentUser: { id: string }) => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        console.warn('NEXT_PUBLIC_VAPID_PUBLIC_KEY non configurata - notifiche push non attivabili.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, // richiesto dal browser: ogni push deve mostrare una notifica visibile
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        })
      }

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, subscription: subscription.toJSON() }),
      })
    } catch (err) {
      // Non blocchiamo mai il resto dell'app per un'iscrizione push fallita
      // (es. utente su un browser che non la supporta, o l'ha rifiutata).
      console.warn('Iscrizione notifiche push non riuscita:', err)
    }
  }

  // Se il permesso è già stato concesso in una visita precedente, ri-allinea
  // l'iscrizione a ogni accesso: l'endpoint push può cambiare (aggiornamento
  // del browser, reinstallazione della PWA) e senza questo l'utente
  // resterebbe registrato con un indirizzo non più valido.
  useEffect(() => {
    if (!user) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission !== 'granted') return
    attivaPushReali(user)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleOpenNotifs = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        // FIX: prima questo permesso veniva chiesto ma non succedeva altro
        // in caso di consenso - le "notifiche push" restavano solo quelle
        // in-app, mostrate esclusivamente mentre il sito è aperto. Ora, SE
        // l'utente acconsente, lo iscriviamo davvero alle notifiche push,
        // che funzionano anche a telefono bloccato o app chiusa.
        const permesso = await Notification.requestPermission();
        if (permesso === 'granted' && user) {
          attivaPushReali(user);
        }
      }
    }

    setIsNotifOpen(!isNotifOpen);
    setIsQuickMenuOpen(false);

    if (!isNotifOpen && notifications > 0 && user) {
      // FIX: questo aggiornamento veniva fatto dal browser con la chiave
      // anonima. La RLS su "notifications" non ha una policy di UPDATE:
      // rispondeva 200 senza toccare NESSUNA riga. Il pallino rosso spariva
      // solo a schermo e tornava al numero di prima a ogni ricaricamento,
      // per sempre. Ora passa dalla route server.
      const esito = await segnaNotificheLette();
      if (!esito.ok) {
        console.error('Notifiche non segnate come lette:', esito.errore)
        return
      }

      setNotifications(0);
      setNotifList(prev => prev.map(n => ({...n, is_read: true})));
    }
  };

  // NUOVO: cancellazione delle proprie notifiche - prima non era proprio
  // prevista, si potevano solo accumulare.
  const handleEliminaNotifica = async (id: string) => {
    const esito = await eliminaNotifica(id)
    if (!esito.ok) {
      alert(esito.errore || "Errore durante l'eliminazione.")
      return
    }
    setNotifList(prev => prev.filter(n => n.id !== id))
    setNotifications(prev => {
      const eliminata = notifList.find(n => n.id === id)
      return eliminata && !eliminata.is_read ? Math.max(0, prev - 1) : prev
    })
  }

  const handleEliminaTutteNotifiche = async () => {
    if (!confirm('Eliminare tutte le tue notifiche? Non si possono recuperare.')) return
    const esito = await eliminaTutteLeNotifiche()
    if (!esito.ok) {
      alert(esito.errore || "Errore durante l'eliminazione.")
      return
    }
    setNotifList([])
    setNotifications(0)
  }

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
          // FIX: prima veniva cancellata solo la riga del profilo, dal
          // browser. Due conseguenze: l'utente restava registrato in
          // Supabase Auth e poteva rientrare (senza profilo, in uno stato
          // incoerente), e con la RLS quella DELETE poteva non toccare
          // nessuna riga senza dare errore - mostrando comunque "Profilo
          // eliminato con successo". Ora passa da una route server che
          // chiude davvero l'account, e che si rifiuta di farlo se ci sono
          // scambi ancora aperti.
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) {
            alert('Sessione scaduta: rientra e riprova.');
            return;
          }

          const res = await fetch('/api/account/delete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          const data = await res.json();

          if (!res.ok || data.error) {
            alert(data.error || "Errore durante l'eliminazione.");
            return;
          }

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

  useEffect(() => {
    return () => {
      if (radarTimeoutRef.current) clearTimeout(radarTimeoutRef.current)
    }
  }, [])

  // FIX: questo pulsante era FINTO. Non valutava niente: restituiva
  // Math.random() * 50 + 10, cioè un numero a caso fra 10 e 60, e lo
  // presentava all'utente come "basato sull'attuale mercato dell'usato".
  // Nel frattempo /api/valutazione esisteva già, funzionante, e faceva una
  // stima vera tramite Gemini - ma non era chiamata da nessuna parte del
  // sito. Ora il pulsante usa quella.
  const handleAiValuation = async () => {
    const nome = aiItemName.trim()
    if (!nome) return
    setLoading(true)
    setAiResult(null)
    try {
      const res = await fetch('/api/valutazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName: nome, condition: 'usato, buono stato' }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        // Meglio dire che la stima non è disponibile che inventarne una.
        setAiResult(data.error || 'Non è stato possibile calcolare una stima. Riprova tra poco.')
        return
      }

      // La route risponde con { priceRange, reason }.
      setAiResult(
        data.priceRange
          ? `${data.priceRange}${data.reason ? ` — ${data.reason}` : ''}`
          : 'Nessuna stima disponibile per questo oggetto.'
      )
    } catch (err) {
      console.error('Errore valutazione:', err)
      setAiResult('Errore di connessione: riprova tra poco.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ======================================================================
          BARRA IN ALTO
          Rifatta per ordine e respiro, SENZA cambiare i colori: restano il
          fondo bianco, il bordo rosa, il testo stone e il gradiente
          rosa-arancio del pulsante "Vendi".

          Cosa non tornava prima:
            - Le icone avevano misure diverse fra loro (28 e 24 px) pur
              stando fianco a fianco, e le aree cliccabili risultavano di
              altezze diverse: la fila appariva "a scalini".
            - I raggi degli angoli erano misti (rounded-xl e rounded-full
              alternati sugli stessi tipi di pulsante).
            - Gli spazi erano tre valori diversi sovrapposti (gap-4/6, gap-3/5,
              gap-2) più margini manuali: da qui l'aria irregolare.
            - Su schermi medi il logo enorme (text-5xl) e i 28px delle icone
              arrivavano quasi a toccarsi.
          Ora: una sola misura d'icona (22), un solo bersaglio quadrato di
          44px (la misura minima consigliata per il tocco), un solo raggio,
          e un solo passo di spaziatura.
          ====================================================================== */}
      <nav
        style={{ backgroundColor: '#ffffff', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}
        className="border-b border-rose-100 sticky top-0 z-[5000] shadow-sm flex justify-between items-center gap-3 h-16 md:h-20 px-3 md:px-6 transition-colors"
      >
        <div className="flex items-center gap-1 md:gap-2 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            title="Menu"
            aria-label="Apri il menu"
            className="w-11 h-11 shrink-0 flex items-center justify-center text-stone-600 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <Menu size={22} strokeWidth={2.5} />
          </button>

          <Link
            href="/"
            aria-label="Torna alla home"
            className="text-3xl md:text-4xl leading-none pb-1 text-rose-500 select-none bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-400 truncate"
            style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 700 }}
          >
            Re-love
          </Link>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5">

          {/* Strumenti: gruppo separato da un solo filetto, senza margini
              manuali che prima raddoppiavano lo spazio. */}
          <div className="hidden lg:flex items-center gap-1 pr-2 mr-1 border-r border-stone-200 text-stone-500">
            <button onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Modalità Chiara" : "Modalità Notte"} aria-label={darkMode ? "Modalità Chiara" : "Modalità Notte"} className="w-11 h-11 flex items-center justify-center hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
              {darkMode ? <Sun size={22} strokeWidth={2} /> : <Moon size={22} strokeWidth={2} />}
            </button>
            <button onClick={() => setShowSecurityModal(true)} title="Scudo Sicurezza" aria-label="Scudo Sicurezza" className="w-11 h-11 flex items-center justify-center hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
              <ShieldCheck size={22} strokeWidth={2} />
            </button>
            <button onClick={() => setShowAiModal(true)} title="Valutatore" aria-label="Valutatore" className="w-11 h-11 flex items-center justify-center hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
              <Sparkles size={22} strokeWidth={2} />
            </button>
            <button onClick={handleRadar} title="Radar Italia" aria-label="Radar Italia" className="w-11 h-11 flex items-center justify-center hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
              <Radar size={22} strokeWidth={2} />
            </button>
          </div>

          {!user && (
            <Link href="/login" className="hidden lg:flex items-center h-11 px-3 text-stone-600 font-bold uppercase text-xs tracking-widest hover:text-rose-500 transition-colors">
              Accedi
            </Link>
          )}

          <Link href="/add" className="hidden lg:flex items-center gap-2 h-11 bg-gradient-to-r from-rose-500 to-orange-400 text-white px-4 rounded-xl font-bold uppercase text-xs tracking-widest hover:shadow-lg transition-shadow shadow-md">
            <Plus size={16} strokeWidth={3} /> Vendi
          </Link>

          <div className="relative">
            <button
              onClick={handleOpenNotifs}
              title="Notifiche"
              aria-label={notifications > 0 ? `Notifiche, ${notifications} non lette` : 'Notifiche'}
              className="relative w-11 h-11 flex items-center justify-center text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors"
            >
              <Bell size={22} strokeWidth={2} />
              {notifications > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full font-bold border-2 border-white">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="fixed left-3 right-3 top-[4.5rem] md:left-auto md:right-6 md:top-[5.5rem] md:w-80 bg-white border border-stone-200 rounded-2xl shadow-2xl p-4 z-[6000]">
                <div className="flex justify-between items-center border-b border-stone-100 pb-3 mb-4">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-stone-400">Notifiche</h4>
                  <div className="flex items-center gap-1">
                    {notifList.length > 0 && (
                      <button
                        onClick={handleEliminaTutteNotifiche}
                        title="Elimina tutte le notifiche"
                        className="text-[9px] font-black uppercase tracking-widest text-stone-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Svuota
                      </button>
                    )}
                    <button onClick={() => setIsNotifOpen(false)} className="text-stone-400 hover:text-stone-800 text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-50">
                      <X size={18} strokeWidth={2.5} />
                    </button>
                  </div>
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
                      <div key={n.id} className={`p-4 rounded-2xl border text-sm transition-all flex items-start gap-2 ${n.is_read ? 'bg-stone-50 border-stone-100 text-stone-500' : 'bg-rose-50 border-rose-200 text-stone-900 font-bold shadow-sm'}`}>
                        <span className="flex-1 min-w-0 break-words">{n.message}</span>
                        <button
                          onClick={() => handleEliminaNotifica(n.id)}
                          title="Elimina questa notifica"
                          className="shrink-0 text-stone-300 hover:text-red-500 transition-colors mt-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
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
            }} title="Altro" aria-label="Altre opzioni" className="w-11 h-11 flex items-center justify-center text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors">
              <MoreVertical size={22} strokeWidth={2} />
            </button>
            {isQuickMenuOpen && (
              <div className="fixed left-auto right-3 md:right-6 top-[4.5rem] md:top-[5.5rem] w-60 bg-white border border-stone-200 shadow-2xl rounded-2xl p-2 z-[6000]">
                <Link href="/profile" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
                  <Settings size={18} /> Impostazioni
                </Link>
                {user && (
                  <Link href="/dashboard/analitiche" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
                    <TrendingUp size={18} /> Seller Hub
                  </Link>
                )}
                <Link href="/supporto" onClick={() => setIsQuickMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors">
                  <HelpCircle size={18} /> Aiuto
                </Link>
                {user && (
                  <>
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 text-left px-4 py-3 text-[15px] font-medium text-stone-700 hover:bg-stone-50 rounded-xl transition-colors">
                      <LogOut size={18} /> Esci
                    </button>
                    <div className="border-t border-stone-100 my-2"></div>
                    <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 text-left px-4 py-3 text-[15px] font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={18} /> Elimina Profilo
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={openCart}
            title="Carrello"
            aria-label={items.length > 0 ? `Carrello, ${items.length} articoli` : 'Carrello'}
            className="relative w-11 h-11 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 text-stone-500 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
          >
            <ShoppingCart size={22} strokeWidth={2} />
            {items.length > 0 && (
              <span className="absolute top-1.5 right-1.5 bg-rose-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full font-bold border-2 border-white shadow-sm">
                {items.length > 9 ? '9+' : items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {(isSidebarOpen || isCartOpen || showSecurityModal || showAiModal || showMapModal) && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[9998] transition-opacity" 
             onClick={() => { setIsSidebarOpen(false); closeCart(); setIsQuickMenuOpen(false); setIsNotifOpen(false); setShowSecurityModal(false); setShowAiModal(false); setShowMapModal(false); }} />
      )}

      {(isQuickMenuOpen || isNotifOpen) && (
        <div 
          className="fixed inset-0 z-[4999]" 
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

          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">
            <section>
              <h3 className="text-[11px] font-bold uppercase text-stone-400 mb-3 tracking-[0.2em] border-b pb-2.5 border-stone-100">Area Riservata</h3>
              <div className="grid gap-1">
                <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="flex justify-center items-center gap-2 w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white text-center py-4 rounded-xl font-bold uppercase text-sm tracking-widest shadow-md lg:hidden mb-3">
                  <Plus size={20} strokeWidth={3} /> Vendi o Regala
                </Link>
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <UserIcon size={20} className="text-stone-500" /> Profilo
                    </Link>
                    <Link href="/dashboard/analitiche" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-4"><TrendingUp size={20} className="text-stone-500" /> Seller Hub</div> 
                      <span className="bg-orange-100 text-orange-600 text-[11px] px-3 py-1 rounded-full font-bold">PRO</span>
                    </Link>
                    <Link href="/dashboard/annunci" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <FileText size={20} className="text-stone-500" /> Gestione Annunci
                    </Link>
                    {/* NUOVO: link al sistema "Curatore Locale" - su richiesta,
                        prima le pagine (/curatore, /curatore/nuovo,
                        /curatore/scansiona) esistevano ma non c'era nessun
                        ingresso visibile nel sito. Va qui, dentro l'Area
                        Riservata, perché sia creare un mandato che
                        approvarne uno richiedono comunque di essere
                        autenticati - stessa logica già usata per Seller
                        Hub e Gestione Annunci qui sopra. */}
                    <Link href="/curatore" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <Handshake size={20} className="text-stone-500" /> Curatore Locale
                    </Link>
                    <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-4"><Package size={20} className="text-stone-500" /> Ordini e Resi</div> 
                      <span className="bg-rose-500 text-white text-[11px] px-3 py-1 rounded-full font-bold">SECURE</span>
                    </Link>
                    <Link href="/chat" onClick={() => setIsSidebarOpen(false)} className="flex justify-between items-center gap-3 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-4"><MessageCircle size={20} className="text-stone-500" /> Messaggi</div>
                    </Link>
                    {/* NUOVO: ingresso al sistema Baratto. Le sue pagine e le
                        sue route esistevano ma nessun link nel sito ci
                        portava, quindi era irraggiungibile. */}
                    <Link href="/baratti" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <Handshake size={20} className="text-stone-500" /> Baratti
                    </Link>
                    <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <Heart size={20} className="text-stone-500" /> Preferiti
                    </Link>
                    <Link href="/supporto" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <HelpCircle size={20} className="text-stone-500" /> Aiuto
                    </Link>
                    <button onClick={handleLogout} className="flex items-center gap-4 w-full text-left px-4 py-3 text-[13px] font-bold text-red-500 hover:bg-red-50 rounded-xl mt-3 uppercase tracking-widest transition-colors">
                      <LogOut size={20} strokeWidth={2.5} /> Esci
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsSidebarOpen(false)} className="w-full block text-center p-4 text-sm font-bold text-rose-500 border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 rounded-xl mt-3 uppercase tracking-widest transition-all">Accedi / Registrati</Link>
                )}
              </div>
            </section>

            <section className="lg:hidden">
              <h3 className="text-[11px] font-bold uppercase text-stone-400 mb-3 tracking-[0.2em] border-b pb-2.5 border-stone-100">Strumenti Re-love</h3>
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

            {/* NUOVO: sezione che mancava del tutto. Vetrina, Arena,
                Laboratori e "Come funziona" erano pagine vere e funzionanti
                ma raggiungibili solo indovinando l'indirizzo (o, per la
                Vetrina, solo dalla barra in fondo su Android): dal menu non
                ci portava nessun link. Sta fuori dall'Area Riservata perché
                si possono guardare anche senza aver fatto l'accesso. */}
            <section>
              <h3 className="text-[11px] font-bold uppercase text-stone-400 mb-3 tracking-[0.2em] border-b pb-2.5 border-stone-100">Esplora</h3>
              <div className="grid gap-1">
                <Link href="/vetrina" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                  <Sparkles size={20} className="text-stone-500 shrink-0" /> Vetrina
                </Link>
                <Link href="/arena" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                  <TrendingUp size={20} className="text-stone-500 shrink-0" /> Arena ReLove
                </Link>
                <Link href="/laboratori" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                  <FileText size={20} className="text-stone-500 shrink-0" /> Laboratori e Corsi
                </Link>
                <Link href="/come-funziona" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 px-4 py-3 text-[15px] font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                  <HelpCircle size={20} className="text-stone-500 shrink-0" /> Come funziona
                </Link>
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-bold uppercase text-stone-400 mb-3 tracking-[0.2em] border-b pb-2.5 border-stone-100">Categorie</h3>
              <div className="grid gap-1">
                {/* FIX: questi link non filtravano NIENTE. Puntavano a
                    "/?cat=<slug>" (es. "abbigliamento"), ma la Home confronta
                    quel valore con "item.category_id" - che su ogni annuncio
                    del database è null, perché la categoria è salvata come
                    testo nella colonna "category" ("Abbigliamento e
                    Accessori"). Il confronto non poteva riuscire mai: toccare
                    una categoria dava sempre zero risultati. Ora passiamo il
                    nome, che è il valore realmente presente sugli annunci. */}
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/?cat=${encodeURIComponent(cat.name)}`} onClick={() => setIsSidebarOpen(false)} className="flex items-center px-4 py-3 text-[15px] font-medium text-stone-600 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-colors">
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
