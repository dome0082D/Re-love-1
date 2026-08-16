'use client'
export const dynamic = 'force-dynamic'

// app/vetrina/esterna/page.tsx
//
// I MIEI link esterni in Vetrina. Pagina separata da quella degli annunci
// interni, e limitata alle sole voci dell'utente collegato.
//
// L'inserimento è a compilazione automatica: si incolla il link e un solo
// pulsante riempie titolo, descrizione, immagine, prezzo e spese di
// spedizione leggendoli dalla pagina del prodotto. Nessuno di quei campi si
// scrive più a mano, così in Vetrina compaiono sempre i dati reali del
// venditore, aggiornati a quel link (che cambia di volta in volta).

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, ExternalLink, Download } from 'lucide-react'
import {
  caricaEsterne, eliminaVoce, contaClickEsterno, type VoceEsterna,
} from '../../components/vetrina/datiVetrina'
import {
  IntestazioneVetrina, GrigliaEsterna, VetrinaVuota,
} from '../../components/vetrina/GrigliaVetrina'
import ExternalLinkConfirmModal from '../../components/ExternalLinkConfirmModal'

interface DatiImportati {
  title: string
  description: string
  image: string
  price: number
  currency: string | null
  /** null = il sito non la dichiara in modo leggibile */
  shipping: number | null
}

