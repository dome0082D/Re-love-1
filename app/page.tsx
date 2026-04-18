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
    // Filtro Ricerca testuale
    if (searchTerm) {
      results = results.filter(ann => 
        ann.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ann.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    // Filtro Tipo
    if (activeFilter === 'offered') results = results.filter(ann => ann.type === 'offered' || !ann.type)
    if (activeFilter === 'wanted') results = results.filter(ann => ann.type === 'wanted')
    
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
    <div className="min-h-screen bg-[#f3f4f6] p-2 md:p-4 font-sans text-slate-900">
      <main className="bg-white max-w-[1600px] mx-auto rounded-xl shadow-lg border border-gray-200 min-h-screen overflow-hidden flex flex-col relative">
        
        {/* NAVBAR PROFESSIONALE */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm">
          <Link href="/" className="text-2xl font-serif text-slate-900 tracking-tighter font-black">MATERIALI</Link>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/profile" className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-sky-600 uppercase tracking-widest transition-colors bg-slate-100 px-4 py-2 rounded-md">
                  <span>👤</span> Profilo Utente
                </Link>
                <Link href="/add" className="bg-sky-600 text-white px-5 py-2 rounded-md text-xs font-bold hover:bg-sky-500 transition-all shadow-sm">
                  + Inserisci Annuncio
                </Link>
                <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="text-slate-400 hover:text-red-500 transition-colors" title="Esci">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                </button>
              </>
            ) : (
              <Link href="/register" className="bg-slate-800 text-white px-6 py-2 rounded-md text-xs font-bold hover:bg-slate-700 shadow-sm">ACCEDI</Link>
            )}
          </div>
        </nav>

        {/* HEADER / HERO SECTION */}
        <div className="px-4 md:px-8 mt-6">
          <div className="relative h-[250px] md:h-[350px] rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <img src="/gazebo.png" alt="Gazebo Attrezzi" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/30 flex flex-col items-start justify-center p-8 md:p-16">
              <h1 className="text-3xl md:text-5xl font-serif text-white drop-shadow-md font-bold leading-tight mb-4">
                Il mercato edile circolare.
              </h1>
              
              <div className="w-full max-w-xl relative mt-4">
                <input 
                  type="text" 
                  placeholder="Cerca materiali o attrezzi..." 
                  className="w-full p-4 pl-12 rounded-lg bg-white/95 text-slate-800 shadow-md outline-none focus:ring-2 focus:ring-sky-500 border border-gray-200"
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-4 top-4 text-xl opacity-50">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* DUE RIQUADRI PROMOZIONALI (NUOVO / USATO) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 md:px-8 mt-6">
          
          {/* Riquadro Usato */}
          <div className="relative h-[180px] md:h-[220px] rounded-xl overflow-hidden shadow-sm group border border-gray-200">
            <img src="/usato.png" alt="Mercatino Usato" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[5s] group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center p-6">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-white text-center drop-shadow-lg tracking-wide">
                "Non buttare, magari ad un altro serve"
              </h3>
            </div>
          </div>

          {/* Riquadro Nuovo */}
          <div className="relative h-[180px] md:h-[220px] rounded-xl overflow-hidden shadow-sm group border border-gray-200">
            <img src="/nuovo.png" alt="Negozio Nuovo" className="absolute inset-0 w-full h-full object-cover transition-transform duration-[5s] group-hover:scale-110" />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center p-6">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-white text-center drop-shadow-lg tracking-wide">
                "È nuovo?, vendilo"
              </h3>
            </div>
          </div>

        </div>

        {/* TABELLA ANNUNCI (GRANDE CATALOGO) */}
        <div className="px-4 md:px-8 py-10 flex-grow">
          
          <div className="flex justify-between items-end mb-8 border-b border-gray-200 pb-4">
            <h2 className="text-xl font-bold uppercase tracking-widest text-slate-800">Catalogo Annunci</h2>
            <div className="flex gap-2 overflow-x-auto">
              <button onClick={() => setActiveFilter('all')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest border ${activeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500 border-gray-300'}`}>Tutti</button>
              <button onClick={() => setActiveFilter('offered')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest border ${activeFilter === 'offered' ? 'bg-sky-600 text-white' : 'bg-white text-slate-500 border-gray-300'}`}>Disponibili</button>
              <button onClick={() => setActiveFilter('wanted')} className={`px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest border ${activeFilter === 'wanted' ? 'bg-orange-500 text-white' : 'bg-white text-slate-500 border-gray-300'}`}>Cercasi</button>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-sky-500 border-t-transparent rounded-full"></div></div>
          ) : filteredAnnouncements.length > 0 ? (
            /* GRIGLIA ALLARGATA (Fino a 5 colonne su schermi grandi) */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {filteredAnnouncements.map((ann) => (
                <div key={ann.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all border border-gray-200 flex flex-col">
                  <div className="relative p-2 h-40">
                    <img src={ann.image_url || "/gazebo.png"} className="w-full h-full object-cover rounded-md border border-gray-100" />
                    <div className="absolute top-4 right-4">
                      <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-tighter shadow-sm ${ann.type === 'wanted' ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                        {ann.type === 'wanted' ? 'CERCASI' : 'OFFRESI'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tighter line-clamp-1" title={ann.title}>{ann.title}</h4>
                    </div>
                    <p className="text-slate-500 text-[10px] mb-4 line-clamp-2 leading-relaxed h-8">{ann.description}</p>
                    
                    <div className="mt-auto flex items-center justify-between">
                      <span className="font-black text-slate-800 text-sm">
                        {ann.price === 0 ? 'GRATIS' : `€ ${ann.price}`}
                      </span>
                      <a href={`mailto:${ann.contact_email}`} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider hover:bg-sky-600 hover:text-white transition-all">Contatta</a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Nessun annuncio presente nel catalogo</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}