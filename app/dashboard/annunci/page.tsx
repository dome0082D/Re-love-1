'use client'

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'

function DashboardContent() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchMyAds()
    checkPaymentSuccess()
  }, [router, searchParams])

  async function checkPaymentSuccess() {
    const success = searchParams.get('success')
    const adId = searchParams.get('ad_id')

    // SICUREZZA: non scriviamo MAI "is_sponsored: true" fidandoci del
    // parametro "success=true" nell'indirizzo - chiunque potrebbe ottenere
    // una promozione gratis scrivendo quell'indirizzo a mano, perché
    // l'indirizzo è sotto il controllo di chi lo visita e non prova che un
    // pagamento sia davvero avvenuto. La conferma arriva solo dal webhook
    // Stripe, che verifica il pagamento con Stripe stessa lato server.
    // Qui ci limitiamo a ripulire l'indirizzo e ricaricare gli annunci.
    if (success === 'true' && adId) {
      toast.success("Pagamento riuscito! L'annuncio comparirà in Vetrina a breve. 🚀")
      router.push('/dashboard/annunci')
      fetchMyAds()
    }
    if (searchParams.get('canceled') === 'true') {
      toast('Pagamento annullato.')
      router.push('/dashboard/annunci')
    }
  }

  async function fetchMyAds() {
    setLoading(true)
    setLoadError(false)
    const { data: { user } } = await supabase.auth.getUser()
    setIsStaff(user?.email === 'dome0082@gmail.com')
    if (!user) {
      // FIX: mancava lo spegnimento del caricamento prima di uscire - chi
      // non era loggato restava a fissare "Caricamento in corso..." per
      // tutta la durata del reindirizzamento al login.
      setLoading(false)
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Un errore di caricamento non deve confondersi con "nessun annuncio":
    // sono due situazioni diverse e vanno mostrate in modo diverso.
    if (error) {
      console.error('Errore caricamento annunci:', error)
      setLoadError(true)
    } else if (data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!isStaff) {
      toast.error('Solo lo staff può cancellare gli annunci.')
      return
    }

    if (!confirm('Sei sicuro di voler eliminare questo annuncio?')) return

    // L'annuncio sparisce dalla dashboard solo DOPO conferma dal database:
    // se la cancellazione fallisce (regole di sicurezza, rete instabile),
    // resterebbe visibile e acquistabile da chiunque altro sul sito mentre
    // qui sembrava già rimosso.
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) {
      toast.error("Errore durante l'eliminazione: " + error.message)
      return
    }
    setAnnouncements(announcements.filter(a => a.id !== id))
    toast.success('Annuncio eliminato.')
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8 border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-bold uppercase italic text-stone-900">Gestione Annunci</h1>
        <Link href="/add" className="bg-gradient-to-r from-rose-500 to-orange-400 text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-[1.02] hover:shadow-md transition-all shadow-sm">
          + Nuovo
        </Link>
      </div>

      {loading ? (
        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 animate-pulse">Caricamento in corso...</p>
      ) : loadError ? (
        <div className="bg-white p-10 rounded-3xl border border-red-200 text-center shadow-sm">
          <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Controlla la connessione e riprova.</p>
          <button onClick={fetchMyAds} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
            Riprova
          </button>
        </div>
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
                  In Vetrina ✨
                </div>
              )}
              <div className="h-40 bg-stone-50 relative">
                <img src={(ad as any).image_url || (ad as any).imageUrl || '/usato.png'} alt={ad.title} className="w-full h-full object-cover" />
                <span className="absolute top-2 left-2 bg-white/90 text-stone-700 text-[10px] font-bold uppercase px-2 py-1 rounded-md shadow-sm">{ad.condition}</span>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase truncate text-stone-900 mb-1">{ad.title}</h3>
                  <p className="text-lg font-bold text-rose-600 mb-4">€ {ad.price}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Link href={`/announcement/${ad.id}`} className="flex-1 text-center bg-stone-100 text-stone-700 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-stone-200 transition-all">Vedi</Link>
                    {isStaff && (
                      <button onClick={() => handleDelete(ad.id)} className="flex-1 bg-red-50 text-red-500 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-red-100 transition-all">Elimina</button>
                    )}
                  </div>
                  {!ad.is_sponsored && (
                    // FIX: questo pulsante avviava il VECCHIO sistema di
                    // sponsorizzazione (/api/stripe/sponsor), mentre nel
                    // frattempo abbiamo costruito la Vetrina - che, come mi
                    // hai confermato, è la stessa identica cosa, solo
                    // ripensata e rinominata. Il risultato era due sistemi
                    // paralleli allo stesso prezzo per fare la stessa cosa,
                    // con la Vetrina Interna che non riceveva mai nulla da
                    // qui. Ora il pulsante porta al flusso della Vetrina,
                    // con questo annuncio già preselezionato nel modulo.
                    <Link
                      href={`/vetrina?create=interna&ad_id=${ad.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-stone-900 text-orange-400 text-[9px] font-bold uppercase py-3 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm border border-orange-400/30"
                    >
                      <Sparkles size={12} /> Metti in Vetrina (2,99€)
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DashboardAnnunci() {
  return (
    <div className="min-h-screen p-6 md:p-10 pt-10">
      <Suspense fallback={<p className="text-center p-10 font-bold uppercase text-[10px] tracking-widest text-stone-400">Caricamento dashboard...</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
