'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => { loadFavorites() }, [])

  async function loadFavorites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return; }

    // Unisce i preferiti con i dati della tabella annunci
    const { data } = await supabase
      .from('favorites')
      .select('*, announcements(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) {
        // Estrai solo gli annunci validi (non eliminati)
        const validAds = data.map(f => f.announcements).filter(a => a !== null)
        setFavorites(validAds)
    }
    setLoading(false)
  }

  async function removeFavorite(e: any, annId: string) {
    e.preventDefault();
    e.stopPropagation();
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
        await supabase.from('favorites').delete().eq('user_id', user.id).eq('announcement_id', annId);
        setFavorites(favorites.filter(a => a.id !== annId));
    }
  }

  if (loading) return <div className="p-10 font-black uppercase text-xs text-center">Caricamento preferiti...</div>

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
            <h1 className="text-2xl font-black uppercase italic text-stone-900">I Miei Preferiti</h1>
            <Link href="/" className="text-[10px] font-black uppercase text-stone-400 hover:text-stone-900">← Torna alla Home</Link>
        </div>

        {favorites.length === 0 ? (
            <p className="text-sm font-bold text-stone-400 uppercase text-center mt-20">Non hai ancora salvato nessun annuncio.</p>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {favorites.map(ann => (
                <Link href={`/announcement/${ann.id}`} key={ann.id} className="bg-white rounded-xl overflow-hidden border border-stone-200 shadow-sm flex flex-col group hover:border-stone-400 transition-all relative">
                  <button onClick={(e) => removeFavorite(e, ann.id)} className="absolute top-2 left-2 z-20 bg-white/80 backdrop-blur rounded-full p-1.5 hover:scale-110 transition-transform text-xs">
                    ❤️
                  </button>
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
      </div>
    </div>
  )
}
