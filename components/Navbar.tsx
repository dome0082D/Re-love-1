'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [notifications, setNotifications] = useState(2) // Esempio numero notifiche
  
  // STATO GLOBALE CARRELLO (Zustand)
  const { items, isCartOpen, openCart, closeCart, removeItem, updateQuantity } = useCartStore()
  
  const total = items.reduce((acc, i) => acc + (Number(i.price) * i.quantity), 0)

  useEffect(() => {
    const getData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: cats } = await supabase.from('categories').select('*').order('name')
      setCategories(cats || [])
    }
    getData()
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => authListener.subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // LOGICA STRIPE
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
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-[5000] shadow-sm flex justify-between items-center h-20 px-6 md:px-8">
        <div className="flex items-center gap-4 md:gap-6">
          <button onClick={() => setIsSidebarOpen(true)} className="text-2xl p-2 text-stone-600 hover:bg-stone-50 rounded-lg transition-all focus:outline-none">
            ☰
          </button>
          
          <Link 
            href="/" 
            className="text-3xl md:text-4xl text-stone-800 select-none"
            style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 400 }}
          >
            Libero Scambio
          </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {!user && (
            <Link href="/login" className="hidden lg:block text-stone-700 font-bold uppercase text-[11px] tracking-widest hover:text-emerald-600 transition-colors px-4">
              Accedi
            </Link>
          )}

          <Link href="/add" className="hidden lg:block bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[11px] tracking-widest hover:bg-emerald-600 transition-all shadow-md">
            ➕ Pubblica Annuncio
          </Link>

          {/* ICONA NOTIFICHE */}
          <button className="relative p-2 text-xl text-stone-500 hover:bg-stone-50 rounded-full transition-all">
            🔔
            {notifications > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold border border-white">
                {notifications}
              </span>
            )}
          </button>

          {/* MENU A SCOMPARSA (TRE PUNTINI) */}
          <div className="relative">
            <button onClick={() => setIsQuickMenuOpen(!isQuickMenuOpen)} className="p-2 text-xl text-stone-500 hover:bg-stone-50 rounded-full transition-all">
              ⋮
            </button>
            {isQuickMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-stone-100 shadow-xl rounded-xl p-2 z-[6000]">
                <Link href="/profile" className="block p-3 text-xs font-medium text-stone-700 hover:bg-stone-50 rounded-lg transition-all">⚙️ Impostazioni</Link>
                <Link href="/come-funziona" className="block p-3 text-xs font-medium text-stone-700 hover:bg-stone-50 rounded-lg transition-all">❓ Aiuto</Link>
                {user && <button onClick={handleLogout} className="w-full text-left p-3 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-all">Esci</button>}
              </div>
            )}
          </div>

          <button onClick={openCart} className="relative text-2xl p-2 hover:bg-stone-50 rounded-full transition-all focus:outline-none">
            🛒 
            {items.length > 0 && (
              <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold border border-white shadow-md">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* OVERLAY */}
      {(isSidebarOpen || isCartOpen) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998] transition-opacity" 
             onClick={() => { setIsSidebarOpen(false); closeCart(); setIsQuickMenuOpen(false); }} />
      )}

      {/* SIDEBAR SINISTRA */}
      <div className={`fixed top-0 left-0 h-full w-full max-w-[320px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-8 bg-stone-900 text-white relative">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-6 right-6 text-stone-400 hover:text-white text-2xl transition-colors">✕</button>
            <div className="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center text-2xl font-bold italic shadow-md mb-4">
              {user?.email ? user.email[0].toUpperCase() : 'L'}
            </div>
            <p className="text-2xl mb-1 text-emerald-400" style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}>Libero Scambio</p>
            <p className="font-medium truncate text-xs tracking-wider uppercase opacity-70">{user?.email || 'Visitatore'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
              <h3 className="text-[10px] font-bold uppercase text-stone-400 mb-4 tracking-[0.2em] border-b pb-2">Area Riservata</h3>
              <div className="grid gap-2">
                <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="block w-full bg-emerald-500 text-white text-center py-3 rounded-xl font-bold uppercase text-[11px] tracking-widest shadow-sm lg:hidden mb-2">➕ Pubblica</Link>
                
                {user ? (
                  <>
                    <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-3 text-sm font-medium text-stone-800 hover:bg-stone-50 rounded-xl transition-all">👤 Profilo</Link>
                    <Link href="/dashboard/annunci" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-800 hover:bg-stone-50 rounded-xl transition-all">📝 Gestione Annunci</Link>
                    <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-800 hover:bg-stone-50 rounded-xl transition-all flex justify-between">📦 Ordini <span className="bg-stone-900 text-white text-[9px] px-2 py-0.5 rounded-full">ESCROW</span></Link>
                    <Link href="/chat" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-800 hover:bg-stone-50 rounded-xl transition-all flex justify-between">💬 Messaggi</Link>
                    <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-800 hover:bg-stone-50 rounded-xl transition-all">❤️ Preferiti</Link>
                    <button onClick={handleLogout} className="w-full text-left p-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl mt-4 uppercase tracking-widest transition-all">← Esci</button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsSidebarOpen(false)} className="w-full block text-center p-4 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl mt-2 uppercase tracking-widest transition-all">
                    Accedi / Registrati
                  </Link>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase text-stone-400 mb-4 tracking-[0.2em] border-b pb-2">Categorie</h3>
              <div className="grid gap-1">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/?cat=${cat.slug}`} onClick={() => setIsSidebarOpen(false)} className="p-3 text-sm font-medium text-stone-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* DRAWER CARRELLO (Con quantità modificabile) */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[380px] bg-white z-[9999] shadow-2xl transition-transform duration-300 ease-in-out transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex justify-between items-center border-b border-stone-100">
          <h2 className="text-xl font-bold uppercase italic tracking-tighter text-stone-900">Carrello</h2>
          <button onClick={closeCart} className="text-stone-400 hover:text-stone-900 text-2xl font-medium bg-stone-50 w-10 h-10 flex items-center justify-center rounded-full transition-all">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-24 opacity-40">
              <span className="text-6xl block mb-4">🛒</span>
              <p className="text-xs font-bold uppercase tracking-[0.2em]">Carrello vuoto</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-4 p-4 bg-stone-50 rounded-2xl border border-stone-100 group relative transition-all">
                <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold shadow-md hover:scale-110 transition-transform">✕</button>
                <div className="w-16 h-16 bg-white rounded-xl overflow-hidden border border-stone-200 flex-shrink-0">
                  <img src={item.image_url || '/nuovo.png'} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-xs font-bold uppercase truncate text-stone-900 mb-1">{item.title}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm font-bold text-emerald-600">€ {item.price}</p>
                    {/* SELETTORE QUANTITÀ */}
                    <div className="flex items-center border border-stone-200 rounded-lg bg-white">
                      <button onClick={() => updateQuantity && updateQuantity(item.id, Math.max(1, item.quantity - 1))} className="px-2 py-0.5 text-stone-500 hover:text-stone-900 font-bold">-</button>
                      <span className="px-2 text-[11px] font-medium border-x border-stone-200 text-stone-800">{item.quantity}</span>
                      <button onClick={() => updateQuantity && updateQuantity(item.id, item.quantity + 1)} className="px-2 py-0.5 text-stone-500 hover:text-stone-900 font-bold">+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 border-t border-stone-100 bg-white">
          <div className="flex justify-between items-center mb-4 px-2">
            <span className="font-bold text-xs uppercase tracking-[0.2em] text-stone-400">Totale</span>
            <span className="text-2xl font-bold text-stone-900 tracking-tight">€ {total.toFixed(2)}</span>
          </div>
          <button 
            onClick={handleCheckout}
            disabled={items.length === 0 || loading} 
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold uppercase text-[11px] tracking-[0.2em] shadow-lg hover:bg-emerald-600 transition-all disabled:opacity-40"
          >
            {loading ? 'Elaborazione Stripe...' : 'Paga Sicuro'}
          </button>
        </div>
      </div>
    </>
  )
}