export default function VetrinaEsternaPage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [voci, setVoci] = useState<VoceEsterna[]>([])
  const [caricamento, setCaricamento] = useState(true)
  const [erroreCaricamento, setErroreCaricamento] = useState(false)
  const [linkDaAprire, setLinkDaAprire] = useState<string | null>(null)

  const [mostraModale, setMostraModale] = useState(false)
  const [url, setUrl] = useState('')
  const [importazione, setImportazione] = useState(false)
  const [dati, setDati] = useState<DatiImportati | null>(null)
  const [pubblicando, setPubblicando] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      await ricarica(user.id)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ricarica(id: string) {
    setCaricamento(true)
    setErroreCaricamento(false)
    try {
      setVoci(await caricaEsterne(id))
    } catch (err) {
      console.error('Errore caricamento vetrina esterna:', err)
      setErroreCaricamento(true)
    } finally {
      setCaricamento(false)
    }
  }

  /**
   * UN SOLO PULSANTE riempie tutto. Prima titolo e descrizione erano campi
   * da compilare a mano e il prezzo era addirittura obbligatorio scriverlo,
   * con un avviso che diceva che non poteva essere importato.
   */
  async function importaDalLink() {
    if (!url.trim()) {
      toast.error('Incolla prima il link del prodotto.')
      return
    }
    setImportazione(true)
    setDati(null)
    try {
      const res = await fetch('/api/vetrina/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Non è stato possibile leggere questo link.')
        return
      }
      if (data.price === null || data.price === undefined || Number(data.price) <= 0) {
        toast.error("Prezzo non leggibile da questo link. Usa l'indirizzo completo della pagina del prodotto.")
        return
      }

      setDati({
        title: data.title || '',
        description: data.description || '',
        image: data.image || '',
        price: Number(data.price),
        currency: data.currency || null,
        shipping: data.shipping === null || data.shipping === undefined ? null : Number(data.shipping),
      })
      toast.success('Dati importati dal link!')
    } catch (err) {
      console.error('Errore importazione link:', err)
      toast.error('Errore di connessione.')
    } finally {
      setImportazione(false)
    }
  }

  async function pubblica() {
    if (!userId || !dati) return
    setPubblicando(true)
    try {
      // Titolo, descrizione, immagine, prezzo e spedizione vengono comunque
      // riletti dal server prima del salvataggio: qui li mandiamo solo per
      // completezza della richiesta.
      const res = await fetch('/api/stripe/vetrina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: 'esterna',
          externalUrl: url.trim(),
          title: dati.title,
          description: dati.description,
          imageUrl: dati.image,
        }),
      })
      const data = await res.json()

      if (data.gratuita) {
        toast.success('Link pubblicato in Vetrina!')
        chiudiModale()
        await ricarica(userId)
        return
      }
      if (!res.ok || data.error || !data.url) {
        toast.error(data.error || "Errore nell'avvio del pagamento.")
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Errore pubblicazione link:', err)
      toast.error('Errore di connessione.')
    } finally {
      setPubblicando(false)
    }
  }

  function chiudiModale() {
    setMostraModale(false)
    setUrl('')
    setDati(null)
  }

  async function elimina(voce: VoceEsterna) {
    if (!confirm(`Togliere "${voce.title}" dalla tua Vetrina?`)) return
    const esito = await eliminaVoce(voce.id)
    if (!esito.ok) {
      toast.error(esito.errore || "Errore durante l'eliminazione.")
      return
    }
    toast.success('Link tolto dalla Vetrina.')
    if (userId) await ricarica(userId)
  }

  function apriLink(voce: VoceEsterna) {
    contaClickEsterno(voce.id)
    setLinkDaAprire(voce.external_url)
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <IntestazioneVetrina
        titolo="I miei link esterni"
        sottotitolo="Vetrina esterna · solo i tuoi"
        tornaA="/vetrina"
        tornaEtichetta="La mia Vetrina"
      />

      <div className="max-w-6xl mx-auto px-4 mt-10">
        <div className="flex justify-end mb-8">
          <button
            onClick={() => setMostraModale(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-900 transition-all shadow-md"
          >
            <Plus size={14} /> Aggiungi un link
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
            icona="🔗"
            titolo="Non hai link in Vetrina"
            testo="Incolla un link e i dati si compilano da soli"
          />
        ) : (
          <GrigliaEsterna voci={voci} onElimina={elimina} onApri={apriLink} />
        )}
      </div>

      {mostraModale && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[90vh] overscroll-contain overflow-y-auto relative">
            <div className="p-8">
              <button
                onClick={chiudiModale}
                className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 text-2xl font-bold"
              >
                ✕
              </button>

              <div className="text-center mb-6">
                <ExternalLink size={44} className="text-blue-600 mx-auto mb-3" />
                <h2 className="text-2xl font-black uppercase italic text-stone-900">Aggiungi un link</h2>
                <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest mt-1">
                  Gratis · I dati si compilano da soli
                </p>
              </div>

              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">
                Indirizzo del prodotto
              </label>
              <div className="flex gap-2 mt-1 mb-5">
                <input
                  type="text"
                  placeholder="https://www.amazon.it/..."
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setDati(null) }}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 min-w-0 p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-blue-400"
                />
                <button
                  onClick={importaDalLink}
                  disabled={importazione}
                  className="shrink-0 flex items-center gap-2 bg-stone-900 text-white px-5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-50"
                >
                  <Download size={13} /> {importazione ? '...' : 'Compila'}
                </button>
              </div>

              {!dati ? (
                <div className="bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-8 text-center">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-relaxed">
                    Incolla il link e tocca &ldquo;Compila&rdquo;: nome, descrizione, immagine, prezzo e spese di spedizione vengono presi direttamente dalla pagina del prodotto.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dati.image && (
                    <div className="w-full h-40 bg-stone-50 rounded-2xl border border-stone-100 overflow-hidden flex items-center justify-center">
                      <img src={dati.image} className="max-h-full max-w-full object-contain" alt={dati.title} />
                    </div>
                  )}

                  <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 space-y-3">
                    <div>
                      <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Nome articolo</p>
                      <p className="text-sm font-black text-stone-900 mt-0.5">{dati.title || '—'}</p>
                    </div>

                    {dati.description && (
                      <div>
                        <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Descrizione</p>
                        <p className="text-[11px] font-medium text-stone-600 mt-0.5 line-clamp-3">{dati.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Prezzo</p>
                        <p className="text-xl font-black italic text-emerald-700 mt-0.5">
                          € {dati.price.toFixed(2)}
                        </p>
                        {dati.currency && dati.currency !== 'EUR' && (
                          <p className="text-[8px] font-black uppercase text-emerald-600">originale in {dati.currency}</p>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase text-blue-700 tracking-widest">Spedizione</p>
                        <p className="text-xl font-black italic text-blue-700 mt-0.5">
                          {dati.shipping === null || dati.shipping === 0 ? 'Gratis' : `€ ${dati.shipping.toFixed(2)}`}
                        </p>
                        {dati.shipping === null && (
                          <p className="text-[8px] font-black uppercase text-blue-600">non dichiarata dal sito</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-bold text-rose-700 leading-relaxed">
                      Questi dati arrivano dalla pagina del prodotto e non sono modificabili: in Vetrina compare sempre quello che il venditore mostra davvero su quel link.
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={pubblica}
                disabled={pubblicando || !dati}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-stone-900 transition-all disabled:opacity-40 mt-6 shadow-md"
              >
                {pubblicando ? 'Pubblicazione...' : 'Pubblica in Vetrina'}
              </button>
            </div>
          </div>
        </div>
      )}

      {linkDaAprire && (
        <ExternalLinkConfirmModal url={linkDaAprire} onClose={() => setLinkDaAprire(null)} />
      )}
    </div>
  )
}
