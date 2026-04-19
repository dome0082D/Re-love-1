'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [myAds, setMyAds] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    const ads = await supabase.from('announcements').select('*').eq('user_id', user.id)
    if (ads.data) setMyAds(ads.data)
    const revs = await supabase.from('reviews').select('*').eq('receiver_id', user.id)
    if (revs.data) setReviews(revs.data)
  }

  const deleteAccount = async () => {
    if (confirm("Attenzione: Vuoi eliminare tutto definitivamente?")) {
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm flex justify-between items-center mb-8">
          <div><h1 className="text-2xl font-black uppercase italic">Area Personale</h1><p className="text-xs font-bold text-stone-400 mt-1">{user?.email}</p></div>
          <div className="flex gap-2">
            <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-[9px] font-black uppercase bg-stone-100 px-4 py-2 rounded-xl">Logout</button>
            <button onClick={deleteAccount} className="text-[9px] font-black uppercase bg-red-50 text-red-500 px-4 py-2 rounded-xl border border-red-100">Elimina Account</button>
          </div>
        </div>

        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">I miei annunci</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {myAds.map(ad => (
            <div key={ad.id} className="bg-white p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase truncate">{ad.title}</span>
              <button onClick={async () => { await supabase.from('announcements').delete().eq('id', ad.id); loadData() }} className="text-red-500 text-[10px] font-black uppercase">Elimina</button>
            </div>
          ))}
        </div>

        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Recensioni Ricevute</h2>
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-white p-4 rounded-2xl border border-stone-200 text-xs italic">"{r.comment}" - Valutazione: {r.rating}/5</div>
          ))}
          {reviews.length === 0 && <p className="text-xs text-stone-300 font-bold uppercase">Nessuna recensione.</p>}
        </div>

        <Link href="/" className="block text-center text-[10px] font-black uppercase text-stone-400 mt-12">← Torna alla Home</Link>
      </div>
    </div>
  )
}