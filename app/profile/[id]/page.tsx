'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

interface PublicProfile {
  id: string;
  email: string;
  nickname?: string; // Usiamo il nickname
  city?: string;
  bio?: string;      // Aggiunta Bio
  avatar_url?: string; // Aggiunto Avatar
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
    
    // 1. Dati Profilo (Inclusi Nickname, Bio e Avatar)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', id).single()
    
    // 2. Annunci attivi dell'utente
    const { data: ads } = await supabase.from('announcements')
      .select('*')
      .eq('user_id', id)
      .eq('quantity', 1) 
      .order('created_at', { ascending: false })

    // 3. Recensioni ricevute (Aggiornato per cercare il nickname del recensore)
    // FIX: questa lettura falliva SEMPRE, per due motivi insieme.
    //  1. Filtrava su "reviewed_user_id", colonna che non esiste: nella
    //     tabella si chiama "reviewed_id".
    //  2. Chiedeva la join "reviewer:profiles!reviewer_id(...)", ma fra
    //     "reviews" e "profiles" non c'e' nessuna chiave esterna, quindi
    //     PostgREST rispondeva 400 (PGRST200) a prescindere.
    // Risultato: nessuna recensione e' mai comparsa sul sito. Ora filtriamo
    // sulla colonna giusta e i nomi dei recensori li leggiamo con una
    // seconda query su "profiles", senza dipendere da una relazione che il
    // database non ha.
    const { data: revs } = await supabase.from('reviews')
      .select('*')
      .eq('reviewed_id', id)
      .order('created_at', { ascending: false })

    if (revs && revs.length > 0) {
      const idRecensori = Array.from(new Set(revs.map((r: any) => r.reviewer_id).filter(Boolean)))
      if (idRecensori.length > 0) {
        const { data: autori } = await supabase
          .from('profiles')
          .select('id, nickname, first_name')
          .in('id', idRecensori)
        const mappa: Record<string, any> = {}
        ;(autori || []).forEach((a: any) => { mappa[a.id] = a })
        revs.forEach((r: any) => { r.reviewer = mappa[r.reviewer_id] || null })
      }
    }

    if (prof) setProfile(prof as PublicProfile)
    if (ads) setAnnouncements(ads)
    if (revs) setReviews(revs)
    
    setLoading(false)
  }

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : "N/D"

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase text-stone-400 text-[10px] tracking-widest">Caricamento Profilo...</div>

  if (!profile) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase text-rose-500 text-[10px]">Utente non trovato</div>

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* HEADER PROFILO - SOLO NICKNAME E CITTÀ */}
      <div className="bg-white border-b border-stone-200 pt-20 pb-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8">
          
          {/* AVATAR REALE O FALLBACK */}
          <div className="w-32 h-32 bg-stone-900 rounded-[3rem] overflow-hidden flex items-center justify-center text-white shadow-xl shadow-stone-200">
            {profile.avatar_url ? (
              <img loading="lazy" decoding="async" src={profile.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            ) : (
              <span className="text-4xl font-black">{profile.nickname?.[0] || 'U'}</span>
            )}
          </div>
          
          <div className="text-center md:text-left flex-1">
            <h1 className="text-4xl font-black uppercase italic text-stone-900 tracking-tighter leading-none">
              {profile.nickname || 'Utente Re-love'}
            </h1>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-2">
              📍 {profile.city || 'Italia'} • Membro dal {new Date(profile.created_at).getFullYear()}
            </p>

            {/* BIO PUBBLICA */}
            {profile.bio && (
              <p className="mt-4 text-sm font-medium text-stone-500 italic max-w-lg leading-relaxed">
                "{profile.bio}"
              </p>
            )}
            
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
        
        {/* COLONNA SINISTRA: ARMADIO (Nickname) */}
        <div className="lg:col-span-2">
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-8 border-l-4 border-rose-500 pl-4">
            Armadio di {profile.nickname || 'questo utente'}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {announcements.map(ann => (
              <Link href={`/announcement/${ann.id}`} key={ann.id} className="group bg-white rounded-3xl overflow-hidden border border-stone-100 hover:shadow-xl transition-all">
                <div className="h-40 bg-stone-100">
                  <img loading="lazy" decoding="async" src={srcFoto(ann.image_url, 400)} srcSet={srcSetFoto(ann.image_url, 400)} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" alt="img" />
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

        {/* COLONNA DESTRA: FEEDBACK (Nickname) */}
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 mb-8 border-l-4 border-yellow-400 pl-4">
            Dicono di {profile.nickname || 'lui/lei'}
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
                    Da: {rev.reviewer?.nickname || rev.reviewer?.first_name || 'Utente'}
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