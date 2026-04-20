'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/store/cartStore'

export default function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // STATO GLOBALE CARRELLO
  const { items, isCartOpen, openCart, closeCart, removeItem } = useCartStore()
  
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

  const handleCheckout = async () => {
    if (!user) { alert("Devi accedere per completare l'acquisto"); return; }
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
        alert("Errore Checkout Stripe");
        setLoading(false);
      }
    } catch (err) {
      alert("Errore connessione");
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-[100] shadow-sm flex justify-between items-center h-24 px-6 md:px-10">
        <div className="flex items-center gap-4 md:gap-10">
          <button onClick={() => setIsSidebarOpen(true)} className="text-4xl p-2 hover:bg-stone-50 rounded-2xl transition-all focus:outline-none">☰</button>
          {/* LOGO AGGIORNATO IN CORSIVO */}
          <Link href="/" className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-stone-900 select-none">
            LIBERO SCAMBIO
          </Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/add" className="hidden lg:block bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-100">
            ➕ Pubblica Annuncio
          </Link>
          <button onClick={openCart} className="relative text-4xl p-4 hover:bg-stone-50 rounded-3xl transition-all focus:outline-none">
            🛒 
            {items.length > 0 && (
              <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[11px] w-7 h-7 flex items-center justify-center rounded-full font-black border-4 border-white shadow-lg">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* OVERLAY SFUMATO */}
      {(isSidebarOpen || isCartOpen) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] transition-opacity animate-in fade-in duration-500" 
             onClick={() => { setIsSidebarOpen(false); closeCart(); }} />
      )}

      {/* SIDEBAR SINISTRA (AMAZON STYLE) */}
      <div className={`fixed top-0 left-0 h-full w-full max-w-[400px] bg-white z-[120] shadow-2xl transition-transform duration-500 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-10 bg-stone-900 text-white">
            <div className="flex justify-between items-start mb-8">
              <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center text-3xl font-black italic shadow-2xl shadow-emerald-500/20">
                {user?.email ? user.email[0].toUpperCase() : 'L'}
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-stone-500 hover:text-white text-3xl transition-colors">✕</button>
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-2 italic">Area Personale</p>
            <p className="font-bold truncate text-xl tracking-tight">{user?.email || 'Ospite Benvenuto'}</p>
          </div>

          <div className="flex-1 overflow-y-auto p-10 space-y-12">
            <section>
              <h3 className="text-[11px] font-black uppercase text-stone-400 mb-6 tracking-[0.4em] border-b pb-3">Marketplace</h3>
              <div className="grid gap-3">
                <Link href="/add" onClick={() => setIsSidebarOpen(false)} className="block w-full bg-emerald-500 text-white text-center py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-md lg:hidden mb-4">➕ Pubblica Annuncio</Link>
                <Link href="/profile" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-5 p-4 text-sm font-bold text-stone-800 hover:bg-stone-50 rounded-2xl transition-all">👤 Il mio Profilo / Modifica</Link>
                <Link href="/dashboard/annunci" onClick={() => setIsSidebarOpen(false)} className="p-4 text-sm font-bold text-stone-800 hover:bg-stone-50 rounded-2xl transition-all">📝 Gestione Annunci</Link>
                <Link href="/dashboard/acquisti" onClick={() => setIsSidebarOpen(false)} className="p-4 text-sm font-bold text-stone-800 hover:bg-stone-50 rounded-2xl transition-all flex justify-between">📦 Ordini (Escrow) <span className="bg-stone-900 text-white text-[8px] px-2 py-0.5 rounded-full">LIVE</span></Link>
                <Link href="/chat" onClick={() => setIsSidebarOpen(false)} className="p-4 text-sm font-bold text-stone-800 hover:bg-stone-50 rounded-2xl transition-all flex justify-between">💬 Messaggi Privati <span className="bg-emerald-500 text-white text-[9px] px-2 py-1 rounded-full font-black">NEW</span></Link>
                <Link href="/dashboard/preferiti" onClick={() => setIsSidebarOpen(false)} className="p-4 text-sm font-bold text-stone-800 hover:bg-stone-50 rounded-2xl transition-all">❤️ La mia Lista Desideri</Link>
                {user && <button onClick={handleLogout} className="w-full text-left p-4 text-sm font-black text-red-500 hover:bg-red-50 rounded-2xl mt-6 uppercase tracking-widest italic transition-all">← Esci dall'account</button>}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-black uppercase text-stone-400 mb-6 tracking-[0.4em] border-b pb-3">Categorie Materiali</h3>
              <div className="grid gap-2">
                {categories.map((cat) => (
                  <Link key={cat.id} href={`/?cat=${cat.slug}`} onClick={() => setIsSidebarOpen(false)} className="p-4 text-sm font-bold text-stone-700 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all">
                    {cat.name}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[11px] font-black uppercase text-stone-400 mb-6 tracking-[0.4em] border-b pb-3">Assistenza Tecnica</h3>
              <div className="grid gap-2">
                <Link href="/protezione" onClick={() => setIsSidebarOpen(false)} className="p-4 text-xs font-bold text-stone-500 hover:text-stone-900 flex items-center gap-3">🛡️ Protezione Acquisti Stripe</Link>
                <Link href="/come-funziona" onClick={() => setIsSidebarOpen(false)} className="p-4 text-xs font-bold text-stone-500 hover:text-stone-900">Come Funziona il Marketplace</Link>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* DRAWER CARRELLO (RIGHT DRAWER) */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[450px] bg-white z-[120] shadow-2xl transition-transform duration-500 ease-in-out transform ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-10 flex flex-col h-full">
          <div className="flex justify-between items-center mb-12 border-b-2 border-stone-50 pb-8">
            <h2 className="text-3xl font-black uppercase italic tracking-tighter text-stone-900">Il tuo Carrello</h2>
            <button onClick={closeCart} className="text-stone-400 hover:text-stone-900 text-3xl font-bold bg-stone-50 w-12 h-12 flex items-center justify-center rounded-full transition-all">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {items.length === 0 ? (
              <div className="text-center py-32 opacity-25">
                <span className="text-7xl block mb-6">🛒</span>
                <p className="text-xs font-black uppercase tracking-[0.4em]">Carrello vuoto</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex gap-6 p-6 bg-stone-50 rounded-[2.5rem] border border-stone-100 group relative hover:border-emerald-200 transition-all">
                  <button onClick={() => removeItem(item.id)} className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full text-xs font-black shadow-xl hover:scale-110 transition-transform">✕</button>
                  <div className="w-20 h-20 bg-white rounded-2xl overflow-hidden border border-stone-100 flex-shrink-0">
                    <img src={item.image_url || '/nuovo.png'} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-xs font-black uppercase truncate text-stone-900 mb-1">{item.title}</p>
                    <p className="text-lg font-black text-emerald-600">€ {item.price} <span className="text-stone-400 text-[10px] ml-2 font-bold uppercase tracking-widest">x {item.quantity}</span></p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-auto pt-10 border-t-2 border-stone-50 bg-white">
            <div className="flex justify-between items-center mb-10 px-2">
              <span className="font-black text-xs uppercase tracking-[0.3em] text-stone-400">Totale Ordine</span>
              <span className="text-4xl font-black text-stone-900 tracking-tighter">€ {total.toFixed(2)}</span>
            </div>
            <button 
              onClick={handleCheckout}
              disabled={items.length === 0 || loading} 
              className="w-full bg-stone-900 text-white py-7 rounded-[2.5rem] font-black uppercase text-[12px] tracking-[0.3em] shadow-2xl hover:bg-emerald-600 transition-all disabled:opacity-20 active:scale-95"
            >
              {loading ? 'Sincronizzazione Stripe...' : 'Procedi al Pagamento Sicuro'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
