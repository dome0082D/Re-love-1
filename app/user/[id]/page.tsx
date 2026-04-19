'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PublicProfilePage() {
  const { id } = useParams()
  const [profile, setProfile] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserData() {
      // Carica i dati pubblici del profilo
      const { data: prof } = await supabase.from('profiles').select('first_name, city, average_rating, total_reviews').eq('id', id).single()
      if (prof) setProfile(prof)

      // Carica gli annunci di questo utente
      const { data: ads } = await supabase.from('announcements').select('*').eq('user_id', id).order('created_at', { ascending: false })
      if (ads) setAnnouncements(ads)

      setLoading(false)
    }
    if (id) fetchUserData()
  }, [id])

  if (loading) return <div className="p-10 font-black uppercase text-xs text-center">Caricamento profilo...</div>
  if (!profile) return <div className="p-10 font-black uppercase text-xs text-center text-red-500">Utente non trovato.</div>

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 p-6">
      <div className="max-w-5xl mx-auto">
        
        {/* INTESTAZIONE PROFILO PUBBLICO */}
        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm mb-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Profilo di {profile.first_name || 'Utente'}</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Di: {profile.city || 'Località Sconosciuta'}</p>
          </div>
          
          <div className="bg-stone-50 border border-stone-100 p-4 rounded-2xl text-center min-w-[150px]">
             <div className="text-xl font-black text-emerald-500 mb-1">
               {profile.average_rating > 0 ? `★ ${profile.average_rating}/5` : 'Nessun Voto'}
             </div>
             <p className="text-[9px] font-bold text-stone-400 uppercase">{profile.total_reviews} Recensioni Ricevute</p>
          </div>
        </div>

        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-6 border-b pb-2">Annunci di {profile.first_name || 'questo utente'}</h2>
        
        {announcements.length === 0 ? (
            <p className="text-sm font-bold text-stone-400 uppercase">Nessun annuncio attivo al momento.</p>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {announcements.map(ann => (
                <Link href={`/announcement/${ann.id}`} key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col group hover:border-stone-400 transition-all">
                  <div className="h-32 bg-stone-50 relative border-b border-stone-100">
                    <img src={ann.image_url || "/usato.png"} className="w-full h-full object-cover" />
                    {ann.type === 'offered' && <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded uppercase shadow-sm">Regalo</span>}
                  </div>
                  <div className="p-3 flex flex-col flex-grow justify-between">
                      <div>
                        <h4 className="text-[11px] font-bold uppercase truncate text-stone-800">{ann.title}</h4>
                        <p className="text-[13px] font-black mt-1 text-stone-900">{ann.type === 'offered' ? 'GRATIS' : `€ ${ann.price}`}</p>
                      </div>
                    <button className="mt-3 w-full bg-stone-50 text-stone-800 text-[9px] font-black uppercase py-2 rounded-lg group-hover:bg-stone-900 group-hover:text-white transition-colors">Vedi Dettagli</button>
                  </div>
                </Link>
              ))}
            </div>
        )}

        <div className="mt-12 text-center">
            <Link href="/" className="text-[10px] font-black uppercase text-stone-400 hover:text-stone-900">← Torna alla Vetrina</Link>
        </div>
      </div>
    </div>
  )
}
