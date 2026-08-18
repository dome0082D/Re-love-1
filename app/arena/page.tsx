'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import Link from 'next/link'
import BottoneCandidatura from '@/components/BottoneCandidatura'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

// Pagina "Arena ReLove": il catalogo degli oggetti messi in palio dai
// Proprietari (valore >= 100€). Ogni utente puo' generare il proprio link
// di promozione univoco per un oggetto - il primo il cui link porta
// all'acquisto o allo scambio confermato vince la commissione del 30%.

interface OggettoArena {
  id: string
  title: string
  price: number
  image_url: string | null
  user_id: string
  arena_locked_until: string | null
  quantity: number
  // CURATORE LOCALE: per gli oggetti in Arena la candidatura si fa SOLO qui,
  // dove sono spiegate le condizioni della gara, e non dalla scheda normale.
  cerca_curatore?: boolean
  curator_id?: string | null
  curator_percentage?: number | null
  is_arena?: boolean
}

interface MiaPromozione {
  announcement_id: string
  tracking_code: string
  clicks: number
}

export default function ArenaPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [oggetti, setOggetti] = useState<OggettoArena[]>([])
  const [miePromozioni, setMiePromozioni] = useState<Record<string, MiaPromozione>>({})
  const [loading, setLoading] = useState(true)
  const [generandoPer, setGenerandoPer] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState('')

  async function fetchOggetti() {
    const { data } = await supabase
      .from('announcements')
      .select('*')  // '*' e non l'elenco delle colonne: cosi' la pagina regge anche prima che lo SQL delle candidature sia stato eseguito
      .eq('is_arena', true)
      .gt('quantity', 0)
      .order('price', { ascending: false })

    setOggetti(data || [])
  }

  async function fetchMiePromozioni(userId: string) {
    const { data } = await supabase
      .from('arena_promotions')
      .select('announcement_id, tracking_code, clicks')
      .eq('promoter_id', userId)

    const mappa: Record<string, MiaPromozione> = {}
    for (const p of data || []) {
      mappa[p.announcement_id] = p
    }
    setMiePromozioni(mappa)
  }

  async function init() {
    setLoading(true)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)

    await fetchOggetti()
    if (currentUser) {
      await fetchMiePromozioni(currentUser.id)
    }
    setLoading(false)
  }

  useEffect(() => {
    setSiteUrl(window.location.origin)
    init()
  }, [])

  function isInTrattativa(oggetto: OggettoArena): boolean {
    return !!oggetto.arena_locked_until && new Date(oggetto.arena_locked_until) > new Date()
  }

  async function handlePromuovi(oggetto: OggettoArena) {
    if (!user) {
      toast.error('Devi accedere per promuovere un oggetto.')
      router.push('/login')
      return
    }

    if (oggetto.user_id === user.id) {
      toast.error('Non puoi promuovere un tuo stesso oggetto.')
      return
    }

    setGenerandoPer(oggetto.id)
    try {
      const res = await fetch('/api/arena/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcementId: oggetto.id, promoterId: user.id }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Errore durante la generazione del link.')
        if (data.requiresPayoutSetup) {
          router.push('/profile')
        }
        return
      }

      setMiePromozioni(prev => ({
        ...prev,
        [oggetto.id]: { announcement_id: oggetto.id, tracking_code: data.trackingCode, clicks: 0 },
      }))
      toast.success('Link generato! Copialo e condividilo.')
    } catch (err) {
      console.error('Errore promozione:', err)
      toast.error('Errore di connessione.')
    } finally {
      setGenerandoPer(null)
    }
  }

  function copiaLink(trackingCode: string, announcementId: string) {
    const link = `${siteUrl}/announcement/${announcementId}?arena=${trackingCode}`
    navigator.clipboard.writeText(link)
    toast.success('Link copiato negli appunti!')
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-gradient-to-br from-rose-600 to-orange-500 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl">🏆</div>
        <div className="text-center max-w-2xl px-6 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase italic text-white tracking-tighter mb-2">Arena ReLove</h1>
          <p className="text-white/90 font-bold text-[11px] uppercase tracking-[0.3em]">Promuovi. Vinci. Guadagna.</p>
        </div>
      </div>

      {/* NUOVO: riquadro informativo fisso, richiesto esplicitamente -
          stile coerente con la palette del sito (bianco semi-trasparente
          leggibile, come tutti gli altri riquadri dell'app), massimo
          contrasto per il testo, nessuna sovrapposizione con altri
          elementi essendo un blocco a piena larghezza e altezza naturale. */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-10">
        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-lg p-6 md:p-8">
          <p className="text-xs md:text-sm font-bold text-stone-600 leading-relaxed">
            <span className="font-black text-stone-900">Come funziona:</span> i Proprietari mettono in palio oggetti di alto valore (da 100€ in su).
            Genera il tuo link univoco e condividilo: se porta a una vendita o scambio confermato, ti spetta il <span className="font-black text-rose-600">30% dell&apos;incasso</span>.
            Vince il <span className="font-black text-stone-900">primo</span> link che completa l&apos;acquisto — gli altri promotori non ricevono nulla per quell&apos;oggetto.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-10">
        {loading ? (
          <p className="text-center text-stone-400 font-bold text-xs uppercase tracking-widest mt-12">Caricamento arena...</p>
        ) : oggetti.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-[3rem] p-16 text-center">
            <span className="text-6xl block mb-4">🏟️</span>
            <h3 className="text-xl font-black uppercase text-stone-900 mb-2">Arena vuota</h3>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Nessun oggetto in palio al momento. Torna a controllare presto!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {oggetti.map(oggetto => {
              const inTrattativa = isInTrattativa(oggetto)
              const miaPromo = miePromozioni[oggetto.id]
              const quotaGuadagno = (Number(oggetto.price) * 0.30).toFixed(2)
              const generandoQuesto = generandoPer === oggetto.id
              const sonoIlProprietario = user && oggetto.user_id === user.id

              return (
                <div key={oggetto.id} className="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                  <Link href={`/announcement/${oggetto.id}`} className="block relative h-40 bg-stone-50">
                    <img loading="lazy" decoding="async" src={srcFoto(oggetto.image_url, 400) || '/usato.png'} srcSet={srcSetFoto(oggetto.image_url, 400)} alt={oggetto.title} className="w-full h-full object-cover" />
                    {inTrattativa && (
                      <div className="absolute inset-0 bg-stone-900/70 flex items-center justify-center">
                        <span className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">In Trattativa</span>
                      </div>
                    )}
                    <span className="absolute top-2 left-2 bg-stone-900 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md">🏆 Arena</span>
                  </Link>

                  <div className="p-4 flex-1 flex flex-col">
                    <Link href={`/announcement/${oggetto.id}`} className="text-xs font-black text-stone-900 uppercase line-clamp-2 mb-1">
                      {oggetto.title}
                    </Link>
                    <p className="text-sm font-black text-stone-500 mb-3">€ {Number(oggetto.price).toFixed(2)}</p>

                    {/* NUOVO: riquadro informativo fisso accanto al tasto di
                        candidatura - contrasto massimo (verde su bianco),
                        nessuna sovrapposizione essendo in flusso normale
                        del layout, non posizionato in absolute. */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 mb-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">La tua quota se vendi</p>
                      <p className="text-lg font-black text-emerald-700">€ {quotaGuadagno}</p>
                    </div>

                    <div className="mt-auto">
                      {sonoIlProprietario ? (
                        <div className="text-center text-[9px] font-black uppercase tracking-widest text-stone-400 py-3">
                          È il tuo oggetto
                        </div>
                      ) : miaPromo ? (
                        <button
                          onClick={() => copiaLink(miaPromo.tracking_code, oggetto.id)}
                          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all"
                        >
                          📋 Copia il tuo link ({miaPromo.clicks} click)
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePromuovi(oggetto)}
                          disabled={generandoQuesto || inTrattativa}
                          className="w-full bg-stone-900 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-600 transition-all disabled:opacity-40"
                        >
                          {generandoQuesto ? 'Generazione...' : inTrattativa ? 'In Trattativa' : 'Partecipa e Promuovi'}
                        </button>
                      )}
                      {/* CURATORE LOCALE, solo se il proprietario dell'oggetto
                          in gara ha chiesto aiuto e nessuno se ne occupa gia'. */}
                      <div className="mt-2">
                        <BottoneCandidatura
                          annuncioId={oggetto.id}
                          annuncio={{
                            user_id: oggetto.user_id,
                            cerca_curatore: oggetto.cerca_curatore,
                            curator_id: oggetto.curator_id,
                            is_arena: true,
                          }}
                          percentualeOfferta={oggetto.curator_percentage}
                          utenteId={user?.id || null}
                          contesto="arena"
                          alTermine={fetchOggetti}
                          className="w-full py-3 rounded-xl text-[10px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
