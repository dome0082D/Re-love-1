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
    <div className="min-h-screen bg-[#e5e7eb] p-2 md:p-4 font-sans">
      
      {/* CONTENITORE PRINCIPALE - BORDI MENO SMUSSATI */}
      <main className="bg-white max-w-[1400px] mx-auto rounded-xl shadow-xl border border-gray-200 min-h-screen overflow-hidden flex flex-col relative">
        
        {/* NAVBAR */}
        <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-xl font-serif text-slate-800 tracking-tighter font-black">
              MATERIALI
            </Link>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link href="/profile" className="text-xs font-bold text-slate-500 hover:text-sky-600 uppercase tracking-widest">
                    Profilo
                  </Link>
                  <Link href="/add" className="bg-slate-800 text-white px-5 py-2 rounded-md text-xs font-bold hover:bg-slate-700 transition-all shadow-sm">
                    + PUBBLICA
                  </Link>
                  <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-slate-400 hover:text-red-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
                </>
              ) : (
                <Link href="/register" className="bg-sky-600 text-white px-6 py-2 rounded-md text-xs font-bold hover:bg-sky-500 shadow-sm transition-all">
                  ACCEDI
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* HERO SECTION - IMMAGINE OTTIMIZZATA */}
        <div className="px-4 md:px-8 mt-6">
          <div className="relative h-[300px] md:h-[400px] rounded-xl overflow-hidden shadow-lg border border-gray-100">
            <img 
              src="/cantiere.jpg" 
              alt="Cantiere Edile" 
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center p-6">
              <p className="text-2xl md:text-4xl font-serif text-white max-w-3xl mx-auto drop-shadow-lg font-bold italic leading-tight">
                Recupera, regala o vendi. <br className="hidden md:block" /> Il valore non si butta mai.
              </p>
              
              {/* BARRA DI RICERCA GRIGIO CHIARO */}
              <div className="w-full max-w-xl mt-8 relative">
                <input 
                  type="text" 
                  placeholder="Cerca materiali (es. mattoni, legno...)" 
                  className="w-full p-4 pl-12 rounded-lg bg-slate-100/95 text-slate-800 shadow-inner outline-none focus:ring-2 focus:ring-sky-500 transition-all text-base border border-gray-200"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-4 top-4 text-xl opacity-50">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENUTO */}
        <div className="px-4 md:px-10 py-12 flex-grow">
          
          {/* FILTRI SQUADRATI */}
          <div className="flex gap-2 mb-10 overflow-x-auto pb-2">
            {['all', 'free', 'paid'].map((f) => (
              <button 
                key={f}
                onClick={() => setActiveFilter(f)} 
                className={`px-6 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  activeFilter === f 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                  : 'bg-white text-slate-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f === 'all' ? 'Tutti' : f === 'free' ? 'In Regalo' : 'In Vendita'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full"></div></div>
          ) : filteredAnnouncements.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAnnouncements.map((ann) => (
                <div key={ann.id} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 flex flex-col group">
                  <div className="relative p-2">
                    <img 
                      src={ann.image_url || "https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?q=80&w=500"} 
                      alt={ann.title} 
                      className="w-full h-48 object-cover rounded-lg" 
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`px-3 py-1 rounded-md text-[9px] font-bold tracking-widest shadow-sm ${ann.price === 0 ? 'bg-teal-600 text-white' : 'bg-white/90 text-slate-800'}`}>
                        {ann.price === 0 ? 'GRATIS' : `€ ${ann.price}`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 flex flex-col flex-grow">
                    <h4 className="text-lg font-serif text-slate-800 mb-1 truncate font-bold">{ann.title}</h4>
                    <p className="text-slate-500 text-xs mb-6 line-clamp-2 font-medium">
                      {ann.description || "Contatta l'inserzionista per maggiori dettagli."}
                    </p>
                    <div className="mt-auto">
                      <a 
                        href={`mailto:${ann.contact_email}?subject=Interessato: ${ann.title}`}
                        className="block text-center w-full bg-slate-100 text-slate-700 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-sky-600 hover:text-white transition-all"
                      >
                        Invia Richiesta
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Nessun materiale trovato</p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <footer className="mt-auto py-8 border-t border-gray-100 text-center">
          <p className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">© 2026 MATERIALI EDILI • HUB SOSTENIBILE</p>
        </footer>

      </main>
    </div>
  )
}
