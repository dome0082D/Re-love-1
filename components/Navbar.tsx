'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  // NUOVO STATO AGGIUNTO PER LA TENDINA DELLE NOTIFICHE
  const [isNotifOpen, setIsNotifOpen] = useState(false) 
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState(0)
  
  const { items, isCartOpen, openCart, closeCart, removeItem, updateQuantity } = useCartStore()
  const total = items.reduce((acc, i) => acc + (Number(i.price) * i.quantity), 0)

  useEffect(() => {
    const getData = async () => {
      try {
        // RISOLUZIONE ERRORE "auth-token stole it": uso getSession invece di getUser
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user || null
        setUser(currentUser)
        
        // AGGIUNTA PROTEZIONE CONTRO ERRORE 404 SULLE CATEGORIE
        try {
          const { data: cats, error: catsError } = await supabase.from('categories').select('*').order('name')
          if (!catsError && cats) {
            setCategories(cats)
          }
        } catch (catErr) {
          console.warn("Nessuna tabella categorie trovata, ignoro l'errore", catErr)
        }

        if (currentUser) {
          await fetchNotifications(currentUser.id)
          
          // AGGIUNTA PROTEZIONE E FIX "PAYLOAD" SUL CANALE REALTIME
          try {
            const channel = supabase.channel('realtime-notifications')
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
                // Ora il parametro payload è dichiarato, eviterà il crash se indefinito
                fetchNotifications(currentUser.id)
              }).subscribe()
              
            return () => { supabase.removeChannel(channel) }
          } catch (channelErr) {
            console.warn("Canale notifiche non avviato, ignoro l'errore", channelErr)
          }
        }
      } catch (mainErr) {
        console.error("Errore di inizializzazione Navbar:", mainErr)
      }
    }
    
    getData()
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe()
      }
    }
  }, [])

  // AGGIUNTA PROTEZIONE CONTRO ERRORE 404 SULLE NOTIFICHE
  const fetchNotifications = async (userId: string) => {
    try {
      const { count, error } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_read', false)
      if (!error && count !== null) {
        setNotifications(count)
      }
    } catch (e) { 
      console.warn("Impossibile caricare le notifiche:", e) 
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

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
        alert("Errore Checkout Stripe. Riprova più tardi.");
        setLoading(false);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="bg-white border-b border-rose-100 sticky top-0 z-[5000] shadow-sm flex justify-between items-center h-20 px-6 md:px-8">
        <div className="flex items-center gap-4 md:gap-6">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl p-2 text-stone-600 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all focus:outline-none">
            ☰
          </button>
          
          <Link 
            href="/" 
            className="text-3xl md:text-4xl text-rose-500 select-none bg-clip-text text-transparent bg-gradient-to-r from-rose-500 to-orange-400"
            style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 700 }}
          >
            Re-love
          </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {!user && (
            <Link href="/login" className="hidden lg:block text-stone-600 font-bold uppercase text-[11px] tracking-widest hover:text-rose-500 transition-colors px-4">
              Accedi
            </Link>
          )}

          <Link href="/add" className="hidden lg:block bg-gradient-to-r from-rose-500 to-orange-400 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[11px] tracking-widest hover:shadow-lg hover:scale-105 transition-all shadow-md">
            ➕ Vendi o Regala
          </Link>

          {/* INIZIO MODIFICA: BLOCCO NOTIFICHE CON TENDINA */}
          <div className="relative">
            <button 
              onClick={() => {
                setIsNotifOpen(!isNotifOpen);
                setIsQuickMenuOpen(false); // Chiude l'altro menu se è aperto
              }} 
              className="relative p-2 text-xl text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all"
            >
              🔔
              {notifications > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold border border-white">
                  {notifications}
                </span>
              )}
            </button>
            
            {/* La Tendina */}
            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl p-4 z-[6000]">
                <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Notifiche</h4>
                  <button onClick={() => setIsNotifOpen(false)} className="text-stone-400 hover:text-stone-800 text-xs font-bold">✕</button>
                </div>
                <div className="py-6 text-center">
                  <span className="text-4xl block mb-3">📭</span>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Tutto tace</p>
                  <p className="text-[9px] text-stone-400 font-medium mt-1">Nessuna nuova notifica.</p>
                </div>
              </div>
            )}
          </div>
          {/* FINE MODIFICA */}

          <div className="relative">
            <button onClick={() => {
              setIsQuickMenuOpen(!isQuickMenuOpen);
              setIsNotifOpen(false); // Chiude le notifiche se si apre questo menu
            }} className="p-2 text-xl text-stone-500 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-all">
              ⋮
            </button>
            {isQuickMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-100 shadow-xl rounded-xl p-2 z-[6000]">
                <Link href="/profile" className="block p-3 text-xs font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all">⚙️ Impostazioni</Link>
                <Link href="/come-funziona" className="block p-3 text-xs font-medium text-stone-700 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-all">❓ Aiuto</Link>
                {user && <button onClick={handleLogout} className="w-full text-left p-3 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-all">Esci</button>}
              </div>
            )}
          </div>

          <button onClick={openCart} className="relative text-2xl p-2 hover:bg-rose-50 hover:text-rose-500 text-stone-500 rounded-full transition-all focus:outline-none">
            🛒 
            {items.length > 0 && (
              <span className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border border-white shadow-md">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {(isSidebarOpen || isCartOpen) && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[9998] transition-opacity" 
             onClick={() => { setIsSidebarOpen(false); closeCart(); setIsQuickMenuOpen(false); setIsNotifOpen(false); }} />
      )}

      <div className={`fixed top-0 left-0 h-full w-full max-w-[320px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 bg-gradient-to-br from-rose-500 to-orange-500 text-white relative">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-6 text-white/70 hover:text-white text-2xl transition-colors">✕</button>
            <div className="w-14 h-14 bg-white text-rose-500 rounded-xl flex items-center justify-center text-2xl font-bold italic shadow-md mb-4">
              {user?.email ? user.email[0].toUpperCase() : 'R'}
            </div>
            <p className="text-3xl mb-1 text-white" style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}>Re-love</p>
            <p className="font-medium truncate text-xs tracking-wider uppercase opacity-90">{user?.email || 'Visitatore'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
              <h3 className="text-[10px] font-bold uppercase text-stone-400 mb-4 tracking-[0.2em] border-b pb-2 border-stone-100">Area Riservata</h3>
              <div className="grid gap-2">
                <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="block w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white text-center py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-sm lg:hidden mb-2">➕ Vendi o Regala</Link>
                
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-3 text-sm font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">👤 Profilo</Link>
                    <Link href="/dashboard/annunci" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">📝 Gestione Annunci</Link>
                    <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex justify-between items-center">📦 Ordini <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full font-bold">SECURE</span></Link>
                    <Link href="/chat" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all flex justify-between">💬 Messaggi</Link>
                    <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-700 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">❤️ Preferiti</Link>
                    <button onClick={handleLogout} className="w-full text-left p-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl mt-4 uppercase tracking-widest transition-all">← Esci</button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsSidebarOpen(false)} className="w-full block text-center p-4 text-xs font-bold text-rose-500 border-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 rounded-xl mt-2 uppercase tracking-widest transition-all">
                    Accedi / Registrati
                  </Link>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase text-stone-400 mb-4 tracking-[0.2em] border-b pb-2 border-stone-100">Categorie</h3>
              <div className="grid gap-1">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/?cat=${cat.slug}`} onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-600 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase text-stone-400 mb-4 tracking-[0.2em] border-b pb-2 border-stone-100">Informazioni</h3>
              <div className="grid gap-1">
                <Link href="/come-funziona" onClick={() => setIsSidebarOpen(false)} className="p-3 text-xs font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all">ℹ️ Come Funziona</Link>
                <Link href="/privacy" onClick={() => setIsSidebarOpen(false)} className="p-3 text-xs font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-50 rounded-xl transition-all">🔒 Privacy e Sicurezza</Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className={`fixed top-0 right-0 h-full w-full max-w-[380px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex justify-between items-center border-b border-stone-100 bg-stone-50">
          <h2 className="text-xl font-bold uppercase italic tracking-tighter text-rose-500">Carrello</h2>
          <button onClick={closeCart} className="text-stone-400 hover:text-stone-900 text-2xl font-medium bg-white w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-24 opacity-40">
              <span className="text-6xl block mb-4">🛒</span>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">Carrello vuoto</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-stone-200 group relative transition-all shadow-sm hover:shadow-md">
                <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:scale-110 transition-all z-10">✕</button>
                <img src={(item as any).imageUrl || '/usato.png'} alt={item.title} className="w-20 h-20 object-cover rounded-xl border border-stone-200" />
                <div className="flex-1 flex flex-col justify-between">
                  <h3 className="font-bold text-sm text-stone-800 line-clamp-2">{item.title}</h3>
                  <div className="flex justify-between items-center mt-2">
                    <p className="font-black text-rose-500">€ {(Number(item.price)).toFixed(2)}</p>
                    <div className="flex items-center gap-3 bg-stone-50 rounded-lg p-1 border border-stone-100">
                      <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm font-bold text-stone-600 hover:text-rose-500 transition-all">-</button>
                      <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, Math.min((item as any).maxQuantity || 99, item.quantity + 1))} className="w-6 h-6 flex items-center justify-center bg-white rounded-md shadow-sm font-bold text-stone-600 hover:text-emerald-500 transition-all">+</button>
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
              <span className="text-sm font-bold uppercase tracking-widest text-stone-400">Totale</span>
              <span className="text-2xl font-black text-rose-600">€ {total.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} disabled={loading} className="w-full bg-gradient-to-r from-rose-500 to-orange-400 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-md hover:scale-[1.02] transition-all disabled:opacity-50">
              {loading ? 'Attendi...' : 'Procedi al Checkout'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}