'use client'
export const dynamic = 'force-dynamic'

// app/vetrina/interna/page.tsx
//
// I MIEI annunci Re-love in Vetrina. Pagina separata da quella dei link
// esterni (prima erano due schede dello stesso indirizzo) e limitata alle
// sole voci dell'utente collegato: qui si pubblica, si vede e si elimina
// soltanto la propria roba.

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Plus, Sparkles } from 'lucide-react'
import {
  caricaInterne, eliminaVoce, type VoceInterna,
} from '../../components/vetrina/datiVetrina'
import {
  IntestazioneVetrina, GrigliaInterna, VetrinaVuota,
} from '../../components/vetrina/GrigliaVetrina'
import ModalePubblicato from '@/components/ModalePubblicato'

interface MioAnnuncio {
  id: string
  title: string
  price: number
  image_url: string | null
}

function VetrinaInternaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userId, setUserId] = useState<string | null>(null)
  const [voci, setVoci] = useState<VoceInterna[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreCaricamento, setErroreCaricamento] = useState(false)

  const [mostraModale, setMostraModale] = useState(false)
  const [mieiAnnunci, setMieiAnnunci] = useState<MioAnnuncio[]>([])
  const [annuncioScelto, setAnnuncioScelto] = useState('')
  const [pubblicando, setPubblicando] = useState(false)
  // Cosa e' appena finito in Vetrina, per proporne la condivisione.
  const [pubblicato, setPubblicato] = useState<{ id?: string; titolo: string; immagine: string | null } | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      await ricarica(user.id)

      // Arrivo da "Metti in Vetrina" nella pagina di un annuncio.
      const adId = searchParams.get('ad_id')
      if (adId) {
        setAnnuncioScelto(adId)
        await caricaMieiAnnunci(user.id)
        setMostraModale(true)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ricarica(id: string) {
    setCaricamento(true)
    setErroreCaricamento(false)
    try {
      setVoci(await caricaInterne(id))
    } catch (err) {
      console.error('Errore caricamento vetrina interna:', err)
      setErroreCaricamento(true)
    } finally {
      setCaricamento(false)
    }
  }

  async function caricaMieiAnnunci(id: string) {
    const { data } = await supabase
      .from('announcements')
      .select('id, title, price, image_url')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
    setMieiAnnunci(data || [])
  }

  async function apriModale() {
    if (!userId) return
    await caricaMieiAnnunci(userId)
    setMostraModale(true)
  }

  async function pubblica() {
    if (!userId) return
    if (!annuncioScelto) {
      toast.error('Scegli quale annuncio mettere in Vetrina.')
      return
    }

    setPubblicando(true)
    try {
      const res = await fetch('/api/stripe/vetrina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type: 'interna', announcementId: annuncioScelto }),
      })
      const data = await res.json()

      if (data.gratuita) {
        toast.success('Pubblicato in Vetrina!')
        // Prima finiva qui: messaggio a scomparsa e basta, nessun modo di
        // farlo vedere a qualcuno. Adesso proponiamo la condivisione nel
        // momento in cui uno ha appena finito.
        const scelto = mieiAnnunci.find(a => a.id === annuncioScelto)
        setMostraModale(false)
        setAnnuncioScelto('')
        await ricarica(userId)
        if (scelto) {
          setPubblicato({ id: scelto.id, titolo: scelto.title, immagine: scelto.image_url || null })
        }
        return
      }
      if (!res.ok || data.error || !data.url) {
        toast.error(data.error || "Errore nell'avvio del pagamento.")
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Errore pubblicazione vetrina:', err)
      toast.error('Errore di connessione.')
    } finally {
      setPubblicando(false)
    }
  }

  async function elimina(voce: VoceInterna) {
    const titolo = voce.announcements?.title || 'questa voce'
    if (!confirm(`Togliere "${titolo}" dalla tua Vetrina?`)) return
    const esito = await eliminaVoce(voce.id)
    if (!esito.ok) {
      toast.error(esito.errore || "Errore durante l'eliminazione.")
      return
    }
    toast.success('Voce tolta dalla Vetrina.')
    if (userId) await ricarica(userId)
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <IntestazioneVetrina
        titolo="I miei annunci in Vetrina"
        sottotitolo="Vetrina interna · solo i tuoi"
        tornaA="/vetrina"
        tornaEtichetta="La mia Vetrina"
      />

      <div className="max-w-6xl mx-auto px-4 mt-10">
        <div className="flex justify-end mb-8">
          <button
            onClick={apriModale}
            className="flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-900 transition-all shadow-md"
          >
            <Plus size={14} /> Metti un annuncio in Vetrina
          </button>
        </div>

        {caricamento ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm border border-stone-200 animate-pulse h-56" />
            ))}
          </div>
        ) : erroreCaricamento ? (
          <div className="bg-white border border-red-200 rounded-[2rem] p-16 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <button
              onClick={() => userId && ricarica(userId)}
              className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all"
            >
              Riprova
            </button>
          </div>
        ) : voci.length === 0 ? (
          <VetrinaVuota
            icona="🏠"
            titolo="Non hai annunci in Vetrina"
            testo="Mettine uno in evidenza con il pulsante qui sopra"
          />
        ) : (
          <GrigliaInterna voci={voci} onElimina={elimina} />
        )}
      </div>

      {mostraModale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <div className="p-8">
              <button
                onClick={() => setMostraModale(false)}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 text-2xl font-bold"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <Sparkles size={48} className="text-rose-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black uppercase italic text-stone-900">Metti in Vetrina</h2>
                <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest mt-1">
                  Gratis · Sempre visibile finché attiva
                </p>
              </div>

              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">
                Quale annuncio vuoi promuovere?
              </label>
              {mieiAnnunci.length === 0 ? (
                <div className="text-center py-8 bg-stone-50 rounded-xl border border-stone-100 mt-2">
                  <p className="text-xs font-bold text-stone-400 mb-4">Non hai ancora nessun annuncio pubblicato.</p>
                  <Link
                    href="/add"
                    className="inline-block bg-stone-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
                  >
                    Pubblica il primo
                  </Link>
                </div>
              ) : (
                <select
                  value={annuncioScelto}
                  onChange={(e) => setAnnuncioScelto(e.target.value)}
                  className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-rose-400 mt-2"
                >
                  <option value="">Seleziona un annuncio...</option>
                  {mieiAnnunci.map(ad => (
                    <option key={ad.id} value={ad.id}>{ad.title} (€{ad.price})</option>
                  ))}
                </select>
              )}

              <button
                onClick={pubblica}
                disabled={pubblicando || mieiAnnunci.length === 0}
                className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-stone-900 transition-all disabled:opacity-50 mt-6 shadow-md"
              >
                {pubblicando ? 'Pubblicazione...' : 'Pubblica in Vetrina'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalePubblicato
        aperto={!!pubblicato}
        etichetta="Aggiunto in Vetrina"
        titolo={pubblicato?.titolo || ''}
        immagine={pubblicato?.immagine}
        percorso={userId ? `/vetrina/utente/${userId}/interna` : '/vetrina'}
        testo={`Guarda cosa ho messo in vetrina su Re-love: ${pubblicato?.titolo}`}
        vaiA={pubblicato?.id ? { href: `/announcement/${pubblicato.id}`, testo: "Vedi l'oggetto" } : undefined}
        onChiudi={() => setPubblicato(null)}
      />
    </div>
  )
}

export default function VetrinaInternaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">
        Caricamento...
      </div>
    }>
      <VetrinaInternaContent />
    </Suspense>
  )
}
