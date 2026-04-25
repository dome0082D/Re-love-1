'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface PublicProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  created_at: string;
}

export default function PublicProfilePage() {
  const { id } = useParams()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublicData()
  }, [id])

  async function fetchPublicData() {
    setLoading(true)
    
    // 1. Dati Profilo
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).single()
    
    // 2. Annunci attivi dell'utente
    const { data: ads } = await supabase.from('announcements')
      .select('*')
      .eq('user_id', id)
      .eq('quantity', 1) // Solo roba disponibile
      .order('created_at', { ascending: false })

    // 3. Recensioni ricevute
    const { data: revs } = await supabase.from('reviews')
      .select('*, reviewer:reviewer_id(email, first_name)')
      .eq('reviewed_id', id)
      .order('created_at', { ascending: false })

    if (prof) setProfile(prof as PublicProfile)
    if (ads) setAnnouncements(ads)
    if (revs) setReviews(revs)
    
    setLoading(false)
  }

  // Calcolo media stelline
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "N/D"

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase text-stone-400 text-[10px] tracking-widest">Caricamento Profilo...</div>

  if (!profile) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase text-rose-500 text-[10px]">Utente non trovato</div>

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* HEADER PROFILO */}
      <div className="bg-white border-b border-stone-200 pt-20 pb-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="w-32 h-32 bg-gradient-to-tr from-rose-500 to-orange-400 rounded-[3rem] flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-rose-100">
            {profile.first_name?.[0] || profile.email?.[0].toUpperCase()}
          </div>
          
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-black uppercase italic text-stone-900 tracking-tighter">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">
              📍 {profile.city || 'Città non specificata'} • Membro dal {new Date(profile.created_at).getFullYear()}
            </p>
            
            <div className="flex items-center justify-center md:justify-start gap-4 mt-6">
              <div className="bg-stone-900 text-white px-4 py-2 rounded-xl flex items-center gap-2">
                <span className="text-yellow-400 text-lg">★</span>
                <span className="font-black text-sm">{avgRating}</span>
                <span className="text-[10px] text-stone-400 uppercase font-bold">({reviews.length})</span>
              </div>
              <button className="border-2 border-stone-100 hover:border-rose-200 text-stone-400 hover:text-rose-500 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                Segui
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* COLONNA SINISTRA: ANNUNCI ATTIVI */}
        <div className="lg:col-span-2">
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-8 border-l-4 border-rose-500 pl-4">
            Armadio di {profile.first_name || 'questo utente'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {announcements.map(ann => (
              <Link href={`/announcement/${ann.id}`} key={ann.id} className="group bg-white rounded-3xl overflow-hidden border border-stone-100 hover:shadow-xl transition-all">
                <div className="h-40 bg-stone-100">
                  <img src={ann.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" alt="img" />
                </div>
                <div className="p-5">
                  <h3 className="font-black uppercase italic text-sm text-stone-900 truncate">{ann.title}</h3>
                  <p className="text-rose-500 font-black mt-1">€ {ann.price}</p>
                </div>
              </Link>
            ))}
            {announcements.length === 0 && <p className="text-xs font-bold text-stone-400 uppercase italic">Nessun annuncio attivo al momento.</p>}
          </div>
        </div>

        {/* COLONNA DESTRA: FEEDBACK / RECENSIONI */}
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-8 border-l-4 border-yellow-400 pl-4">
            Cosa dicono di {profile.first_name || 'lui/lei'}
          </h2>
          
          <div className="space-y-6">
            {reviews.map(rev => (
              <div key={rev.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm relative">
                <div className="flex gap-1 text-yellow-400 text-xs mb-2">
                  {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                </div>
                <p className="text-xs text-stone-600 font-medium leading-relaxed italic">
                  "{rev.comment}"
                </p>
                <div className="mt-4 pt-4 border-t border-stone-50 flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase text-stone-400">
                    Da: {rev.reviewer?.first_name || rev.reviewer?.email.split('@')[0]}
                  </span>
                  <span className="text-[8px] font-bold text-stone-300">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {reviews.length === 0 && <p className="text-xs font-bold text-stone-400 uppercase italic">Ancora nessuna recensione.</p>}
          </div>
        </div>

      </main>
    </div>
  )
}