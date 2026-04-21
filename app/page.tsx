'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function HomePageContent() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [mainSearch, setMainSearch] = useState('') 
  const [searchCategory, setSearchCategory] = useState('all')
  const [condition, setSearchCondition] = useState('all')
  const [distance, setDistance] = useState(0) 
  const [isStaffOpen, setIsStaffOpen] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const catFilter = searchParams.get('cat')
  const typeFilter = searchParams.get('type')
  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchInitialData() }, [])

  async function fetchInitialData() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    
    const { data: ads, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (!error && ads) setAnnouncements(ads)
    
    if (u) {
      const { data: favs } = await supabase.from('favorites').select('announcement_id').eq('user_id', u.id)
      if (favs) setFavorites(favs.map(f => f.announcement_id))
    }
    setLoading(false)
  }

  const handleNearbySearch = () => {
    if (distance > 0) { 
      setDistance(0)
      fetchInitialData() 
    } else {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setDistance(20) 
        const { data, error } = await supabase.rpc('get_nearby_announcements', {
          user_lat: pos.coords.latitude, user_lon: pos.coords.longitude, radius_meters: 20000
        })
        if (!error && data) setAnnouncements(data)
      })
    }
  }

  async function handleToggleFavorite(e: any, announcementId: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { alert("Devi accedere per salvare i tuoi preferiti ❤️"); return; }
    
    if (favorites.includes(announcementId)) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('announcement_id', announcementId)
      if (!error) setFavorites(favorites.filter(id => id !== announcementId))
    } else {
      const { error } = await supabase.from('favorites').insert([{ user_id: user.id, announcement_id: announcementId }])
      if (!error) setFavorites([...favorites, announcementId])
    }
  }

  const filteredData = announcements.filter(item => {
    const titleMatch = item.title.toLowerCase().includes(mainSearch.toLowerCase())
    const categoryMatch = catFilter ? item.category_id?.toString() === catFilter : (searchCategory === 'all' || item.category === searchCategory)
    const conditionMatch = condition === 'all' || item.condition === condition
    const typeMatch = !typeFilter || item.type === typeFilter
    const availableMatch = item.quantity > 0 
    return titleMatch && categoryMatch && conditionMatch && typeMatch && availableMatch
  })

  const topItems = filteredData.filter(i => i.condition === 'Nuovo').slice(0, 5)
  const regularItems = filteredData.filter(i => !topItems.find(t => t.id === i.id))

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      {IS_STAFF && (
        <button onClick={() => setIsStaffOpen(true)} className="fixed bottom-8 right-8 z-[99] bg-stone-900 text-emerald-400 w-16 h-16 rounded-full shadow-lg font-bold flex items-center justify-center border-2 border-emerald-400 hover:scale-105 active:scale-95 transition-all text-2xl">👑</button>
      )}

      <div className="relative h-[400px] flex flex-col items-center justify-center p-6 text-center overflow-hidden border-b border-stone-200 bg-white">
          <img src="/gazebo.jpg" className="absolute inset-0 w-full h-full object-cover opacity-15 scale-105 pointer-events-none" alt="Background" />
          <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
            
            <h1 
              className="text-6xl md:text-[90px] text-stone-900 leading-none mb-3 drop-shadow-sm"
              style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 400 }}
            >
              Libero Scambio
            </h1>
            <p className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.6em] text-stone-400 mb-10 ml-2">
              Vendi • Compra • Regala
            </p>
            
            <div className="relative group w-full max-w-2xl">
              <input type="text" placeholder="Cerca tra migliaia di prodotti..." className="w-full p-5 pl-14 rounded-3xl bg-white border border-stone-200 outline-none text-sm font-medium focus:border-emerald-400 shadow-sm transition-all" onChange={(e) => setMainSearch(e.target.value)} />
              <span className="absolute left-5 top-5 opacity-40 text-xl">🔍</span>
            </div>
          </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 -mt-12 relative z-20">
        
        <section className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-3xl shadow-md border border-stone-100 items-center">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold uppercase text-stone-400 ml-2 tracking-widest">Settore</label>
            <select onChange={(e) => setSearchCategory(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-bold uppercase tracking-wide outline-none border border-stone-100 hover:bg-stone-100 transition-colors cursor-pointer">
              <option value="all">Tutte le Categorie</option>
              <option value="Edilizia">🏗️ Edilizia</option>
              <option value="Elettricità">⚡ Elettricità</option>
              <option value="Idraulica">💧 Idraulica</option>
              <option value="Giardinaggio">🌿 Giardinaggio</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold uppercase text-stone-400 ml-2 tracking-widest">Stato Oggetto</label>
            <select onChange={(e) => setSearchCondition(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-bold uppercase tracking-wide outline-none border border-stone-100 hover:bg-stone-100 transition-colors cursor-pointer">
              <option value="all">Tutte le Condizioni</option>
              <option value="Nuovo">✨ Nuovo</option>
              <option value="Usato">♻️ Usato</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <button onClick={handleNearbySearch} className={`p-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${distance > 0 ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-stone-900 text-white hover:bg-emerald-500'}`}>
              {distance > 0 ? '📍 Filtro 20km Attivo' : '📍 Cerca Vicino a me'}
            </button>
          </div>
        </section>

        {!catFilter && !typeFilter && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
            <Link href="/add?mode=new" className="group relative h-64 rounded-3xl border border-stone-200 overflow-hidden bg-white hover:border-emerald-400 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/nuovo.png" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-105 transition-transform duration-[1s]" alt="Nuovo" />
               <div className="relative z-10 p-6"><h3 className="text-3xl font-bold uppercase italic text-stone-900 leading-tight">Vendi<br/>Nuovo</h3><p className="text-[10px] font-medium uppercase mt-4 text-stone-500 tracking-widest">Ideale per fondi di magazzino</p></div>
            </Link>
            <Link href="/add?mode=used" className="group relative h-64 rounded-3xl border border-stone-200 overflow-hidden bg-white hover:border-blue-400 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/usato.png" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-105 transition-transform duration-[1s]" alt="Usato" />
               <div className="relative z-10 p-6"><h3 className="text-3xl font-bold uppercase italic text-stone-900 leading-tight">Vendi<br/>Usato</h3><p className="text-[10px] font-medium uppercase mt-4 text-stone-500 tracking-widest">Dai una seconda vita</p></div>
            </Link>
            <Link href="/add?mode=gift" className="group relative h-64 rounded-3xl border-2 border-emerald-500 overflow-hidden bg-white hover:bg-emerald-50 transition-all shadow-md flex items-center justify-center text-center">
               <img src="/regala.jpeg" className="absolute inset-0 w-full h-full object-cover opacity-15 group-hover:scale-105 transition-transform duration-[1s]" alt="Regalo" />
               <div className="relative z-10 p-8"><h3 className="text-3xl font-bold uppercase italic text-emerald-800 leading-none mb-3">Regalo<br/>Solidale</h3><span className="text-5xl block mt-2">🎁</span></div>
            </Link>
          </div>
        )}

        <section className="mb-20">
          <div className="flex justify-between items-end mb-8 border-b border-stone-200 pb-4">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.4em] text-stone-900">Vetrina Top Nuovo</h2>
            <Link href="/?condition=Nuovo" className="text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-800 transition-colors">Catalogo completo →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            {topItems.map(item => (
              <div key={item.id} className="group bg-white p-4 rounded-3xl shadow-sm border border-stone-100 hover:shadow-md transition-all relative">
                <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-6 right-6 z-30 bg-white/90 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-lg hover:scale-110 transition-all">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                <Link href={`/announcement/${item.id}`}>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-stone-50 mb-4 relative border-2 border-white shadow-inner">
                    <img src={item.image_url || "/nuovo.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[0.8s]" />
                  </div>
                  <h4 className="text-[12px] font-medium uppercase truncate text-stone-900 mb-1 px-1">{item.title}</h4>
                  <div className="flex justify-between items-center px-1 mb-3">
                    <p className="text-xl font-bold text-emerald-600 tracking-tight">€ {item.price}</p>
                    <p className="text-[9px] text-stone-400 font-medium tracking-tighter">Disp: {item.quantity}</p>
                  </div>
                  <button className="mt-2 w-full bg-stone-100 text-stone-800 text-[10px] font-bold uppercase py-3 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-all">Vedi Dettagli</button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-8 border-b border-stone-200 pb-4">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.4em] text-stone-400">Tutti i Materiali</h2>
            <p className="text-[10px] font-medium uppercase text-stone-400 tracking-[0.2em]">{regularItems.length} Inserzioni</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {regularItems.map(item => (
              <div key={item.id} className="group bg-white rounded-2xl overflow-hidden border border-stone-100 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col h-full relative">
                <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-3 right-3 z-30 bg-white/80 w-8 h-8 flex items-center justify-center rounded-full text-xs shadow-sm hover:scale-110 transition-all">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                <Link href={`/announcement/${item.id}`} className="flex flex-col h-full">
                  <div className="h-36 bg-stone-50 relative overflow-hidden"><img src={item.image_url || "/usato.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-medium uppercase truncate text-stone-900 mb-1">{item.title}</h4>
                      <p className="text-lg font-bold text-stone-900">{item.type === 'offered' ? 'GRATIS 🎁' : `€ ${item.price}`}</p>
                      <p className="text-[9px] text-stone-400 mt-1">Quantità: {item.quantity}</p>
                    </div>
                    <button className="mt-4 w-full bg-stone-50 text-stone-600 text-[9px] font-bold uppercase py-2 rounded-lg group-hover:bg-stone-800 group-hover:text-white transition-all">Scopri</button>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isStaffOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl p-10 shadow-2xl relative text-center border-2 border-emerald-400">
             <button onClick={() => setIsStaffOpen(false)} className="absolute top-6 right-6 text-stone-400 hover:text-stone-800 font-bold text-2xl">✕</button>
             <div className="text-6xl mb-4 drop-shadow-sm">👑</div>
             <h2 className="text-3xl font-bold uppercase italic mb-2 text-stone-800">Admin Panel</h2>
             <p className="text-stone-400 font-medium uppercase text-[10px] tracking-widest mb-8 border-b border-stone-100 pb-4">Controllo Globale</p>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/staff/users" className="group p-6 bg-stone-50 rounded-xl font-bold uppercase text-[11px] tracking-wider border border-stone-100 hover:bg-stone-800 hover:text-white transition-all flex flex-col items-center gap-2"><span className="text-3xl group-hover:scale-110 transition-transform">👥</span>Utenti</Link>
                <Link href="/staff/annunci" className="group p-6 bg-stone-50 rounded-xl font-bold uppercase text-[11px] tracking-wider border border-stone-100 hover:bg-stone-800 hover:text-white transition-all flex flex-col items-center gap-2"><span className="text-3xl group-hover:scale-110 transition-transform">📝</span>Moderazione</Link>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
   return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 animate-pulse">Sincronizzazione in corso...</p></div>}><HomePageContent /></Suspense>
}
