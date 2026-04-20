'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  
  // Stato Globale del Carrello
  const { items, isCartOpen, openCart, closeCart, removeItem } = useCartStore()
  const cartTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    setIsSidebarOpen(false)
    setIsDropdownOpen(false)
  }

  return (
    <>
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-[80] shadow-sm font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            
            {/* LATO SINISTRO: Menu Hambuger e Logo */}
            <div className="flex items-center gap-4">
              <button onClick={() => setIsSidebarOpen(true)} className="text-stone-900 p-2 hover:bg-stone-100 rounded-lg transition-colors focus:outline-none">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <Link href="/" className="text-3xl font-black uppercase italic tracking-tighter text-stone-900">
                Materiali
              </Link>
            </div>

            {/* LATO DESTRO: Vendi, Account, Carrello */}
            <div className="flex items-center space-x-3 md:space-x-4">
              <Link href="/add" className="hidden md:block bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm">
                ➕ Pubblica
              </Link>

              {user ? (
                <div className="relative hidden md:block">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    👤 Il mio Account
                  </button>

                  <div className={`absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden transition-all duration-200 origin-top-right ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                    <div className="p-4 border-b border-stone-100 bg-stone-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Loggato come</p>
                      <p className="text-xs font-bold text-stone-900 truncate">{user.email}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors">Il mio Profilo</Link>
                      <Link href="/dashboard/acquisti" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors">I miei Ordini (Escrow)</Link>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">Esci</button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/login" className="hidden md:block bg-stone-900 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-sm">
                  Accedi
                </Link>
              )}

              {/* Tasto Carrello */}
              <button onClick={openCart} className="relative p-2 text-stone-900 hover:bg-stone-100 rounded-lg transition-colors">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                {items.length > 0 && (
                  <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {items.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ---------------------------------------------------- */}
      {/* 1. SIDEBAR SINISTRA (Menu Navigazione) */}
      {/* ---------------------------------------------------- */}
      <div className={`fixed inset-0 z-[100] transition-all duration-300 ${isSidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>
        
        <div className={`absolute top-0 left-0 h-full w-4/5 max-w-xs bg-white shadow-2xl flex flex-col transition-transform duration-300 transform overflow-y-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          
          <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center sticky top-0 z-10">
             <span className="text-xl font-black uppercase italic tracking-tighter text-stone-900">Menu</span>
             <button onClick={() => setIsSidebarOpen(false)} className="text-stone-400 hover:text-stone-900 font-bold p-2 transition-colors">✕</button>
          </div>

          <div className="p-6 space-y-8 flex-1">
            {/* Intestazione Utente */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Area Utente</h3>
              {user ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-stone-900 px-3 pb-2 truncate">Ciao, {user.email?.split('@')[0]}</p>
                  <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">👤 Il mio Profilo</Link>
                  <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">📦 I miei Ordini</Link>
                  <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 hover:bg-stone-100 rounded-xl transition-colors">❤️ I miei Preferiti</Link>
                  <button onClick={handleLogout} className="w-full text-left p-3 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl mt-2 transition-colors">Esci dall'account</button>
                </div>
              ) : (
                <Link href="/login" onClick={() => setIsSidebarOpen(false)} className="block w-full text-center bg-stone-900 text-white px-6 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-sm hover:bg-stone-800 transition-all">Accedi / Registrati</Link>
              )}
            </div>

            {/* Categorie Principali */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Categorie</h3>
              <div className="space-y-1">
                {['Edilizia', 'Elettricità', 'Idraulica', 'Giardinaggio', 'Altro'].map((cat) => (
                  <Link key={cat} href={`/?category=${cat}`} onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">{cat}</Link>
                ))}
              </div>
            </div>

            {/* Esplora (Filtri Rapidi) */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Esplora</h3>
              <div className="space-y-2">
                <Link href="/?type=offered" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-black text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-2">🎁 Solo in Regalo</Link>
                <Link href="/?condition=Nuovo" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all">✨ Solo Nuovo</Link>
                <Link href="/?condition=Usato" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all">♻️ Solo Usato</Link>
              </div>
            </div>

            {/* Aiuto e Supporto */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Supporto</h3>
              <div className="space-y-1">
                <Link href="/come-funziona" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-xl">Come funziona</Link>
                <Link href="/protezione" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-xl flex items-center gap-2">🛡️ Protezione Acquisti</Link>
                <Link href="/faq" onClick={() => setIsSidebarOpen(false)} className="block p-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-xl">Aiuto / FAQ</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. DRAWER DESTRO (Carrello) */}
      {/* ---------------------------------------------------- */}
      <div className={`fixed inset-0 z-[100] transition-all duration-300 ${isCartOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={closeCart}></div>
        
        <div className={`absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300 transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
             <h2 className="text-2xl font-black uppercase italic tracking-tighter text-stone-900">Il tuo Carrello</h2>
             <button onClick={closeCart} className="text-stone-400 hover:text-stone-900 font-bold p-2 bg-white rounded-full shadow-sm transition-colors">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-white">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                <span className="text-6xl">🛒</span>
                <p className="text-sm font-bold uppercase tracking-widest text-stone-500">Il carrello è vuoto</p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 bg-stone-50 border border-stone-100 rounded-2xl relative">
                    <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-black shadow-md hover:bg-red-600 transition-colors">✕</button>
                    <div className="w-20 h-20 bg-white rounded-xl overflow-hidden border border-stone-200 flex-shrink-0">
                      <img src={item.image_url || '/nuovo.png'} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex flex-col justify-center">
                      <h4 className="text-sm font-bold text-stone-900 uppercase leading-tight line-clamp-2 mb-1">{item.title}</h4>
                      <p className="text-[10px] font-black text-stone-400 tracking-widest uppercase mb-2">Qta: {item.quantity}</p>
                      <p className="text-emerald-600 font-black text-sm">€ {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Area Checkout (in basso) */}
          {items.length > 0 && (
             <div className="p-6 border-t border-stone-200 bg-stone-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-sm font-black uppercase tracking-widest text-stone-500">Subtotale</span>
                  <span className="text-2xl font-black text-stone-900">€ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="space-y-3">
                  <button onClick={() => alert('Funzione Checkout in arrivo!')} className="w-full bg-emerald-500 text-white p-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-md hover:bg-emerald-600 transition-colors">
                    Procedi all'Acquisto
                  </button>
                  <button onClick={closeCart} className="w-full bg-stone-200 text-stone-800 p-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-stone-300 transition-colors">
                    Continua lo Shopping
                  </button>
                </div>
             </div>
          )}
        </div>
      </div>
    </>
  )
}
