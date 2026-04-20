'use client'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

function HomePageContent() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [mainSearch, setMainSearch] = useState('') 
  const [adNumberSearch, setAdNumberSearch] = useState('') 
  const [searchCategory, setSearchCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [distance, setDistance] = useState(0) // 0 = Tutte
  const [isStaffOpen, setIsStaffOpen] = useState(false)
  
  const router = useRouter()
  // SENSORE PER L'URL: Legge se c'è scritto "?type=offered" nel link
  const searchParams = useSearchParams()
  const typeFilter = searchParams.get('type')

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
    if (u) {
      const { data: favs } = await supabase.from('favorites').select('announcement_id').eq('user_id', u.id)
      if (favs) setFavorites(favs.map(f => f.announcement_id))
    }
  }

  const toggleNearby = () => {
    if (distance > 0) { setDistance(0); fetchData(); } 
    else {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        setDistance(20);
        const { data } = await supabase.rpc('get_nearby_announcements', {
          user_lat: pos.coords.latitude, user_lon: pos.coords.longitude, radius_meters: 20000
        });
        if (data) setAnnouncements(data);
      });
    }
  };

  async function toggleFavorite(e: any, annId: string) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { alert("Accedi per i preferiti"); return; }
    if (favorites.includes(annId)) {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('announcement_id', annId);
      setFavorites(favorites.filter(id => id !== annId));
    } else {
      await supabase.from('favorites').insert([{ user_id: user.id, announcement_id: annId }]);
      setFavorites([...favorites, annId]);
    }
  }

  // LOGICA DI FILTRAGGIO AGGIORNATA
  const filteredAnnouncements = announcements.filter(a => {
    const matchMain = String(a.title || '').toLowerCase().includes(mainSearch.toLowerCase());
    const matchAdNumber = adNumberSearch === '' || String(a.id).includes(adNumberSearch);
    const matchCat = searchCategory === 'all' || a.category === searchCategory;
    const matchCond = condition === 'all' || a.condition === condition;
    const matchQty = a.quantity !== 0; // Nasconde gli esauriti
    
    // NUOVO FILTRO: Se c'è "?type=offered" nell'URL, mostra solo i regali. Altrimenti mostrali tutti.
    const matchType = !typeFilter || a.type === typeFilter; 

    return matchMain && matchAdNumber && matchCat && matchCond && matchQty && matchType;
  });

  const showcaseNew = filteredAnnouncements.filter(a => a.condition === 'Nuovo').slice(0, 5);
  const others = filteredAnnouncements.filter(a => showcaseNew.every(s => s.id !== a.id));

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      {IS_STAFF && (
        <button onClick={() => setIsStaffOpen(true)} className="fixed bottom-6 right-6 z-50 bg-stone-900 text-emerald-400 w-14 h-14 rounded-full shadow-lg font-black flex items-center justify-center border border-emerald-400 hover:scale-110 transition-all">👑</button>
      )}

      {/* SEZIONE FILTRO ATTIVO (Mostra un banner se stai guardando solo i regali) */}
      {typeFilter === 'offered' && (
        <div className="bg-emerald-500 text-white text-center p-3 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-4">
          <span>Stai visualizzando solo gli oggetti in regalo 🎁</span>
          <Link href="/" className="underline hover:text-stone-200">Rimuovi Filtro ✕</Link>
        </div>
      )}

      {/* TESTATA */}
      <div className="relative h-[220px] flex flex-col items-center justify-center p-6 text-center overflow-hidden border-b border-stone-200 bg-white">
          <img src="/gazebo.jpg" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Sfondo" />
          <div className="relative z-10 w-full max-w-lg">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter text-stone-900">Materiali</h1>
            <div className="mt-6 w-full relative">
              <input type="text" placeholder="Cerca materiale..." className="w-full p-4 pl-12 rounded-2xl bg-white border border-stone-200 outline-none text-sm focus:border-stone-400 shadow-sm" onChange={(e)=>setMainSearch(e.target.value)} />
              <span className="absolute left-4 top-4 opacity-30 text-lg">🔍</span>
            </div>
            
            {/* HO RIMOSSO IL VECCHIO MENU ACCEDI QUI, ORA C'È LA NAVBAR IN ALTO */}
          </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input type="text" placeholder="N. Annuncio" className="p-4 bg-white border border-stone-200 rounded-xl text-xs font-bold outline-none shadow-sm" onChange={(e)=>setAdNumberSearch(e.target.value)} />
          <select onChange={(e)=>setSearchCategory(e.target.value)} className="p-4 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
            <option value="all">Tutte le Categorie</option>
            <option value="Casa">Casa</option><option value="Elettronica">Elettronica</option><option value="Libri">Libri</option><option value="Sport">Sport</option><option value="Altro">Altro</option>
          </select>
          <select onChange={(e)=>setCondition(e.target.value)} className="p-4 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
            <option value="all">Tutte le Condizioni</option>
            <option value="Nuovo">Solo Nuovo</option><option value="Usato">Usato / Regalo</option>
          </select>
          <button onClick={toggleNearby} className={`p-4 rounded-xl text-[10px] font-black uppercase shadow-sm border transition-all ${distance > 0 ? 'bg-emerald-500 text-white border-emerald-600' : 'bg-white text-stone-900 border-stone-200'}`}>
            {distance > 0 ? `Entro 20km 📍` : "Vicino a me 📍"}
          </button>
        </section>

        {/* BOX AZIONI (Li nascondiamo se l'utente sta cercando solo i regali) */}
        {!typeFilter && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/add?mode=new" className="group relative h-48 rounded-2xl border border-stone-200 overflow-hidden bg-white hover:border-stone-400 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/nuovo.png" className="absolute inset-0 w-full h-full object-cover opacity-20" alt="Nuovo" />
               <div className="relative z-10 p-6"><h3 className="text-2xl font-black uppercase italic text-stone-900">Vendi Nuovo</h3></div>
            </Link>
            <Link href="/add?mode=used" className="group relative h-48 rounded-2xl border border-stone-200 overflow-hidden bg-white hover:border-stone-400 transition-all shadow-sm flex items-center justify-center text-center">
               <img src="/usato.png" className="absolute inset-0 w-full h-full object-cover opacity-20" alt="Usato" />
               <div className="relative z-10 p-6"><h3 className="text-2xl font-black uppercase italic text-stone-900">Vendi Usato</h3></div>
            </Link>
            <Link href="/add?mode=gift" className="group relative h-48 rounded-2xl border-2 border-emerald-500 overflow-hidden bg-white hover:bg-emerald-50 transition-all shadow-md flex items-center justify-center text-center">
               <img src="/regala.jpeg" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Regala" />
               <div className="relative z-10 p-6"><h3 className="text-lg font-black uppercase italic text-emerald-800 leading-tight">Non sai cosa fartene e non vuoi i soldi?<br/>Regalalo</h3></div>
            </Link>
          </div>
        )}

        {/* FEED ANNUNCI */}
        <section className="mt-16">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">
            {typeFilter === 'offered' ? 'In Evidenza (Regalo)' : 'Vetrina Top Nuovo'}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {showcaseNew.map(ann => (
              <Link href={`/announcement/${ann.id}`} key={ann.id} className="group bg-white p-3 rounded-xl shadow-sm border border-stone-100 relative">
                <button onClick={(e) => toggleFavorite(e, ann.id)} className="absolute top-4 right-4 z-20 bg-white/80 rounded-full p-2 text-xs">{favorites.includes(ann.id) ? '❤️' : '🤍'}</button>
                <div className="aspect-square rounded-lg overflow-hidden bg-stone-50 border border-stone-100 mb-3"><img src={ann.image_url || "/nuovo.png"} className="w-full h-full object-cover" /></div>
                <h4 className="text-[11px] font-bold uppercase truncate">{ann.title}</h4>
                <p className="text-emerald-600 font-black text-sm mt-1">{ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}</p>
                <button className="mt-3 w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg group-hover:bg-stone-900 group-hover:text-white transition-colors">Vedi Dettagli</button>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Tutti gli Oggetti</h2>
          
          {others.length === 0 ? (
            <p className="text-center text-sm font-bold text-stone-500 py-10">Nessun oggetto trovato con questi filtri.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {others.map(ann => (
                <Link href={`/announcement/${ann.id}`} key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col group relative hover:border-emerald-400 transition-colors">
                  <button onClick={(e) => toggleFavorite(e, ann.id)} className="absolute top-2 left-2 z-20 bg-white/80 rounded-full p-1.5 text-[10px]">{favorites.includes(ann.id) ? '❤️' : '🤍'}</button>
                  <div className="h-32 bg-stone-50 relative"><img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover" /></div>
                  <div className="p-3">
                      <h4 className="text-[11px] font-bold uppercase truncate">{ann.title}</h4>
                      <p className="text-[13px] font-black mt-1">{ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}</p>
                      <button className="mt-3 w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg group-hover:bg-stone-900 group-hover:text-white transition-colors">Dettagli</button>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* POP-UP STAFF */}
      {isStaffOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl relative text-center space-y-3">
             <button onClick={() => setIsStaffOpen(false)} className="absolute top-6 right-6 text-stone-400 font-black">✕</button>
             <h2 className="text-xl font-black uppercase italic mb-8 border-b pb-4">Area Staff</h2>
             <Link href="/staff/users" className="block w-full p-4 bg-stone-50 rounded-xl font-black uppercase text-[10px] border border-stone-200 hover:bg-stone-900 hover:text-white transition-all">👥 Gestione Profili</Link>
             <Link href="/chat" className="block w-full p-4 bg-stone-50 rounded-xl font-black uppercase text-[10px] border border-stone-200 hover:bg-stone-900 hover:text-white transition-all">💬 Chat</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
   return <Suspense fallback={<div className="p-10 font-black uppercase text-xs text-center">Caricamento...</div>}><HomePageContent /></Suspense>
}
