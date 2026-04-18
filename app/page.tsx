'use client'
import { useEffect, useState } from 'react'
import { supabase } from './../lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // STATI PER I NUOVI FILTRI
  const [searchTerm, setSearchTerm] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [searchModel, setSearchModel] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [category, setCategory] = useState('all')
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false)

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    let res = announcements
    // Filtri a cascata
    if (searchTerm) res = res.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
    if (searchBrand) res = res.filter(a => a.brand?.toLowerCase().includes(searchBrand.toLowerCase()))
    if (searchModel) res = res.filter(a => a.model?.toLowerCase().includes(searchModel.toLowerCase()))
    if (activeType !== 'all') res = res.filter(a => a.type === activeType)
    if (category !== 'all') res = res.filter(a => a.category === category)
    
    setFiltered(res)
  }, [searchTerm, searchBrand, searchModel, activeType, category, announcements])

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
      
      {/* MENU STAFF FISSO A SCOMPARSA */}
      {IS_STAFF && (
        <>
          <button onClick={() => setIsStaffMenuOpen(true)} className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white w-14 h-14 rounded-full shadow-lg font-black text-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ease-out flex items-center justify-center">👑</button>
          <div className={`fixed top-0 right-0 h-full w-80 bg-stone-900 z-[60] transform transition-transform duration-500 ease-out ${isStaffMenuOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl p-6 text-stone-100`}>
            <div className="flex justify-between mb-8 border-b border-stone-800 pb-4 items-center">
              <span className="font-bold uppercase tracking-[0.2em] text-xs">Pannello Staff</span>
              <button onClick={() => setIsStaffMenuOpen(false)} className="text-stone-400 hover:text-white transition-colors text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <Link href="/profile" className="block p-4 bg-stone-800 rounded-lg font-bold hover:bg-emerald-600 hover:text-white uppercase text-[10px] tracking-widest text-center transition-all duration-300">Gestione Utenti / Profili</Link>
              <Link href="/chat" className="block p-4 bg-stone-800 rounded-lg font-bold hover:bg-emerald-600 hover:text-white uppercase text-[10px] tracking-widest text-center transition-all duration-300">Spia Tutte le Chat</Link>
              <p className="text-[9px] text-stone-500 mt-10 uppercase tracking-widest text-center">ID STAFF: USR-1</p>
            </div>
          </div>
          {isStaffMenuOpen && <div onClick={() => setIsStaffMenuOpen(false)} className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[55] animate-fade-in"></div>}
        </>
      )}

      <main className="max-w-[1400px] mx-auto bg-white min-h-screen shadow-2xl shadow-stone-200/50 flex flex-col">
        
        <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-100 px-6 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-black tracking-[0.1em] italic uppercase text-stone-800">MATERIALI</Link>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <Link href="/chat" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase tracking-widest transition-colors p-2 bg-stone-100 rounded-md">💬 Chat</Link>
                <Link href="/profile" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase tracking-widest transition-colors p-2 bg-stone-100 rounded-md">👤 Profilo</Link>
                <Link href="/add" className="bg-emerald-600 text-white px-6 py-2.5 rounded-md text-[11px] font-black tracking-widest uppercase shadow-md hover:bg-emerald-700 transition-all duration-300">+ Pubblica</Link>
              </>
            ) : (
              <Link href="/register" className="bg-stone-900 text-white px-8 py-3 rounded-md text-[11px] font-black tracking-widest uppercase hover:bg-stone-800 transition-all shadow-md">Accedi</Link>
            )}
          </div>
        </nav>

        {/* RIQUADRI PROMOZIONALI IN ALTO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 mt-8">
          <div className="relative h-[250px] rounded-2xl overflow-hidden group border-2 border-stone-100 shadow-lg">
            <img src="/usato.png" alt="Usato" className="absolute inset-0 w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-[8s] ease-out" />
            <div className="absolute inset-0 bg-stone-900/60 group-hover:bg-stone-900/50 transition-colors flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] italic">
                "Non buttare, magari ad un altro serve"
              </h3>
            </div>
          </div>
          
          <div className="relative h-[250px] rounded-2xl overflow-hidden group border-2 border-stone-100 shadow-lg">
            <img src="/nuovo.png" alt="Nuovo" className="absolute inset-0 w-full h-full object-cover transform scale-105 group-hover:scale-100 transition-transform duration-[8s] ease-out" />
            <div className="absolute inset-0 bg-stone-900/60 group-hover:bg-stone-900/50 transition-colors flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] italic">
                "È nuovo?, vendilo"
              </h3>
            </div>
          </div>
        </div>

        {/* BARRA RICERCA E FILTRI AVANZATI */}
        <div className="mx-6 mt-10 p-6 bg-stone-50 rounded-2xl border border-stone-200 shadow-inner flex flex-col gap-4">
          <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em]">Filtra Materiali</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input type="text" placeholder="Cerca Nome/Titolo..." className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchTerm(e.target.value)} />
            <input type="text" placeholder="Marca..." className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchBrand(e.target.value)} />
            <input type="text" placeholder="Modello..." className="p-3 bg-white border border-stone-200 rounded-lg text-sm font-bold outline-none focus:border-emerald-500 shadow-sm" onChange={(e)=>setSearchModel(e.target.value)} />
            
            <select onChange={(e)=>setCategory(e.target.value)} className="p-3 bg-white border border-stone-200 rounded-lg text-xs font-black uppercase outline-none focus:border-emerald-500 shadow-sm">
              <option value="all">Tutte le categorie</option>
              <option value="Edilizia">🧱 Edilizia</option>
              <option value="Elettricità">⚡ Elettricità</option>
              <option value="Idraulica">🚰 Idraulica</option>
              <option value="Attrezzi">🛠️ Attrezzi</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {['all', 'sell', 'offered', 'wanted'].map(f => (
              <button key={f} onClick={()=>setActiveType(f)} className={`px-6 py-2.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all duration-300 ${activeType === f ? 'bg-stone-800 text-white shadow-md' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>
                {f === 'all' ? 'Tutti' : f === 'sell' ? 'Vendi' : f === 'offered' ? 'Regala' : 'Cerco'}
              </button>
            ))}
          </div>
        </div>

        {/* CATALOGO INFINITO */}
        <div className="px-6 py-10 flex-grow pb-32">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filtered.map((ann) => (
              <div key={ann.id} className="bg-white border border-stone-200 rounded-2xl overflow-hidden hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 ease-out flex flex-col group relative">
                
                {IS_STAFF && <button onClick={()=>deleteAd(ann.id)} className="absolute top-2 left-2 z-20 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-md text-[9px] font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">STAFF: ELIMINA</button>}
                
                <div className="h-44 bg-stone-100 relative overflow-hidden">
                  <img src={ann.image_url || "/gazebo.jpg"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                  <span className={`absolute top-3 right-3 px-3 py-1.5 text-[9px] font-black tracking-widest rounded shadow-md text-white ${ann.type === 'wanted' ? 'bg-amber-500' : 'bg-emerald-600'}`}>{ann.type?.toUpperCase()}</span>
                </div>
                
                <div className="p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-black text-stone-900 uppercase tracking-tight line-clamp-1 mb-1">{ann.title}</h4>
                    {/* Mostra Marca e Modello se presenti */}
                    {(ann.brand || ann.model) && (
                       <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2 line-clamp-1">{ann.brand} {ann.model}</p>
                    )}
                    <p className="text-[10px] text-stone-500 line-clamp-2 leading-relaxed font-medium">{ann.description}</p>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-stone-100 flex justify-between items-center">
                    <span className="font-black text-stone-900 text-sm">€{ann.price}</span>
                    <Link href={user ? `/chat/${ann.user_id}?ann=${ann.id}` : '/register'} className="bg-stone-100 text-stone-700 hover:bg-emerald-600 hover:text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm">Contatta</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filtered.length === 0 && !loading && (
            <div className="py-32 text-center flex flex-col items-center">
               <span className="text-4xl mb-4 opacity-20">📦</span>
               <p className="text-stone-400 text-xs font-black uppercase tracking-widest">Nessun annuncio trovato con questi filtri.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
