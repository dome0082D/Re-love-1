'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // STATI RICERCA E FILTRI AVANZATI
  const [searchTerm, setSearchTerm] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [searchModel, setSearchModel] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [category, setCategory] = useState('all')
  const [condition, setCondition] = useState('all') // Nuovo filtro
  const [maxPrice, setMaxPrice] = useState('') // Nuovo filtro
  const [sortBy, setSortBy] = useState('recent') // Nuovo filtro
  
  // STATI PER STAFF E PREVISIONE TESTO
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  // MOTORE DI RICERCA BLINDATO (ANTI-CRASH)
  useEffect(() => {
    let res = [...announcements]; // Crea una copia sicura dell'array

    // 1. Filtro Globale (Testo)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      res = res.filter(a => 
        (a.title || '').toLowerCase().includes(term) ||
        (a.description || '').toLowerCase().includes(term) ||
        (a.brand || '').toLowerCase().includes(term) ||
        (a.category || '').toLowerCase().includes(term) ||
        (a.model || '').toLowerCase().includes(term)
      );

      // Genera Suggerimenti
      const matches = new Set<string>();
      announcements.forEach(a => {
        if (a.title && a.title.toLowerCase().includes(term)) matches.add(a.title);
        if (a.brand && a.brand.toLowerCase().includes(term)) matches.add(a.brand);
      });
      setSuggestions(Array.from(matches).slice(0, 5));
    } else {
      setSuggestions([]);
    }

    // 2. Filtri Specifici Testuali
    if (searchBrand) res = res.filter(a => (a.brand || '').toLowerCase().includes(searchBrand.toLowerCase()));
    if (searchModel) res = res.filter(a => (a.model || '').toLowerCase().includes(searchModel.toLowerCase()));
    
    // 3. Filtri a Tendina
    if (activeType !== 'all') res = res.filter(a => (a.type || '') === activeType);
    if (category !== 'all') res = res.filter(a => (a.category || '') === category);
    
    // NB: Se un annuncio vecchio non ha "condition", diamo per scontato che sia "Usato"
    if (condition !== 'all') res = res.filter(a => (a.condition || 'Usato') === condition);
    
    // 4. Filtro Prezzo Max
    if (maxPrice) res = res.filter(a => (a.price || 0) <= parseFloat(maxPrice));

    // 5. Ordinamento (Sorting)
    if (sortBy === 'price_asc') {
      res.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price_desc') {
      res.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else {
      // 'recent' (Default)
      res.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    setFiltered(res);
  }, [searchTerm, searchBrand, searchModel, activeType, category, condition, maxPrice, sortBy, announcements])

  const fetchData = async () => {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) { setAnnouncements(data); setFiltered(data); }
    setLoading(false)
  }

  const deleteAd = async (id: string) => {
    if(!confirm("ELIMINA: Sei sicuro?")) return
    await supabase.from('announcements').delete().eq('id', id)
    fetchData()
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 selection:bg-emerald-200 overflow-x-hidden">
      
      {/* MENU STAFF FISSO */}
      {IS_STAFF && (
        <>
          <button onClick={() => setIsStaffMenuOpen(true)} className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white w-14 h-14 rounded-full shadow-lg font-black text-xl hover:scale-110 transition-all flex items-center justify-center">👑</button>
          <div className={`fixed top-0 right-0 h-full w-80 bg-stone-900 z-[60] transform transition-transform duration-500 ease-out ${isStaffMenuOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl p-6 text-stone-100`}>
            <div className="flex justify-between mb-8 border-b border-stone-800 pb-4 items-center">
              <span className="font-bold uppercase tracking-widest text-xs">Pannello Staff</span>
              <button onClick={() => setIsStaffMenuOpen(false)} className="text-stone-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <Link href="/profile" className="block p-4 bg-stone-800 rounded-lg font-bold hover:bg-emerald-600 text-[10px] tracking-widest text-center transition-all">GESTIONE UTENTI</Link>
              <Link href="/chat" className="block p-4 bg-stone-800 rounded-lg font-bold hover:bg-emerald-600 text-[10px] tracking-widest text-center transition-all">MONITORAGGIO CHAT</Link>
            </div>
          </div>
          {isStaffMenuOpen && <div onClick={() => setIsStaffMenuOpen(false)} className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[55]"></div>}
        </>
      )}

      <main className="max-w-[1400px] mx-auto bg-white min-h-screen shadow-2xl flex flex-col">
        <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-black italic uppercase text-stone-800 tracking-widest">MATERIALI</Link>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <Link href="/chat" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase p-2 bg-stone-100 rounded-md">💬 Chat</Link>
                <Link href="/profile" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase p-2 bg-stone-100 rounded-md">👤 Profilo</Link>
                <Link href="/add" className="bg-emerald-600 text-white px-6 py-2.5 rounded-md text-[11px] font-black uppercase shadow-md hover:bg-emerald-700 transition-all">+ Pubblica</Link>
              </>
            ) : (
              <Link href="/register" className="bg-stone-900 text-white px-8 py-3 rounded-md text-[11px] font-black uppercase shadow-md">Accedi</Link>
            )}
          </div>
        </nav>

        {/* 1. HERO CON RICERCA E PREVISIONE TESTO */}
        <div className="px-6 mt-6">
          <div className="relative h-[400px] rounded-3xl overflow-visible border shadow-lg z-30">
            <img src="/gazebo.jpg" alt="Gazebo" className="absolute inset-0 w-full h-full object-cover rounded-3xl" />
            <div className="absolute inset-0 bg-stone-900/60 flex flex-col items-center justify-center p-8 text-center rounded-3xl">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-8 italic uppercase drop-shadow-lg">Recupera, Regala, Vendi</h1>
              
              <div className="w-full max-w-2xl relative">
                <input 
                  type="text" 
                  value={searchTerm}
                  placeholder="Cerca materiali o attrezzi..." 
                  className="w-full p-5 pl-14 rounded-2xl bg-white shadow-2xl outline-none text-lg text-stone-800 focus:ring-4 focus:ring-emerald-500/50 transition-all" 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                <span className="absolute left-5 top-5 text-2xl opacity-40">🔍</span>

                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-stone-100 overflow-hidden text-left z-50">
                    {suggestions.map((s, i) => (
                      <div 
                        key={i} 
                        className="p-4 hover:bg-stone-50 cursor-pointer font-bold text-stone-700 border-b border-stone-100 last:border-0 truncate"
                        onClick={() => { setSearchTerm(s); setShowSuggestions(false); }}
                      >
                        🔍 {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. RIQUADRI USATO/NUOVO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 mt-8 relative z-10">
          <div className="relative h-[220px] rounded-2xl overflow-hidden group shadow-md">
            <img src="/usato.png" alt="Usato" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl font-black text-white uppercase italic">"Non buttare, magari ad un altro serve"</h3>
            </div>
          </div>
          <div className="relative h-[220px] rounded-2xl overflow-hidden group shadow-md">
            <img src="/nuovo.png" alt="Nuovo" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-stone-900/50 flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl font-black text-white uppercase italic">"È nuovo?, vendilo"</h3>
            </div>
          </div>
        </div>

        {/* 3. RICERCA AVANZATA (Potenziata) */}
        <div className="mx-6 mt-10 p-6 bg-stone-50 rounded-3xl border border-stone-200 shadow-sm flex flex-col gap-4">
          <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-1">Ricerca Avanzata</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" value={searchTerm} placeholder="Cerca Parola Chiave..." className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchTerm(e.target.value)} />
            <input type="text" placeholder="Marca" className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchBrand(e.target.value)} />
            <input type="text" placeholder="Modello" className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchModel(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <select onChange={(e)=>setCategory(e.target.value)} className="p-3 bg-white border border-stone-200 rounded-lg text-[11px] font-black uppercase outline-none focus:border-emerald-500 shadow-sm text-stone-700">
              <option value="all">Tutte le Categorie</option>
              <option value="Edilizia">🧱 Edilizia</option>
              <option value="Elettricità">⚡ Elettricità</option>
              <option value="Idraulica">🚰 Idraulica</option>
              <option value="Attrezzi">🛠️ Attrezzi</option>
            </select>

            <select onChange={(e)=>setCondition(e.target.value)} className="p-3 bg-white border border-stone-200 rounded-lg text-[11px] font-black uppercase outline-none focus:border-emerald-500 shadow-sm text-stone-700">
              <option value="all">Condizione (Tutte)</option>
              <option value="Nuovo">✨ Nuovo</option>
              <option value="Usato">♻️ Usato</option>
            </select>

            <input type="number" min="0" placeholder="Prezzo Max (€)" className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setMaxPrice(e.target.value)} />

            <select onChange={(e)=>setSortBy(e.target.value)} className="p-3 bg-white border border-stone-200 rounded-lg text-[11px] font-black uppercase outline-none focus:border-emerald-500 shadow-sm text-stone-700">
              <option value="recent">🕒 Più Recenti</option>
              <option value="price_asc">💶 Prezzo: Dal più basso</option>
              <option value="price_desc">💶 Prezzo: Dal più alto</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4 mt-2 border-t border-stone-200">
            {['all', 'sell', 'offered', 'wanted'].map(f => (
              <button key={f} onClick={()=>setActiveType(f)} className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeType === f ? 'bg-stone-800 text-white shadow-md' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>
                {f === 'all' ? 'Tutti' : f === 'sell' ? 'Vendi' : f === 'offered' ? 'Regala' : 'Cerco'}
              </button>
            ))}
          </div>
        </div>

        {/* 4. GRIGLIA PRODOTTI */}
        <div className="px-6 py-10 flex-grow pb-32">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filtered.map((ann) => (
              <div key={ann.id} className="bg-white border rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 flex flex-col group relative">
                {IS_STAFF && <button onClick={()=>deleteAd(ann.id)} className="absolute top-2 left-2 z-20 bg-red-600 text-white px-3 py-1.5 rounded-md text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">ELIMINA</button>}
                
                <div className="h-44 bg-stone-100 relative overflow-hidden">
                  <img src={ann.image_url || "/gazebo.jpg"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className={`absolute top-3 right-3 px-3 py-1.5 text-[9px] font-black rounded shadow-md text-white ${ann.type === 'wanted' ? 'bg-amber-500' : 'bg-emerald-600'}`}>{ann.type?.toUpperCase()}</span>
                </div>
                
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-black text-stone-900 uppercase truncate mb-1">{ann.title}</h4>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">{ann.brand} {ann.model}</p>
                    <p className="text-[10px] text-stone-500 line-clamp-2 font-medium">{ann.description}</p>
                  </div>
                  <div className="mt-5 pt-4 border-t flex justify-between items-center">
                    <span className="font-black text-stone-900 text-sm">€{ann.price}</span>
                    <Link href={user ? `/chat/${ann.user_id}?ann=${ann.id}` : '/register'} className="bg-stone-100 text-stone-700 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-colors shadow-sm">Contatta</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filtered.length === 0 && !loading && (
            <div className="py-20 text-center flex flex-col items-center">
               <span className="text-5xl mb-4 opacity-20">📦</span>
               <p className="text-stone-400 text-xs font-black uppercase tracking-widest">Nessun materiale trovato con questi filtri.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

