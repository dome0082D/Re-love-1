'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Controlla utente loggato all'avvio
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (err) {
        // FIX: senza questo, un fallimento di rete nel controllare la sessione
        // (Android instabile) lasciava "user" bloccato su null per sempre -
        // la navbar mostrava "Accedi/Registrati" anche per chi era già
        // loggato, senza nessun tentativo di recupero.
        console.error('Errore controllo utente:', err)
      }
    }
    checkUser()

    // Ascolta i cambiamenti di stato (login/logout)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => {
      // FIX: aggiunto controllo di sicurezza prima di chiamare unsubscribe -
      // se per qualche motivo authListener non fosse valorizzato, la pagina
      // sarebbe andata in errore alla chiusura del componente.
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Errore durante il logout:', error)
      }
    } catch (err) {
      console.error('Errore durante il logout:', err)
    }
    // FIX: reindirizziamo e chiudiamo i menu comunque, anche se il signOut
    // lato server fosse fallito - lato client l'utente si aspetta che il
    // tap su "Esci" lo porti sempre fuori, e un secondo tentativo di
    // logout (che troverebbe comunque una sessione da chiudere) è più
    // semplice da gestire di un pulsante che sembra non fare nulla.
    router.push('/')
    setIsOpen(false)
    setIsDropdownOpen(false)
  }

  // Chiude il menu mobile se lo schermo viene allargato
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setIsOpen(false) }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <nav className="bg-white border-b border-stone-200 sticky top-0 z-[100] shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* LOGO */}
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-3xl font-black uppercase italic tracking-tighter text-stone-900">
              Materiali
            </Link>
          </div>

          {/* DESKTOP MENU */}
          <div className="hidden md:flex items-center space-x-8">
            
            {/* Esplora */}
            <div className="flex space-x-6">
              <Link href="/?type=offered" className="text-[11px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-500 transition-colors flex items-center gap-1">
                🎁 Solo in Regalo
              </Link>
              <Link href="/" className="text-[11px] font-black uppercase tracking-widest text-stone-600 hover:text-stone-900 transition-colors">
                Tutte le Categorie
              </Link>
            </div>

            {/* Supporto */}
            <div className="flex space-x-6 border-l border-stone-200 pl-6">
              <Link href="/protezione" className="text-[11px] font-black uppercase tracking-widest text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1">
                🛡️ Protezione Acquisti
              </Link>
            </div>

            {/* Azione Principale & Utente */}
            <div className="flex items-center space-x-4 pl-6 border-l border-stone-200">
              <Link href="/add" className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm">
                ➕ Pubblica
              </Link>

              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                  >
                    👤 Il mio Account
                  </button>

                  {/* DROPDOWN DESKTOP CON DISSOLVENZA */}
                  <div className={`absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden transition-all duration-200 origin-top-right ${isDropdownOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                    <div className="p-4 border-b border-stone-100 bg-stone-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Loggato come</p>
                      <p className="text-xs font-bold text-stone-900 truncate">{user.email}</p>
                    </div>
                    <div className="p-2 space-y-1">
                      <Link href="/profile" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors">Il mio Profilo</Link>
                      <Link href="/dashboard/acquisti" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors">I miei Ordini (Escrow)</Link>
                      <Link href="/chat" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors flex justify-between items-center">
                        Messaggi <span className="bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full">New</span>
                      </Link>
                      <Link href="/dashboard/preferiti" onClick={() => setIsDropdownOpen(false)} className="block px-4 py-3 text-xs font-bold text-stone-700 hover:bg-stone-100 hover:text-stone-900 rounded-xl transition-colors">I miei Preferiti ❤️</Link>
                    </div>
                    <div className="p-2 border-t border-stone-100">
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-xs font-bold text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors">Esci dall'account</button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link href="/login" className="bg-stone-900 text-white px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-800 transition-all shadow-sm">
                  Accedi / Registrati
                </Link>
              )}
            </div>
          </div>

          {/* HAMBURGER MENU BUTTON (MOBILE) */}
          <div className="md:hidden flex items-center gap-3">
            <Link href="/add" className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm">
              ➕ Vendi
            </Link>
            <button onClick={() => setIsOpen(!isOpen)} className="text-stone-900 p-2 focus:outline-none">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE SIDEBAR (EFFETTO FADE E SLIDE) */}
      <div className={`md:hidden fixed inset-0 z-[90] transition-all duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        {/* Sfondo scuro */}
        <div className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
        
        {/* Pannello Menu Laterale */}
        <div className={`absolute top-0 right-0 h-full w-4/5 max-w-sm bg-white shadow-2xl flex flex-col transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          
          <div className="p-6 border-b border-stone-100 bg-stone-50 flex justify-between items-center">
             <span className="text-xl font-black uppercase italic tracking-tighter text-stone-900">Menu</span>
             <button onClick={() => setIsOpen(false)} className="text-stone-400 font-bold p-2">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Azione Principale Mobile */}
            <div>
              <Link href="/add" onClick={() => setIsOpen(false)} className="block w-full text-center bg-emerald-500 text-white px-6 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-md">
                ➕ Pubblica Annuncio
              </Link>
            </div>

            {/* Area Utente Mobile */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Area Utente</h3>
              {user ? (
                <div className="space-y-2">
                  <Link href="/profile" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 rounded-xl">👤 Il mio Profilo / Annunci</Link>
                  <Link href="/dashboard/acquisti" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 rounded-xl">📦 I miei Ordini</Link>
                  <Link href="/chat" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 rounded-xl flex justify-between">💬 Messaggi <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full">New</span></Link>
                  <Link href="/dashboard/preferiti" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800 bg-stone-50 rounded-xl">❤️ I miei Preferiti</Link>
                  <button onClick={handleLogout} className="w-full text-left p-3 text-sm font-bold text-red-500 bg-red-50 rounded-xl mt-4">Esci dall'account</button>
                </div>
              ) : (
                <Link href="/login" onClick={() => setIsOpen(false)} className="block w-full text-center bg-stone-900 text-white px-6 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-sm">
                  Accedi / Registrati
                </Link>
              )}
            </div>

            {/* Esplora Mobile */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Esplora</h3>
              <div className="space-y-2">
                <Link href="/" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800">Tutte le Categorie</Link>
                <Link href="/?type=offered" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-black text-emerald-600 bg-emerald-50 rounded-xl">🎁 Solo in Regalo</Link>
              </div>
            </div>

            {/* Supporto & Sicurezza */}
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4 border-b border-stone-100 pb-2">Supporto & Sicurezza</h3>
              <div className="space-y-2">
                <Link href="/come-funziona" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800">Come funziona</Link>
                <Link href="/protezione" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800 flex items-center gap-2">🛡️ Protezione Acquisti</Link>
                <Link href="/faq" onClick={() => setIsOpen(false)} className="block p-3 text-sm font-bold text-stone-800">Assistenza / FAQ</Link>
              </div>
            </div>

            {/* Legale */}
            <div className="pt-6 border-t border-stone-100 flex gap-4 justify-center">
              <Link href="/termini" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-stone-400 hover:text-stone-600">Termini e Condizioni</Link>
              <Link href="/privacy" onClick={() => setIsOpen(false)} className="text-[10px] font-bold text-stone-400 hover:text-stone-600">Privacy Policy</Link>
            </div>

          </div>
        </div>
      </div>
    </nav>
  )
}
