'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function ProfileContent() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>({ first_name: '', residence_city: '' })
  const [myAds, setMyAds] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) { router.push('/register'); return; }
    setUser(u)

    const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (p) setProfile(p)

    const { data: ads } = await supabase.from('announcements').select('*').eq('user_id', u.id).order('created_at', { ascending: false })
    if (ads) setMyAds(ads)
  }

  async function deleteAccount() {
    if(!confirm("ATTENZIONE: Cancellerai per sempre il tuo profilo e tutti i tuoi annunci. Procedere?")) return;
    await supabase.from('announcements').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.signOut();
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-12 font-sans flex flex-col items-center">
       <div className="w-full max-w-2xl bg-white p-10 rounded-[2.5rem] shadow-xl space-y-8 border border-stone-100">
          <div className="flex justify-between items-center border-b pb-4">
             <h1 className="text-2xl font-black uppercase italic">Area Personale</h1>
             <Link href="/" className="text-[9px] font-black uppercase text-stone-400 bg-stone-100 px-3 py-2 rounded-lg hover:bg-stone-200 transition-colors">Home</Link>
          </div>

          <div className="space-y-4">
             <input value={profile.first_name || ''} placeholder="Il tuo Nome" className="w-full p-4 bg-stone-50 border rounded-2xl text-sm font-bold outline-none" onChange={(e)=>setProfile({...profile, first_name:e.target.value})} />
             <input value={profile.residence_city || ''} placeholder="La tua Città" className="w-full p-4 bg-stone-50 border rounded-2xl text-sm font-bold outline-none" onChange={(e)=>setProfile({...profile, residence_city:e.target.value})} />
             <button onClick={async ()=> { await supabase.from('profiles').upsert({id:user.id, ...profile}); alert("Dati salvati!") }} className="w-full py-4 bg-stone-900 text-white rounded-2xl font-black uppercase text-[10px] shadow-lg hover:bg-emerald-600 transition-all">Salva Dati</button>
          </div>

          <div className="mt-8">
             <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mb-4">I Miei Annunci ({myAds.length})</h2>
             <div className="space-y-3">
                {myAds.map(ad => (
                   <div key={ad.id} className="flex justify-between items-center bg-stone-50 p-4 rounded-xl border border-stone-100">
                      <span className="text-xs font-bold uppercase truncate">{ad.title}</span>
                      <button onClick={async () => { if(confirm("Eliminare?")) { await supabase.from('announcements').delete().eq('id', ad.id); load(); } }} className="text-[9px] font-black uppercase bg-red-50 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition-colors">Elimina</button>
                   </div>
                ))}
                {myAds.length === 0 && <p className="text-[10px] font-bold text-stone-300 uppercase">Nessun annuncio pubblicato.</p>}
             </div>
          </div>

          <div className="pt-8 border-t flex flex-col gap-4 text-center">
             <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-[10px] font-black uppercase text-stone-500 hover:text-stone-900">Disconnettiti</button>
             <button onClick={deleteAccount} className="text-[9px] font-black uppercase text-red-500 hover:text-red-700 bg-red-50 py-3 rounded-xl transition-colors">🗑️ Elimina Account Definitivamente</button>
          </div>
       </div>
    </div>
  );
}

export default function ProfilePage() {
  return <Suspense fallback={<div className="p-10 font-black uppercase text-xs text-center">Caricamento...</div>}><ProfileContent /></Suspense>
}
