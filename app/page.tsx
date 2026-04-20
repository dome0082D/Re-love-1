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
    if (!user) { alert("Devi effettuare l'accesso per salvare i tuoi preferiti ❤️"); return; }
    
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
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-32">
      {IS_STAFF && (
        <button onClick={() => setIsStaffOpen(true)} className="fixed bottom-12 right-12 z-[99] bg-stone-900 text-emerald-400 w-20 h-20 rounded-full shadow-2xl font-black flex items-center justify-center border-2 border-emerald-400 hover:scale-110 active:scale-95 transition-all animate-pulse">👑</button>
      )}

      <div className="relative h-[520px] flex flex-col items-center justify-center p-8 text-center overflow-hidden border-b border-stone-200 bg-white">
          <img src="/gazebo.jpg" className="absolute inset-0 w-full h-full object-cover opacity-20 scale-105 pointer-events-none" alt="Background" />
          <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
            {/* HERO SECTION AGGIORNATA AL NUOVO NOME */}
            <h1 className="text-6xl md:text-[100px] font-black uppercase italic tracking-tighter text-stone-900 leading-none mb-4 drop-shadow-2xl">
              LIBERO SCAMBIO
            </h1>
            <p className="text-[10px] md:text-[14px] font-black uppercase tracking-[0.8em] text-stone-400 mb-14 ml-4">
              Vendi • Compra • Regala
            </p>
            
            <div className="relative group w-full max-w-2xl">
              <input type="text" placeholder="Cerca tra migliaia di prodotti..." className="w-full p-8 pl-16 rounded-[3rem] bg-white border-2 border-stone-100 outline-none text-lg focus:border-emerald-500 shadow-2xl transition-all" onChange={(e) => setMainSearch(e.target.value)} />
              <span className="absolute left-7 top-8 opacity-30 text-3xl">🔍</span>
            </div>
          </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 -mt-20 relative z-20">
        <section className="mb-16 grid grid-cols-1 md:grid-cols-3 gap-8 bg-white p-8 rounded-[4rem] shadow-2xl border border-stone-50 items-center">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-4 tracking-widest">Settore</label>
            <select onChange={(e) => setSearchCategory(e.target.value)} className="p-5 bg-stone-50 rounded-3xl text-[11px] font-black uppercase tracking-widest outline-none border-none hover:bg-stone-100 transition-colors cursor-pointer">
              <option value="all">Tutte le Categorie</option>
              <option value="Edilizia">🏗️ Edilizia</option>
              <option value="Elettricità">⚡ Elettricità</option>
              <option value="Idraulica">💧 Idraulica</option>
              <option value="Giardinaggio">🌿 Giardinaggio</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-4 tracking-widest">Stato Oggetto</label>
            <select onChange={(e) => setSearchCondition(e.target.value)} className="p-5 bg-stone-50 rounded-3xl text-[11px] font-black uppercase tracking-widest outline-none border-none hover:bg-stone-100 transition-colors cursor-pointer">
              <option value="all">Tutte le Condizioni</option>
              <option value="Nuovo">✨ Nuovo</option>
              <option value="Usato">♻️ Usato</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-6">
            <button onClick={handleNearbySearch} className={`p-5 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-3 ${distance > 0 ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-stone-900 text-white hover:bg-emerald-600'}`}>
              {distance > 0 ? '📍 Filtro 20km Attivo' : '📍 Cerca Vicino a me'}
            </button>
          </div>
        </section>

        {!catFilter && !typeFilter && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-32">
            <Link href="/add?mode=new" className="group relative h-96 rounded-[4.5rem] border border-stone-200 overflow-hidden bg-white hover:border-emerald-500 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/nuovo.png" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-110 transition-transform duration-[1.5s]" alt="Nuovo" />
               <div className="relative z-10 p-8"><h3 className="text-5xl font-black uppercase italic text-stone-900 leading-tight">Vendi<br/>Nuovo</h3><p className="text-[11px] font-bold uppercase mt-6 text-stone-400 tracking-[0.2em]">Ideale per fondi di magazzino</p></div>
            </Link>
            <Link href="/add?mode=used" className="group relative h-96 rounded-[4.5rem] border border-stone-200 overflow-hidden bg-white hover:border-blue-500 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/usato.png" className="absolute inset-0 w-full h-full object-cover opacity-10 group-hover:scale-110 transition-transform duration-[1.5s]" alt="Usato" />
               <div className="relative z-10 p-8"><h3 className="text-5xl font-black uppercase italic text-stone-900 leading-tight">Vendi<br/>Usato</h3><p className="text-[11px] font-bold uppercase mt-6 text-stone-400 tracking-[0.2em]">Dai una seconda vita</p></div>
            </Link>
            <Link href="/add?mode=gift" className="group relative h-96 rounded-[4.5rem] border-[6px] border-emerald-500 overflow-hidden bg-white hover:bg-emerald-50 transition-all shadow-2xl flex items-center justify-center text-center">
               <img src="/regala.jpeg" className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-110 transition-transform duration-[1.5s]" alt="Regalo" />
               <div className="relative z-10 p-10"><h3 className="text-4xl font-black uppercase italic text-emerald-900 leading-none mb-2">Regalo<br/>Solidale</h3><span className="text-6xl block my-4">🎁</span></div>
            </Link>
          </div>
        )}

        <section className="mb-32">
          <div className="flex justify-between items-end mb-16 border-b-4 border-stone-100 pb-10">
            <h2 className="text-[16px] font-black uppercase tracking-[0.7em] text-stone-900">Vetrina Top Nuovo</h2>
            <Link href="/?condition=Nuovo" className="text-[12px] font-black uppercase text-emerald-600 hover:tracking-[0.2em] transition-all">Catalogo completo →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
            {topItems.map(item => (
              <div key={item.id} className="group bg-white p-4 lg:p-6 rounded-[3.5rem] shadow-sm border border-stone-100 hover:shadow-2xl transition-all relative">
                <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-8 right-8 z-30 bg-white/95 w-12 h-12 flex items-center justify-center rounded-full shadow-xl text-xl hover:scale-125 transition-all">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                <Link href={`/announcement/${item.id}`}>
                  <div className="aspect-square rounded-[2.5rem] overflow-hidden bg-stone-50 mb-8 relative border-4 border-white shadow-inner">
                    <img src={item.image_url || "/nuovo.png"} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[0.8s]" />
                  </div>
                  <h4 className="text-[12px] lg:text-[14px] font-bold uppercase truncate text-stone-900 mb-2 px-2 italic">{item.title}</h4>
                  <p className="text-2xl lg:text-3xl font-black text-emerald-600 px-2 tracking-tighter">€ {item.price}</p>
                  <button className="mt-8 w-full bg-stone-900 text-white text-[11px] font-black uppercase py-5 rounded-[2rem] group-hover:bg-emerald-500 transition-all">Vedi Dettagli</button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-16 border-b-4 border-stone-100 pb-10">
            <h2 className="text-[16px] font-black uppercase tracking-[0.7em] text-stone-400">Tutti i Materiali</h2>
            <p className="text-[12px] font-black uppercase text-stone-300 tracking-[0.4em]">{regularItems.length} Inserzioni</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 lg:gap-8">
            {regularItems.map(item => (
              <div key={item.id} className="group bg-white rounded-[3rem] overflow-hidden border-2 border-stone-100 shadow-sm hover:border-emerald-400 transition-all flex flex-col h-full relative">
                <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-4 right-4 z-30 bg-white/80 w-10 h-10 flex items-center justify-center rounded-full text-xs shadow-md">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                <Link href={`/announcement/${item.id}`} className="flex flex-col h-full">
                  <div className="h-40 lg:h-52 bg-stone-100 relative overflow-hidden"><img src={item.image_url || "/usato.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /></div>
                  <div className="p-5 lg:p-7 flex-1 flex flex-col justify-between">
                    <div><h4 className="text-[11px] lg:text-[13px] font-bold uppercase truncate text-stone-900 mb-2">{item.title}</h4><p className="text-lg lg:text-xl font-black text-stone-900">{item.type === 'offered' ? 'GRATIS' : `€ ${item.price}`}</p></div>
                    <button className="mt-6 w-full bg-stone-50 text-stone-900 text-[10px] font-black uppercase py-4 rounded-2xl group-hover:bg-stone-900 group-hover:text-white transition-all">Scopri</button>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>

      {isStaffOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-8 bg-stone-900/90 backdrop-blur-2xl">
          <div className="bg-white w-full max-w-2xl rounded-[5rem] p-16 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative text-center border-[8px] border-emerald-500">
             <button onClick={() => setIsStaffOpen(false)} className="absolute top-12 right-12 text-stone-400 hover:text-stone-900 font-black text-3xl">✕</button>
             <div className="text-9xl mb-10 drop-shadow-xl animate-bounce">👑</div>
             <h2 className="text-5xl font-black uppercase italic mb-4 tracking-tighter text-stone-900">Admin Panel</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                <Link href="/staff/users" className="group p-8 bg-stone-50 rounded-[2.5rem] font-black uppercase text-[13px] border-2 border-stone-100 hover:bg-stone-900 hover:text-white transition-all flex flex-col items-center gap-3"><span className="text-3xl">👥</span>Utenti</Link>
                <Link href="/staff/annunci" className="group p-8 bg-stone-50 rounded-[2.5rem] font-black uppercase text-[13px] border-2 border-stone-100 hover:bg-stone-900 hover:text-white transition-all flex flex-col items-center gap-3"><span className="text-3xl">📝</span>Moderazione</Link>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
   return <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-xs font-black uppercase tracking-[1em] text-stone-300 animate-pulse">Sincronizzazione LIBERO SCAMBIO...</p></div>}><HomePageContent /></Suspense>
}
