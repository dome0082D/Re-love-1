'use client'
import { useEffect, useState } from 'react'
import { supabase } from './../lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    let results = announcements
    if (searchTerm) {
      results = results.filter(ann => 
        ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ann.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    if (activeFilter === 'free') results = results.filter(ann => ann.price === 0)
    else if (activeFilter === 'paid') results = results.filter(ann => ann.price > 0)
    setFilteredAnnouncements(results)
  }, [searchTerm, activeFilter, announcements])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) {
      setAnnouncements(data)
      setFilteredAnnouncements(data)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-3 md:p-6">
      {/* CONTENITORE PRINCIPALE EFFETTO 3D SOLLEVATO */}
      <main className="bg-white max-w-[1400px] mx-auto rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white/20 min-h-screen overflow-hidden flex flex-col relative">
        
        {/* NAVBAR */}
        <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-100 px-8 py-5">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-serif text-slate-800 tracking-tighter font-bold hover:scale-105 transition-transform">
              MATERIALI
            </Link>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link href="/profile" className="text-xs font-semibold text-slate-500 hover:text-sky-500 transition-colors uppercase tracking-wider">
                    Profilo
                  </Link>
                  <Link href="/add" className="bg-slate-800 text-white px-6 py-2.5 rounded-2xl text-xs font-bold hover:shadow-lg active:scale-95 transition-all shadow-md">
                    + PUBBLICA
                  </Link>
                  <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-slate-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
                </>
              ) : (
                <Link href="/register" className="bg-sky-500 text-white px-7 py-3 rounded-2xl text-xs font-bold hover:bg-sky-400 shadow-[0_10px_20px_rgba(14,165,233,0.3)] transition-all active:scale-95">
                  ACCEDI
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* HERO SECTION 3D */}
        <div className="px-6 md:px-12 mt-8">
          <div className="relative h-[350px] md:h-[450px] rounded-[3rem] overflow-hidden shadow-2xl group border-4 border-white">
            <img 
              src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?q=80&w=1920&auto=format&fit=crop" 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent flex flex-col items-center justify-center text-center p-6">
              <h2 className="text-4xl md:text-6xl font-serif text-white mb-4 tracking-tighter drop-shadow-2xl font-bold">
                Costruisci il domani.
              </h2>
              <p className="mb-10 text-white/80 max-w-lg mx-auto text-sm md:text-lg font-light italic">
                Recupera, regala o vendi. Il valore non si butta mai.
              </p>
              
              <div className="w-full max-w-xl relative group/search">
                <input 
                  type="text" 
                  placeholder="Cosa stai cercando oggi?" 
                  className="w-full p-5 pl-14 rounded-[2rem] text-slate-800 shadow-2xl outline-none focus:ring-4 focus:ring-sky-400/20 transition-all text-base border-none"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-6 top-5 text-2xl group-focus-within/search:scale-110 transition-transform">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENUTO */}
        <div className="px-6 md:px-12 py-16 flex-grow">
          
          {/* FILTRI STILE PILLOLA 3D */}
          <div className="flex gap-4 mb-12 overflow-x-auto pb-4 scrollbar-hide">
            {['all', 'free', 'paid'].map((f) => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)} 
                className={`px-8 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all shadow-sm border ${
                  activeFilter === f 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xl -translate-y-1' 
                  : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'
                }`}
              >
                {f === 'all' ? 'Tutti' : f === 'free' ? 'In Regalo' : 'In Vendita'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-bounce text-4xl">🏗️</div></div>
          ) : filteredAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
              {filteredAnnouncements.map((ann) => (
                <div key={ann.id} className="bg-white rounded-[2.5rem] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12)] hover:-translate-y-3 transition-all duration-500 border border-slate-50 flex flex-col group">
                  <div className="relative mb-5 overflow-hidden rounded-[2rem] h-56 shadow-inner">
                    <img 
                      src={ann.image_url || "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?q=80&w=500"} 
                      alt={ann.title} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                    <div className="absolute bottom-4 left-4">
                      <span className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-tighter shadow-lg backdrop-blur-md ${ann.price === 0 ? 'bg-teal-500 text-white' : 'bg-white text-slate-800'}`}>
                        {ann.price === 0 ? 'GRATIS' : `€ ${ann.price}`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="px-3 pb-4 flex flex-col flex-grow">
                    <h4 className="text-xl font-serif text-slate-800 mb-2 truncate font-bold tracking-tight">{ann.title}</h4>
                    <p className="text-slate-400 text-xs mb-8 line-clamp-2 font-medium leading-relaxed">
                      {ann.description || "Contatta l'inserzionista per questo materiale unico."}
                    </p>
                    <div className="mt-auto">
                      <a 
                        href={`mailto:${ann.contact_email}?subject=Interessato: ${ann.title}`}
                        className="block text-center w-full bg-slate-50 text-slate-700 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-500 hover:text-white hover:shadow-[0_10px_20px_rgba(14,165,233,0.3)] transition-all"
                      >
                        Invia Richiesta
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest italic">Cantiere vuoto... prova un'altra ricerca!</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-auto py-10 border-t border-slate-50 text-center">
          <p className="text-[9px] text-slate-300 font-bold tracking-[0.3em] uppercase">© 2026 Materiali Edili • Sustainable Building</p>
        </footer>

      </main>
    </div>
  )
}
