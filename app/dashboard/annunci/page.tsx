'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

export default function DashboardAnnunci() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchMyAds()
    checkPaymentSuccess()
  }, [router, searchParams])

  // Controlla se l'utente è appena tornato da Stripe dopo aver pagato
  async function checkPaymentSuccess() {
    const success = searchParams.get('success')
    const adId = searchParams.get('ad_id')

    if (success === 'true' && adId) {
      // Aggiorna il database: l'annuncio è ufficialmente sponsorizzato!
      await supabase.from('announcements').update({ is_sponsored: true }).eq('id', adId)
      alert("Pagamento riuscito! Il tuo annuncio è ora in Vetrina Top 🚀")
      router.push('/dashboard/annunci') // Pulisce l'URL
      fetchMyAds()
    }
    if (searchParams.get('canceled') === 'true') {
      alert("Pagamento annullato.")
      router.push('/dashboard/annunci')
    }
  }

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

  // NUOVA LOGICA: Chiama Stripe vero!
  const handleSponsor = async (adId: string) => {
    setPayLoading(adId)
    const { data: { user } } = await supabase.auth.getUser()
    
    try {
      const res = await fetch('/api/stripe/sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: adId, userId: user?.id }),
      });
      
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url; // Ti porta sulla cassa di Stripe
      } else {
        alert("Errore nell'avvio del pagamento.");
        setPayLoading(null);
      }
    } catch (err) {
      alert("Errore di connessione al server.");
      setPayLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10 pt-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
          <h1 className="text-2xl font-bold uppercase italic text-stone-900">Gestione Annunci</h1>
          <Link href="/add" className="bg-gradient-to-r from-rose-500 to-orange-400 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] hover:shadow-md transition-all shadow-sm">
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
              <div key={ad.id} className={`bg-white rounded-2xl overflow-hidden border ${ad.is_sponsored ? 'border-orange-400 ring-1 ring-orange-400/30 shadow-md' : 'border-stone-100 shadow-sm'} flex flex-col relative`}>
                
                {ad.is_sponsored && (
                  <div className="absolute top-0 right-0 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[8px] font-bold uppercase px-3 py-1 rounded-bl-xl z-10 tracking-widest shadow-sm">
                    Sponsorizzato ✨
                  </div>
                )}

                <div className="h-40 bg-stone-50 relative">
                  <img src={ad.image_url || '/usato.png'} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-white/90 text-stone-700 text-[10px] font-bold uppercase px-2 py-1 rounded-md shadow-sm">{ad.condition}</span>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold uppercase truncate text-stone-900 mb-1">{ad.title}</h3>
                    <p className="text-lg font-bold text-rose-600 mb-4">€ {ad.price}</p>
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
                        className="w-full bg-stone-900 text-orange-400 text-[9px] font-bold uppercase py-3 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-orange-400/30"
                      >
                        {payLoading === ad.id ? 'Apertura cassa...' : '🚀 Sponsorizza (2€)'}
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