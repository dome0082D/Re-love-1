'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  const { items, isCartOpen, openCart, closeCart, removeItem } = useCartStore()
  const total = items.reduce((acc, i) => acc + (Number(i.price) * i.quantity), 0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: authListener } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user))
    return () => authListener.subscription.unsubscribe()
  }, [])

  return (
    <>
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-[100] shadow-sm flex justify-between items-center h-20 px-4 md:px-10">
        <div className="flex items-center gap-2 md:gap-6">
          <button onClick={() => setIsSidebarOpen(true)} className="text-3xl p-2 hover:bg-stone-50 rounded-2xl focus:outline-none">☰</button>
          <Link href="/" className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-stone-900">
            Materiali
          </Link>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <Link href="/add" className="hidden md:block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-600 shadow-md">
            ➕ Pubblica
          </Link>
          <button onClick={openCart} className="relative text-3xl p-2 focus:outline-none">
            🛒 
            {items.length > 0 && (
              <span className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-black border-2 border-white shadow-lg">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* OVERLAY SFUMATO (Z-INDEX ALTISSIMO) */}
      {(isSidebarOpen || isCartOpen) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[900] animate-in fade-in" onClick={() => { setIsSidebarOpen(false); closeCart(); }} />
      )}

      {/* MENU SINISTRO (ANDROID ADAPTED) */}
      <div className={`fixed top-0 left-0 h-full w-4/5 max-w-[350px] bg-white z-[999] shadow-2xl transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} overflow-y-auto`}>
        <div className="p-6 bg-stone-900 text-white flex justify-between items-center">
          <p className="font-bold truncate text-sm">{user?.email || 'Ospite'}</p>
          <button onClick={() => setIsSidebarOpen(false)} className="text-2xl">✕</button>
        </div>
        <div className="p-6 space-y-6">
          <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="block w-full bg-emerald-500 text-white text-center py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-md md:hidden">➕ Pubblica Annuncio</Link>
          <Link href="/profile" className="block p-3 font-bold text-stone-800 bg-stone-50 rounded-xl">👤 Il mio Profilo</Link>
          <Link href="/dashboard/acquisti" className="block p-3 font-bold text-stone-800 bg-stone-50 rounded-xl">📦 Ordini (Escrow)</Link>
          <Link href="/dashboard/preferiti" className="block p-3 font-bold text-stone-800 bg-stone-50 rounded-xl">❤️ Preferiti</Link>
        </div>
      </div>

      {/* CARRELLO DESTRO (ANDROID ADAPTED) */}
      <div className={`fixed top-0 right-0 h-full w-4/5 max-w-[400px] bg-white z-[999] shadow-2xl transition-transform duration-300 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        <div className="p-6 flex justify-between items-center border-b pb-4">
          <h2 className="text-2xl font-black uppercase italic text-stone-900">Carrello</h2>
          <button onClick={closeCart} className="text-2xl">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? <p className="text-center text-stone-400 py-10 italic">Vuoto...</p> : 
            items.map((item) => (
              <div key={item.id} className="flex gap-4 p-3 bg-stone-50 rounded-2xl border border-stone-100 relative">
                <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs font-black shadow-md">✕</button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black uppercase truncate text-stone-900">{item.title}</p>
                  <p className="text-xs text-emerald-600 font-black mt-1">€ {item.price} x {item.quantity}</p>
                </div>
              </div>
            ))
          }
        </div>
        <div className="p-6 border-t bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="font-black text-xs uppercase text-stone-400">Totale</span>
            <span className="text-2xl font-black text-stone-900">€ {total.toFixed(2)}</span>
          </div>
          <button className="w-full bg-stone-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest">
            Conferma Pagamento
          </button>
        </div>
      </div>
    </>
  )
}