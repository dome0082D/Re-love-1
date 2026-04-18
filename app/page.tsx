'use client'
import { useEffect, useState } from 'react'
import { supabase } from './../lib/supabase'
import Link from 'next/link'

export default function HomePage() {
  const [user, setUser] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isStaffMenuOpen, setIsStaffMenuOpen] = useState(false)

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { fetchData() }, [])

  useEffect(() => {
    let res = announcements.filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()))
    setFiltered(res)
  }, [searchTerm, announcements])

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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* MENU STAFF FISSO A SCOMPARSA */}
      {IS_STAFF && (
        <>
          <button onClick={() => setIsStaffMenuOpen(true)} className="fixed bottom-6 right-6 z-50 bg-red-600 text-white w-14 h-14 rounded-full shadow-2xl font-black text-xl hover:scale-110 transition-all">👑</button>
          <div className={`fixed top-0 right-0 h-full w-80 bg-slate-900 z-[60] transform transition-transform duration-500 ${isStaffMenuOpen ? 'translate-x-0' : 'translate-x-full'} shadow-2xl p-6 text-white`}>
            <div className="flex justify-between mb-8 border-b border-slate-700 pb-4">
              <span className="font-black uppercase tracking-widest">Pannello Staff</span>
              <button onClick={() => setIsStaffMenuOpen(false)}>✕</button>
            </div>
            <div className="space-y-4">
              <Link href="/profile" className="block p-4 bg-slate-800 rounded-lg font-bold hover:bg-red-600 uppercase text-[10px] text-center">Gestione Utenti / Profili</Link>
              <Link href="/chat" className="block p-4 bg-slate-800 rounded-lg font-bold hover:bg-red-600 uppercase text-[10px] text-center">Monitoraggio Tutte le Chat</Link>
              <p className="text-[9px] text-slate-400 mt-10 uppercase italic">ID STAFF: USR-1</p>
            </div>
          </div>
          {isStaffMenuOpen && <div onClick={() => setIsStaffMenuOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]"></div>}
        </>
      )}

      <main className="max-w-[1600px] mx-auto bg-white min-h-screen shadow-xl border-x">
        <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b px-8 py-5 flex justify-between items-center">
          <Link href="/" className="text-2xl font-black italic tracking-tighter uppercase text-slate-800">MATERIALI</Link>
          <div className="flex gap-4 items-center">
            {user ? (
              <>
                <Link href="/chat" className="bg-slate-100 p-2.5 rounded-lg text-[10px] font-black">💬 CHAT</Link>
                <Link href="/profile" className="text-[10px] font-black uppercase bg-slate-100 px-5 py-2.5 rounded-lg">Profilo</Link>
                <Link href="/add" className="bg-sky-600 text-white px-6 py-2.5 rounded-lg text-[10px] font-black uppercase shadow-lg">+ Pubblica</Link>
              </>
            ) : (
              <Link href="/register" className="bg-slate-800 text-white px-8 py-3 rounded-lg text-[10px] font-black uppercase">Accedi</Link>
            )}
          </div>
        </nav>

        {/* HERO */}
        <div className="px-6 mt-6">
          <div className="relative h-[350px] rounded-3xl overflow-hidden shadow-xl">
            <img src="/gazebo.jpg" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-8">
              <h1 className="text-4xl md:text-6xl font-black text-white mb-8 italic uppercase drop-shadow-2xl">Recupera, Regala, Vendi.</h1>
              <input type="text" placeholder="Cerca nel mercato..." className="w-full max-w-xl p-5 rounded-2xl bg-white shadow-2xl outline-none" onChange={(e)=>setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        {/* CATALOGO */}
        <div className="p-8 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {filtered.map((ann) => (
            <div key={ann.id} className="bg-white border rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all relative">
              {IS_STAFF && <button onClick={()=>deleteAd(ann.id)} className="absolute top-2 left-2 z-20 bg-red-600 text-white p-2 rounded-lg text-[8px] font-black shadow-lg">ELIMINA STAFF</button>}
              <div className="h-40 bg-slate-100 relative">
                <img src={ann.image_url || "/gazebo.jpg"} className="w-full h-full object-cover" />
                <span className="absolute top-2 right-2 px-2 py-1 bg-indigo-600 text-white text-[8px] font-black rounded uppercase">{ann.type}</span>
              </div>
              <div className="p-4">
                <h4 className="text-[10px] font-black uppercase truncate">{ann.title}</h4>
                <div className="mt-4 flex justify-between items-center">
                  <span className="font-black text-sm italic">€{ann.price}</span>
                  <Link href={`/chat/${ann.user_id}?ann=${ann.id}`} className="bg-sky-50 text-sky-600 px-4 py-2 rounded-lg text-[9px] font-black uppercase">Chat</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
