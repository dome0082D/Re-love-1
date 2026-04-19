'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

const SkeletonCard = () => (
  <div className="bg-stone-100 animate-pulse rounded-[2rem] h-[380px] w-full border border-stone-200"></div>
)

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(15)
  const [wishlist, setWishlist] = useState<string[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [category, setCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false)

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    let res = [...announcements];
    if (searchTerm) res = res.filter(a => String(a?.title || '').toLowerCase().includes(searchTerm.toLowerCase()));
    if (searchBrand) res = res.filter(a => String(a?.brand || '').toLowerCase().includes(searchBrand.toLowerCase()));
    if (activeType !== 'all') res = res.filter(a => a?.type === activeType);
    if (category !== 'all') res = res.filter(a => a?.category === category);
    if (condition !== 'all') res = res.filter(a => (a?.condition || 'Usato') === condition);
    if (maxPrice) res = res.filter(a => (Number(a?.price) || 0) <= parseFloat(maxPrice));

    if (sortBy === 'price_asc') res.sort((a, b) => (Number(a?.price) || 0) - (Number(b?.price) || 0));
    else if (sortBy === 'price_desc') res.sort((a, b) => (Number(b?.price) || 0) - (Number(a?.price) || 0));
    else res.sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime());
    setFiltered(res);
  }, [searchTerm, searchBrand, activeType, category, condition, maxPrice, sortBy, announcements])

  const fetchData = async () => {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) { setAnnouncements(data); setFiltered(data); }
    if (u) {
      const { data: w } = await supabase.from('wishlist').select('announcement_id').eq('user_id', u.id)
      if (w) setWishlist(w.map((item: any) => item.announcement_id))
    }
    setLoading(false)
  }

  const toggleWishlist = async (annId: string) => {
    if (!user) return alert("Accedi per i preferiti!");
    if (wishlist.includes(annId)) {
      setWishlist(wishlist.filter(id => id !== annId));
      await supabase.from('wishlist').delete().match({ user_id: user.id, announcement_id: annId });
    } else {
      setWishlist([...wishlist, annId]);
      await supabase.from('wishlist').insert([{ user_id: user.id, announcement_id: annId }]);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 overflow-x-hidden">
      
      {/* 👑 MENU STAFF */}
      {IS_STAFF && (
        <>
          <button onClick={() => setIsStaffMenuOpen(true)} className="fixed bottom-6 right-6 z-50 bg-emerald-700 text-white w-14 h-14 rounded-full shadow-2xl font-black text-xl flex items-center justify-center hover:scale-110 transition-all">👑</button>
          <div className={`fixed top-0 right-0 h-full w-80 bg-stone-900 z-[60] transform transition-transform duration-500 ease-out ${isStaffMenuOpen ? 'translate-x-0' : 'translate-x-full'} p-8 text-white`}>
             <div className="flex justify-between border-b border-stone-800 pb-4 mb-8">
               <span className="font-black uppercase text-[10px] tracking-widest text-emerald-400 italic">Pannello Staff</span>
               <button onClick={() => setIsStaffMenuOpen(false)}>✕</button>
             </div>
             <Link href="/staff/users" className="block p-5 bg-stone-800 rounded-2xl font-black hover:bg-emerald-600 mb-4 text-center uppercase text-[9px] tracking-widest">Gestione Utenti</Link>
             <Link href="/chat" className="block p-5 bg-stone-800 rounded-2xl font-black hover:bg-emerald-600 text-center uppercase text-[9px] tracking-widest">Monitoraggio Chat</Link>
          </div>
          {isStaffMenuOpen && <div onClick={() => setIsStaffMenuOpen(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[55]"></div>}
        </>
      )}

      <main className="max-w-[1400px] mx-auto bg-white min-h-screen shadow-2xl flex flex-col">
        <nav className="sticky top-0 z-40 bg-white/95 border-b px-6 py-4 flex justify-between items-center backdrop-blur-md">
          <Link href="/" className="text-2xl font-black italic uppercase tracking-widest">MATERIALI</Link>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <Link href="/chat" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase p-2 bg-stone-100 rounded-md">💬 Chat</Link>
                <Link href="/profile" className="text-stone-600 hover:text-emerald-600 text-[11px] font-black uppercase p-2 bg-stone-100 rounded-md">👤 Profilo</Link>
                <Link href="/add" className="bg-emerald-600 text-white px-6 py-2.5 rounded-md text-[11px] font-black uppercase shadow-md hover:bg-emerald-700">+ Pubblica</Link>
              </>
            ) : (
              <Link href="/register" className="bg-stone-900 text-white px-8 py-3 rounded-md text-[11px] font-black uppercase shadow-md">Accedi</Link>
            )}
          </div>
        </nav>

        {/* HERO */}
        <div className="px-6 mt-6">
          <div className="relative h-[400px] rounded-[2.5rem] overflow-visible border shadow-lg z-30">
            <img src="/gazebo.jpg" alt="Hero" className="absolute inset-0 w-full h-full object-cover rounded-[2.5rem]" />
            <div className="absolute inset-0 bg-stone-900/60 flex flex-col items-center justify-center p-8 text-center rounded-[2.5rem]">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-8 italic uppercase drop-shadow-lg tracking-tighter">Recupera, Regala, Vendi</h1>
              <div className="w-full max-w-2xl relative">
                <input type="text" value={searchTerm} placeholder="Cosa ti serve oggi?" className="w-full p-6 pl-16 rounded-3xl bg-white shadow-2xl outline-none text-lg font-medium" onChange={(e) => setSearchTerm(e.target.value)} />
                <span className="absolute left-6 top-6 text-2xl opacity-40">🔍</span>
              </div>
            </div>
          </div>
        </div>

        {/* 🧱 RIQUADRI DINAMICI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 mt-10 relative z-10">
          <Link href="/add?mode=used" className="relative h-[240px] rounded-[2rem] overflow-hidden group shadow-xl border-2 border-transparent hover:border-emerald-500 transition-all">
            <img src="/usato.png" alt="Usato" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-stone-900/50 group-hover:bg-stone-900/40 transition-colors flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl font-black text-white uppercase italic drop-shadow-md">"Non buttare, magari ad un altro serve" <br/><span className="text-emerald-400 text-sm tracking-[0.3em] not-italic mt-2 block">VENDI USATO</span></h3>
            </div>
          </Link>
          <Link href="/add?mode=new" className="relative h-[240px] rounded-[2rem] overflow-hidden group shadow-xl border-2 border-transparent hover:border-emerald-500 transition-all">
            <img src="/nuovo.png" alt="Nuovo" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-stone-900/50 group-hover:bg-stone-900/40 transition-colors flex items-center justify-center p-8 text-center">
              <h3 className="text-2xl font-black text-white uppercase italic drop-shadow-md">"È nuovo?, vendilo" <br/><span className="text-emerald-400 text-sm tracking-[0.3em] not-italic mt-2 block">VENDI NUOVO</span></h3>
            </div>
          </Link>
        </div>

        {/* FILTRI */}
        <div className="mx-6 mt-10 p-8 bg-stone-50 rounded-[2rem] border shadow-sm flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="text" value={searchTerm} placeholder="Cerca parola..." className="w-full p-4 bg-white border rounded-xl text-sm font-bold outline-none" onChange={(e)=>setSearchTerm(e.target.value)} />
            <input type="text" value={searchBrand} placeholder="Marca" className="w-full p-4 bg-white border rounded-xl text-sm font-bold outline-none" onChange={(e)=>setSearchBrand(e.target.value)} />
            <select value={condition} onChange={(e)=>setCondition(e.target.value)} className="w-full p-4 bg-white border rounded-xl text-[10px] font-black uppercase outline-none text-stone-700">
              <option value="all">Condizione (Tutte)</option><option value="Nuovo">Nuovo</option><option value="Usato">Usato</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2 pt-6 border-t border-stone-200">
            {['all', 'sell', 'offered', 'wanted'].map(f => (
              <button key={f} onClick={()=>setActiveType(f)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeType === f ? 'bg-stone-900 text-white shadow-lg' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-100'}`}>
                {f === 'all' ? 'Tutto' : f === 'sell' ? 'Vendi' : f === 'offered' ? 'Regala' : 'Cerco'}
              </button>
            ))}
          </div>
        </div>

        {/* GRIGLIA */}
        <div className="px-6 py-10 flex-grow pb-32">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {loading ? (
              Array(10).fill(0).map((_, i) => <SkeletonCard key={i} />)
            ) : (
              filtered.slice(0, visibleCount).map((ann) => (
                <div key={ann.id} className="bg-white border border-stone-200 rounded-[2rem] overflow-hidden hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 flex flex-col group relative">
                  <button onClick={() => toggleWishlist(ann.id)} className="absolute top-3 left-3 z-20 bg-white/90 p-2.5 rounded-full shadow-md">
                    {wishlist.includes(ann.id) ? '❤️' : '🤍'}
                  </button>
                  <Link href={`/announcement/${ann.id}`} className="block h-48 bg-stone-100 overflow-hidden relative">
                    <img src={ann.image_url || "/gazebo.jpg"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={ann.title} />
                    <span className={`absolute top-4 right-4 px-3 py-1.5 text-[8px] font-black rounded-lg shadow-md text-white ${ann.condition === 'Nuovo' ? 'bg-amber-500' : 'bg-stone-700'}`}>{ann.condition?.toUpperCase()}</span>
                  </Link>
                  <div className="p-6 flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-black text-stone-900 uppercase truncate mb-1">{ann.title}</h4>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-3">€{ann.price}</p>
                    </div>
                    <Link href={`/announcement/${ann.id}`} className="w-full block bg-stone-900 text-white text-center py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all">Dettagli</Link>
                  </div>
                  {IS_STAFF && <button onClick={async ()=>{if(confirm("ELIMINA STAFF?")){await supabase.from('announcements').delete().eq('id', ann.id); fetchData()}}} className="absolute top-12 left-3 z-20 bg-red-600 text-white px-2 py-1 rounded text-[7px] font-black">ELIMINA</button>}
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
