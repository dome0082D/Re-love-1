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
  
  // STATO AGGIUNTO PER LA PAGINAZIONE
  const [visibleCount, setVisibleCount] = useState(12)
  
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

  // LOGICA AGGIUNTA: Gli sponsorizzati sorpassano tutti gli altri!
  const sortedData = [...filteredData].sort((a, b) => {
    if (a.is_sponsored && !b.is_sponsored) return -1;
    if (!a.is_sponsored && b.is_sponsored) return 1;
    return 0; 
  })

  const topItems = sortedData.filter(i => i.condition === 'Nuovo').slice(0, 5)
  const regularItems = sortedData.filter(i => !topItems.find(t => t.id === i.id))

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      {IS_STAFF && (
        <button onClick={() => setIsStaffOpen(true)} className="fixed bottom-8 right-8 z-[99] bg-stone-900 text-rose-400 w-16 h-16 rounded-full shadow-lg font-bold flex items-center justify-center border-2 border-rose-400 hover:scale-105 active:scale-95 transition-all text-2xl">👑</button>
      )}

      {/* HERO SECTION MODIFICATA CON RE-LOVE */}
      <div className="relative h-[400px] flex flex-col items-center justify-center p-6 text-center overflow-hidden border-b border-rose-100 bg-white">
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-rose-50 to-orange-50 opacity-80 pointer-events-none"></div>
          <div className="relative z-10 w-full max-w-4xl px-4 flex flex-col items-center">
            
            <h1 
              className="text-6xl md:text-[110px] text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400 leading-none mb-3 drop-shadow-sm pb-4"
              style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 700 }}
            >
              Re-love
            </h1>
            <p className="text-[10px] md:text-[12px] font-bold uppercase tracking-[0.6em] text-stone-400 mb-10 ml-2">
              Vendi • Compra • Regala
            </p>
            
            <div className="relative group w-full max-w-2xl">
              <input type="text" placeholder="Cerca vestiti, elettronica, arredamento..." className="w-full p-5 pl-14 rounded-3xl bg-white border border-stone-200 outline-none text-sm font-medium focus:border-rose-400 focus:shadow-lg focus:shadow-rose-100 transition-all" onChange={(e) => setMainSearch(e.target.value)} />
              <span className="absolute left-5 top-5 opacity-40 text-xl">🔍</span>
            </div>
          </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-8 -mt-12 relative z-20">
        
        {/* SEZIONE FILTRI AGGIORNATA CON NUOVE CATEGORIE */}
        <section className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-6 rounded-3xl shadow-md border border-stone-100 items-center">
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold uppercase text-stone-400 ml-2 tracking-widest">Categoria</label>
            <select onChange={(e) => setSearchCategory(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-bold uppercase tracking-wide outline-none border border-stone-100 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer text-stone-700">
              <option value="all">Tutte le Categorie</option>
              <option value="Abbigliamento e Accessori">👕 Abbigliamento e Accessori</option>
              <option value="Elettronica e Informatica">💻 Elettronica e Informatica</option>
              <option value="Casa, Arredamento e Giardino">🛋️ Casa, Arredo, Giardino</option>
              <option value="Alimentari e Bevande">🍎 Alimentari e Bevande</option>
              <option value="Libri, Film e Musica">📚 Libri, Film e Musica</option>
              <option value="Salute e Bellezza">💄 Salute e Bellezza</option>
              <option value="Sport e Tempo Libero">⚽ Sport e Tempo Libero</option>
              <option value="Motori e Veicoli">🚗 Motori e Veicoli</option>
              <option value="Altro / Varie">📦 Altro / Varie</option>
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[9px] font-bold uppercase text-stone-400 ml-2 tracking-widest">Condizione Oggetto</label>
            <select onChange={(e) => setSearchCondition(e.target.value)} className="p-3 bg-stone-50 rounded-xl text-[11px] font-bold uppercase tracking-wide outline-none border border-stone-100 hover:bg-rose-50 hover:border-rose-200 transition-colors cursor-pointer text-stone-700">
              <option value="all">Tutte le Condizioni</option>
              <option value="Nuovo">✨ Nuovo</option>
              <option value="Usato">♻️ Usato</option>
              <option value="Regalo">🎁 In Regalo</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <button onClick={handleNearbySearch} className={`p-3 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2 ${distance > 0 ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-rose-200' : 'bg-stone-900 text-white hover:bg-stone-800'}`}>
              {distance > 0 ? '📍 Filtro 20km Attivo' : '📍 Cerca Vicino a me'}
            </button>
          </div>
        </section>

        {/* I 3 RIQUADRI MACRO-AZIONI AGGIORNATI COME RICHIESTO */}
        {!catFilter && !typeFilter && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <Link href="/add?mode=new" className="group flex flex-col rounded-3xl border border-stone-200 overflow-hidden bg-white hover:border-rose-400 transition-all shadow-sm text-center hover:-translate-y-1">
               <div className="relative h-56 w-full overflow-hidden bg-stone-50">
                 <img src="/nuovo.png" className="w-full h-full object-contain p-4 group-hover:scale-105 transition-all duration-[0.5s]" alt="Nuovo" />
               </div>
               <div className="p-6 bg-white flex-1 flex flex-col justify-center border-t border-stone-100">
                 <h3 className="text-2xl font-bold uppercase italic text-stone-900 leading-tight">Vendi Nuovo</h3>
                 <p className="text-[10px] font-medium uppercase mt-2 text-rose-600 tracking-widest">Mai usato o sigillato</p>
               </div>
            </Link>
            
            <Link href="/add?mode=used" className="group flex flex-col rounded-3xl border border-stone-200 overflow-hidden bg-white hover:border-orange-400 transition-all shadow-sm text-center hover:-translate-y-1">
               <div className="relative h-56 w-full overflow-hidden bg-stone-50">
                 <img src="/usato.png" className="w-full h-full object-contain p-4 group-hover:scale-105 transition-all duration-[0.5s]" alt="Usato" />
               </div>
               <div className="p-6 bg-white flex-1 flex flex-col justify-center border-t border-stone-100">
                 <h3 className="text-2xl font-bold uppercase italic text-stone-900 leading-tight">Vendi Usato</h3>
                 <p className="text-[10px] font-medium uppercase mt-2 text-orange-600 tracking-widest">Dai una seconda vita</p>
               </div>
            </Link>
            
            <Link href="/add?mode=gift" className="group flex flex-col rounded-3xl border border-stone-200 overflow-hidden bg-white hover:border-red-400 transition-all shadow-sm text-center hover:-translate-y-1">
               <div className="relative h-56 w-full overflow-hidden bg-stone-50">
                 <img src="/regalo.png" className="w-full h-full object-contain p-4 group-hover:scale-105 transition-all duration-[0.5s]" alt="Regalo" />
               </div>
               <div className="p-6 bg-white flex-1 flex flex-col justify-center border-t border-stone-100">
                 <h3 className="text-2xl font-bold uppercase italic text-stone-900 leading-tight">Regalo Solidale</h3>
                 <p className="text-[10px] font-medium uppercase mt-2 text-red-500 tracking-widest">Dona a chi ha bisogno</p>
               </div>
            </Link>
          </div>
        )}

        {/* BANNER PUBBLICITARIO RE-LOVE */}
        <div className="bg-gradient-to-r from-stone-900 to-stone-800 rounded-3xl p-6 mb-16 flex flex-col md:flex-row items-center justify-between shadow-xl border border-stone-800">
          <div className="flex items-center gap-6 mb-4 md:mb-0">
            <span className="text-5xl drop-shadow-md">🚀</span>
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-widest text-orange-400">Spazio Pubblicitario</h4>
              <p className="text-[11px] text-stone-300 font-medium mt-1 uppercase tracking-wider">Metti in evidenza i tuoi annunci Re-love. Sponsorizzati qui!</p>
            </div>
          </div>
          <a href="mailto:dome0082@gmail.com" className="bg-gradient-to-r from-rose-500 to-orange-400 text-white px-6 py-3 rounded-xl text-[11px] font-bold uppercase tracking-widest hover:shadow-lg hover:scale-105 transition-all w-full md:w-auto text-center border border-rose-400">
            Contattaci per info
          </a>
        </div>

        <section className="mb-20">
          <div className="flex justify-between items-end mb-8 border-b border-stone-200 pb-4">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.4em] text-stone-900">Vetrina Top Nuovo</h2>
            <Link href="/?condition=Nuovo" className="text-[10px] font-bold uppercase text-rose-600 hover:text-rose-800 transition-colors">Vedi tutti →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            {topItems.map(item => (
              <div key={item.id} className={`group bg-white p-4 rounded-3xl shadow-sm border ${item.is_sponsored ? 'border-orange-400 shadow-orange-100 shadow-md ring-1 ring-orange-400/30' : 'border-stone-100'} hover:shadow-md transition-all relative overflow-hidden`}>
                
                {item.is_sponsored && (
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[8px] font-bold uppercase px-3 py-1.5 rounded-br-2xl z-40 tracking-widest shadow-sm">
                    In Evidenza ✨
                  </div>
                )}

                <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-6 right-6 z-30 bg-white/90 w-8 h-8 flex items-center justify-center rounded-full shadow-sm text-lg hover:scale-110 transition-all">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                <Link href={`/announcement/${item.id}`}>
                  <div className="aspect-square rounded-2xl overflow-hidden bg-stone-50 mb-4 relative border-2 border-white shadow-inner">
                    <img src={item.image_url || "/nuovo.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[0.8s]" />
                  </div>
                  <h4 className="text-[12px] font-medium uppercase truncate text-stone-900 mb-1 px-1">{item.title}</h4>
                  <div className="flex justify-between items-center px-1 mb-3">
                    <p className="text-xl font-bold text-rose-600 tracking-tight">€ {item.price}</p>
                    <p className="text-[9px] text-stone-400 font-medium tracking-tighter">Disp: {item.quantity}</p>
                  </div>
                  <button className="mt-2 w-full bg-stone-100 text-stone-800 text-[10px] font-bold uppercase py-3 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition-all">Vedi Dettagli</button>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex justify-between items-end mb-8 border-b border-stone-200 pb-4">
            <h2 className="text-[14px] font-bold uppercase tracking-[0.4em] text-stone-400">Tutti gli Annunci</h2>
            <p className="text-[10px] font-medium uppercase text-stone-400 tracking-[0.2em]">{regularItems.length} Inserzioni</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
            {regularItems.slice(0, visibleCount).map(item => (
              <div key={item.id} className={`group bg-white rounded-2xl overflow-hidden shadow-sm border ${item.is_sponsored ? 'border-orange-400 ring-1 ring-orange-400/30' : 'border-stone-100'} hover:shadow-md hover:border-rose-300 transition-all flex flex-col relative`}>
                
                {item.is_sponsored && (
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[7px] font-bold uppercase px-2 py-1 rounded-br-xl z-40 tracking-widest">
                    Top 🌟
                  </div>
                )}
                
                <Link href={`/announcement/${item.id}`} className="aspect-square bg-stone-50 relative block overflow-hidden">
                  <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-2 right-2 z-30 bg-white/80 w-6 h-6 flex items-center justify-center rounded-full shadow-sm text-xs hover:scale-110 transition-all">{favorites.includes(item.id) ? '❤️' : '🤍'}</button>
                  <img src={item.image_url || "/usato.png"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[0.8s]" />
                  <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest text-stone-600 shadow-sm">{item.condition}</div>
                </Link>
                <div className="p-3 flex flex-col justify-between flex-grow">
                  <Link href={`/announcement/${item.id}`} className="block">
                    <h4 className="text-[10px] font-bold uppercase line-clamp-2 text-stone-800 leading-tight mb-1">{item.title}</h4>
                    <p className="text-[14px] font-black text-rose-600 mt-1">€ {item.price}</p>
                  </Link>
                  <Link href={`/announcement/${item.id}`} className="mt-3 block text-center w-full bg-stone-50 text-stone-600 text-[9px] font-bold uppercase py-2 rounded-lg hover:bg-stone-900 hover:text-white transition-colors">
                    Acquista
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {regularItems.length > visibleCount && (
            <div className="mt-12 flex justify-center w-full">
              <button 
                onClick={() => setVisibleCount(prev => prev + 12)}
                className="bg-white border-2 border-rose-200 text-rose-600 px-8 py-4 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-rose-50 hover:border-rose-400 transition-all shadow-sm"
              >
                ↓ Carica altri annunci ({regularItems.length - visibleCount} rimanenti)
              </button>
            </div>
          )}

        </section>

      </main>
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Caricamento Vetrina...</div>}>
      <HomePageContent />
    </Suspense>
  )
}