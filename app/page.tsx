'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function HomePageContent() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [mainSearch, setMainSearch] = useState('') 
  const [adNumberSearch, setAdNumberSearch] = useState('') 
  const [searchCategory, setSearchCategory] = useState('all')
  const [condition, setCondition] = useState('all')
  const [isStaffOpen, setIsStaffOpen] = useState(false)
  const router = useRouter()

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    if (data) setAnnouncements(data)
  }

  const filteredAnnouncements = announcements.filter(a => {
    const matchMain = String(a.title || '').toLowerCase().includes(mainSearch.toLowerCase());
    const matchAdNumber = adNumberSearch === '' || String(a.id).includes(adNumberSearch);
    const matchCat = searchCategory === 'all' || a.category === searchCategory;
    const matchCond = condition === 'all' || a.condition === condition;
    return matchMain && matchAdNumber && matchCat && matchCond;
  });

  const showcaseNew = filteredAnnouncements.filter(a => a.condition === 'Nuovo').slice(0, 5);
  const others = filteredAnnouncements.filter(a => showcaseNew.every(s => s.id !== a.id));

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      {IS_STAFF && (
        <button onClick={() => setIsStaffOpen(true)} className="fixed bottom-6 right-6 z-50 bg-stone-900 text-emerald-400 w-14 h-14 rounded-full shadow-lg font-black flex items-center justify-center border border-emerald-400 hover:scale-110 transition-all">👑</button>
      )}

      {/* TESTATA */}
      <div className="relative h-[220px] flex flex-col items-center justify-center p-6 text-center overflow-hidden border-b border-stone-200 bg-white">
          <img src="/gazebo.jpg" className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Materiali Sfondo" />
          <div className="relative z-10 w-full max-w-lg">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter text-stone-900">Materiali</h1>
            <div className="mt-6 w-full relative">
              <input type="text" placeholder="Cerca materiale..." className="w-full p-4 pl-12 rounded-2xl bg-white border border-stone-200 outline-none text-sm focus:border-stone-400 shadow-sm" onChange={(e)=>setMainSearch(e.target.value)} />
              <span className="absolute left-4 top-4 opacity-30 text-lg">🔍</span>
            </div>
            <div className="mt-4 text-[10px] font-black uppercase flex justify-center gap-4 text-stone-600">
               {user ? (
                 <>
                  <Link href="/profile" className="hover:text-emerald-600">Mio Profilo</Link>
                  <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="hover:text-red-500">Esci Sessione</button>
                 </>
               ) : (
                 <Link href="/login" className="hover:text-emerald-600">Accedi / Registrati</Link>
               )}
            </div>
          </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {/* FILTRI */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" value={adNumberSearch} placeholder="Cerca numero annuncio" className="p-4 bg-white border border-stone-200 rounded-xl text-xs font-bold outline-none shadow-sm" onChange={(e)=>setAdNumberSearch(e.target.value)} />
          <select onChange={(e)=>setSearchCategory(e.target.value)} className="p-4 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
            <option value="all">Tutte le Categorie</option>
            <option value="Casa">Casa</option><option value="Elettronica">Elettronica</option><option value="Libri">Libri</option><option value="Sport">Sport</option><option value="Altro">Altro</option>
          </select>
          <select onChange={(e)=>setCondition(e.target.value)} className="p-4 bg-white border border-stone-200 rounded-xl text-[10px] font-black uppercase outline-none shadow-sm">
            <option value="all">Tutte le Condizioni</option>
            <option value="Nuovo">Solo Nuovo</option><option value="Usato">Usato / Regalo</option>
          </select>
        </section>

        {/* 3 RIQUADRI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/add?mode=new" className="group relative h-48 rounded-2xl border border-stone-200 overflow-hidden bg-white hover:border-stone-400 transition-all shadow-sm flex items-center justify-center text-center">
             <img src="/nuovo.png" className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-all" alt="Nuovo" />
             <div className="relative z-10 p-6"><h3 className="text-2xl font-black uppercase italic text-stone-900">Vendi Nuovo</h3></div>
          </Link>

          <Link href="/add?mode=used" className="group relative h-48 rounded-2xl border border-stone-200 overflow-hidden bg-white hover:border-stone-400 transition-all shadow-sm flex items-center justify-center text-center">
             <img src="/usato.png" className="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:opacity-40 transition-all" alt="Usato" />
             <div className="relative z-10 p-6"><h3 className="text-2xl font-black uppercase italic text-stone-900">Vendi Usato</h3></div>
          </Link>

          <Link href="/add?mode=gift" className="group relative h-48 rounded-2xl border-2 border-emerald-500 overflow-hidden bg-white hover:bg-emerald-50 transition-all shadow-md flex items-center justify-center text-center">
             <img src="/regala.jpeg" className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-all" alt="Regala" />
             <div className="relative z-10 p-6"><h3 className="text-lg font-black uppercase italic text-emerald-800 leading-tight">Non sai cosa fartene e non vuoi i soldi?<br/>Regalalo</h3></div>
          </Link>
        </div>

        {/* VETRINA TOP NUOVO */}
        <section className="mt-16">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Vetrina Top Nuovo</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {showcaseNew.map(ann => (
              <div key={ann.id} className="group bg-white p-2 rounded-xl shadow-sm border border-stone-100">
                <div className="aspect-square rounded-lg overflow-hidden bg-stone-50 border border-stone-100 mb-2"><img src={ann.image_url || "/nuovo.png"} className="w-full h-full object-cover" /></div>
                <h4 className="text-[10px] font-bold uppercase truncate px-1">{ann.title}</h4>
                <p className="text-emerald-600 font-black text-[11px] mt-1 px-1">€ {ann.price}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEED TUTTI GLI OGGETTI (GRIGLIA FITTA) */}
        <section className="mt-12">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Tutti gli Oggetti</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {others.map(ann => (
              <div key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col">
                <div className="h-28 bg-stone-50 relative border-b border-stone-100">
                  <img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover" />
                  {ann.type === 'offered' && <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase shadow-sm">Regalo</span>}
                </div>
                <div className="p-3">
                    <h4 className="text-[10px] font-bold uppercase truncate text-stone-800">{ann.title}</h4>
                    <p className="text-[11px] font-black mt-1 text-stone-900">{ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}</p>
                  {IS_STAFF && <button onClick={async ()=>{if(confirm("Eliminare?")){await supabase.from('announcements').delete().eq('id', ann.id); fetchData()}}} className="mt-3 text-[8px] font-black text-red-500 uppercase bg-red-50 px-2 py-2 rounded w-full border border-red-100">Elimina Staff</button>}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* POP-UP STAFF */}
      {isStaffOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl relative text-center space-y-3">
             <button onClick={() => setIsStaffOpen(false)} className="absolute top-6 right-6 text-stone-400 font-black">✕</button>
             <h2 className="text-xl font-black uppercase italic mb-8 border-b pb-4">Area Staff</h2>
             <button className="block w-full p-4 bg-stone-50 rounded-xl font-black uppercase text-[10px] border border-stone-200">👥 Gestione Profili (In arrivo)</button>
             <Link href="/chat" className="block w-full p-4 bg-stone-50 rounded-xl font-black uppercase text-[10px] border border-stone-200 hover:bg-stone-900 hover:text-white transition-all">💬 Visualizza Chat Globali</Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
   return <Suspense fallback={<div className="p-10 font-black uppercase text-xs text-center">Caricamento...</div>}><HomePageContent /></Suspense>
}
