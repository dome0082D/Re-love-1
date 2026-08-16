'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from 'sonner'
import { MessageCircle, MapPin } from 'lucide-react'

interface SellerProfile {
  id: string
  first_name?: string
  nickname?: string
  city?: string
  created_at?: string
}

export default function SellerProfilePage() {
  const { id } = useParams()
  const router = useRouter()

  const [profile, setProfile] = useState<SellerProfile | null>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  async function fetchData() {
    setLoading(true)
    setLoadError(false)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      const [profRes, annRes, revRes] = await Promise.all([
        supabase.from('profiles').select('id, first_name, nickname, city, created_at').eq('id', id).single(),
        supabase.from('announcements').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        // FIX: colonna "reviewed_user_id" inesistente (e' "reviewed_id") e join
        // verso profiles senza chiave esterna: questa lettura rispondeva
        // sempre 400, quindi le recensioni del venditore non comparivano mai.
        supabase.from('reviews').select('*').eq('reviewed_id', id).order('created_at', { ascending: false }),
      ])

      if (profRes.error) throw profRes.error

      setProfile(profRes.data)
      setAnnouncements(annRes.data || [])
      setReviews(revRes.data || [])
    } catch (err) {
      console.error('Errore caricamento profilo venditore:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  // NUOVO: prima non esisteva nessun modo di scrivere a un venditore
  // partendo dal suo profilo - solo dalla pagina di un singolo annuncio, e
  // solo per alcune condizioni. Da qui si può sempre iniziare una chat.
  async function handleMessageSeller() {
    if (!user) {
      toast.error('Devi accedere per scrivere un messaggio.')
      router.push('/login')
      return
    }
    if (user.id === id) {
      toast.error('Questo è il tuo profilo.')
      return
    }

    setSendingMessage(true)
    try {
      const { error } = await supabase.from('messages').insert([{
        content: `Ciao! Ho visto il tuo profilo su Re-love e vorrei scriverti.`,
        sender_id: user.id,
        receiver_id: id,
      }])
      if (error) throw error
      router.push('/chat')
    } catch (err) {
      console.error('Errore invio messaggio:', err)
      toast.error("Errore nell'invio del messaggio. Riprova.")
    } finally {
      setSendingMessage(false)
    }
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((acc, cur) => acc + cur.rating, 0) / reviews.length).toFixed(1)
    : null

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xs tracking-widest text-stone-400 animate-pulse">Caricamento profilo...</div>
  }

  if (loadError || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 text-center p-6">
        <p className="text-rose-500 font-black uppercase text-sm">Impossibile caricare questo profilo.</p>
        <button onClick={fetchData} className="bg-stone-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all">
          Riprova
        </button>
      </div>
    )
  }

  const displayName = profile.nickname || profile.first_name || 'Utente Re-love'

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <div className="w-20 h-20 mx-auto bg-stone-900 rounded-full flex items-center justify-center font-black text-3xl text-white uppercase mb-4">
            {displayName[0]}
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">{displayName}</h1>
          {profile.city && (
            <p className="text-stone-500 font-bold text-xs uppercase tracking-widest mt-2 flex items-center justify-center gap-1">
              <MapPin size={12} /> {profile.city}
            </p>
          )}
          {avgRating && (
            <p className="mt-3 text-sm font-black text-stone-900">
              <span className="text-orange-500">★</span> {avgRating} <span className="text-stone-400 font-bold">({reviews.length} recensioni)</span>
            </p>
          )}

          {user?.id !== id && (
            <button
              onClick={handleMessageSeller}
              disabled={sendingMessage}
              className="mt-6 inline-flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[11px] tracking-widest hover:bg-stone-900 transition-all shadow-md disabled:opacity-50"
            >
              <MessageCircle size={16} /> {sendingMessage ? 'Invio...' : 'Scrivi un messaggio'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-12">
        <div className="flex justify-between items-end mb-8 border-b border-stone-300 pb-4">
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900">Annunci Pubblicati</h2>
        </div>

        {announcements.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-16 text-center">
            <p className="text-sm font-black uppercase text-stone-400">Nessun annuncio pubblicato ancora.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-16">
            {announcements.map(item => (
              <Link key={item.id} href={`/announcement/${item.id}`} className="group bg-white rounded-[2rem] overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-all flex flex-col">
                <div className="aspect-square bg-stone-100 relative">
                  <img src={item.image_url || '/usato.png'} className="w-full h-full object-contain" alt={item.title} loading="lazy" decoding="async" />
                </div>
                <div className="p-3">
                  <h4 className="text-[10px] font-black uppercase line-clamp-2 text-stone-800 leading-tight mb-1">{item.title}</h4>
                  <p className="text-[14px] font-black text-rose-600 italic">
                    {item.condition === 'Regalo' || item.condition === 'Baratto' ? 'GRATIS' : `€ ${item.price}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="flex justify-between items-end mb-8 border-b border-stone-300 pb-4">
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900">Recensioni</h2>
        </div>

        {reviews.length === 0 ? (
          <p className="text-xs font-black text-stone-400 italic text-center py-10">Nessuna recensione ancora.</p>
        ) : (
          <div className="space-y-4 mb-10">
            {reviews.map(review => (
              <div key={review.id} className="p-5 bg-white rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black uppercase text-stone-900 italic">{review.reviewer?.first_name || 'Utente Re-love'}</span>
                  <div className="flex text-orange-500 text-sm">{'★'.repeat(review.rating)}</div>
                </div>
                <p className="text-sm font-bold text-stone-700 italic">&ldquo;{review.comment}&rdquo;</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
