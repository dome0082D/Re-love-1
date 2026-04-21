'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function DashboardAnnunci() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchMyAds()
  }, [router])

  async function fetchMyAds() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo annuncio?')) {
      await supabase.from('announcements').delete().eq('id', id)
      setAnnouncements(announcements.filter(a => a.id !== id))
    }
  }

  // Funzione per simulare il pagamento e attivare la sponsorizzazione
  // In seguito la collegheremo a Stripe
  const handleSponsor = async (adId: string) => {
    setPayLoading(adId)
    
    // Simuliamo un ritardo di pagamento
    setTimeout(async () => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_sponsored: true })
        .eq('id', adId)

      if (!error) {
        alert("Pagamento riuscito! L'annuncio è ora in Vetrina Top 🚀")
        fetchMyAds()
      } else {
        alert("Errore durante l'attivazione.")
      }
      setPayLoading(null)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10 pt-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
          <h1 className="text-2xl font-bold uppercase italic text-stone-900">Gestione Annunci</h1>
          <Link href="/add" className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 transition-all">
            + Nuovo
          </Link>
        </div>

        {loading ? (
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 animate-pulse">Caricamento in corso...</p>
        ) : announcements.length === 0 ? (
          <div className="bg-white p-10 rounded-3xl border border-stone-100 text-center shadow-sm">
            <span className="text-4xl block mb-4">📝</span>
            <p className="text-stone-500 font-medium">Non hai ancora pubblicato nessun annuncio.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {announcements.map((ad) => (
              <div key={ad.id} className={`bg-white rounded-2xl overflow-hidden border ${ad.is_sponsored ? 'border-emerald-400 shadow-md' : 'border-stone-100 shadow-sm'} flex flex-col relative`}>
                
                {ad.is_sponsored && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[8px] font-bold uppercase px-3 py-1 rounded-bl-xl z-10 tracking-widest shadow-sm">
                    Sponsorizzato ✨
                  </div>
                )}

                <div className="h-40 bg-stone-50 relative">
                  <img src={ad.image_url || '/usato.png'} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-white/90 text-[10px] font-bold uppercase px-2 py-1 rounded-md shadow-sm">{ad.condition}</span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase truncate text-stone-900 mb-1">{ad.title}</h3>
                    <p className="text-lg font-bold text-emerald-600 mb-4">€ {ad.price}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Link href={`/announcement/${ad.id}`} className="flex-1 text-center bg-stone-100 text-stone-700 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-stone-200 transition-all">
                        Vedi
                      </Link>
                      <button onClick={() => handleDelete(ad.id)} className="flex-1 bg-red-50 text-red-500 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-red-100 transition-all">
                        Elimina
                      </button>
                    </div>

                    {!ad.is_sponsored && (
                      <button 
                        onClick={() => handleSponsor(ad.id)}
                        disabled={payLoading === ad.id}
                        className="w-full bg-stone-900 text-emerald-400 text-[9px] font-bold uppercase py-3 rounded-lg hover:bg-emerald-500 hover:text-white transition-all shadow-sm border border-emerald-400/30"
                      >
                        {payLoading === ad.id ? 'Elaborazione...' : '🚀 Sponsorizza (2€)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
