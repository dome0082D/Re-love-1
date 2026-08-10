'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Sparkles, ExternalLink, Plus, X, Eye } from 'lucide-react'
import ExternalLinkConfirmModal from '../components/ExternalLinkConfirmModal'

function VetrinaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] = useState<any>(null)
  const IS_STAFF = user?.email === 'dome0082@gmail.com'
  const [activeTab, setActiveTab] = useState<'interna' | 'esterna'>('interna')
  const [internaItems, setInternaItems] = useState<any[]>([])
  const [esternaItems, setEsternaItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // --- NASTRO VENDITORI SCORREVOLE ---
  // Mappa user_id -> profilo, per mostrare nomi reali nel nastro e nelle
  // card. Il filtro per venditore vive nell'indirizzo (?venditore=...), così
  // si può anche condividere un link diretto "vetrina di questa persona".
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, any>>({})
  const selectedSeller = searchParams.get('venditore')

  // --- MODALE DI CREAZIONE ---
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState<'interna' | 'esterna'>('interna')
  const [myListings, setMyListings] = useState<any[]>([])
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState('')
  const [extUrl, setExtUrl] = useState('')
  const [extTitle, setExtTitle] = useState('')
  const [extImage, setExtImage] = useState('')
  const [extPrice, setExtPrice] = useState('')
  const [extShipping, setExtShipping] = useState('')
  const [fetchingPreview, setFetchingPreview] = useState(false)
  const [paying, setPaying] = useState(false)
  // URL in attesa di conferma prima di uscire da Re-love - vedi la modale
  // condivisa ExternalLinkConfirmModal.
  const [pendingUrl, setPendingUrl] = useState<string | null>(null)

  useEffect(() => {
    init()
  }, [])

  // Gestisce il ritorno da Stripe. IMPORTANTE: non attiviamo MAI una voce
  // qui in base al parametro "success" nell'indirizzo - quel parametro è
  // scrivibile a mano da chiunque e non prova che un pagamento sia davvero
  // avvenuto (stesso errore già corretto in dashboard/annunci/page.tsx).
  // L'unica cosa che attiva davvero una voce è il webhook Stripe lato
  // server. Qui ci limitiamo a un messaggio e a ricaricare i dati.
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Pagamento riuscito! La tua voce comparirà in Vetrina a breve.')
      router.replace('/vetrina')
      fetchVetrina()
    }
    if (searchParams.get('canceled') === 'true') {
      toast('Pagamento annullato.')
      router.replace('/vetrina')
    }
    const createParam = searchParams.get('create')
    const adId = searchParams.get('ad_id')
    if (createParam === 'interna' && adId) {
      setCreateType('interna')
      setSelectedAnnouncementId(adId)
      setShowCreateModal(true)
    }
  }, [searchParams])

  async function init() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    fetchVetrina()
  }

  // Potere staff: elimina QUALSIASI voce della Vetrina, di qualunque
  // utente, direttamente da qui - non serve passare da altre dashboard.
  async function handleDeleteVetrinaItem(id: string, titolo: string) {
    if (!confirm(`Eliminare definitivamente "${titolo}" dalla Vetrina?`)) return
    try {
      const { error } = await supabase.from('vetrina_items').delete().eq('id', id)
      if (error) throw error
      toast.success('Voce eliminata dalla Vetrina.')
      fetchVetrina()
    } catch (err: any) {
      console.error('Errore eliminazione voce vetrina:', err)
      toast.error("Errore durante l'eliminazione.")
    }
  }

  async function fetchVetrina() {
    setLoading(true)
    setLoadError(false)

    const { data: interna, error: e1 } = await supabase
      .from('vetrina_items')
      .select('*, announcements(*)')
      .eq('type', 'interna')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    const { data: esterna, error: e2 } = await supabase
      .from('vetrina_items')
      .select('*')
      .eq('type', 'esterna')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (e1 || e2) {
      console.error('Errore caricamento vetrina:', e1 || e2)
      setLoadError(true)
      setLoading(false)
      return
    }

    setInternaItems(interna || [])
    setEsternaItems(esterna || [])

    // Profili dei venditori presenti in Vetrina Interna, per il nastro
    // scorrevole e per i nomi mostrati nelle card. Una sola richiesta per
    // tutti i venditori distinti, non una per ciascuno.
    const idVenditori = Array.from(new Set((interna || []).map((i: any) => i.user_id).filter(Boolean)))
    if (idVenditori.length > 0) {
      const { data: profili } = await supabase
        .from('profiles')
        .select('id, first_name, user_serial_id')
        .in('id', idVenditori)
      if (profili) {
        const mappa: Record<string, any> = {}
        profili.forEach((p: any) => { mappa[p.id] = p })
        setSellerProfiles(mappa)
      }
    }

    setLoading(false)
  }

  async function fetchMyListings() {
    if (!user) return
    const { data, error } = await supabase
      .from('announcements')
      .select('id, title, price, image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (!error && data) setMyListings(data)
  }

  function openCreateModal() {
    if (!user) {
      toast.error('Devi accedere per aggiungere una voce alla Vetrina. 🔑')
      return
    }
    fetchMyListings()
    setShowCreateModal(true)
  }

  async function handleFetchPreview() {
    if (!extUrl.trim()) {
      toast.error('Incolla prima un indirizzo.')
      return
    }
    setFetchingPreview(true)
    try {
      const res = await fetch('/api/vetrina/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || "Impossibile recuperare l'anteprima. Compila titolo e immagine a mano.")
        return
      }
      if (data.title) setExtTitle(data.title)
      if (data.image) setExtImage(data.image)
      toast.success('Anteprima recuperata! Il prezzo resta da scrivere qui sotto.')
    } catch (err) {
      console.error('Errore anteprima:', err)
      toast.error('Errore di connessione.')
    } finally {
      setFetchingPreview(false)
    }
  }

  async function handlePay() {
    if (!user) {
      toast.error('Devi accedere per continuare.')
      return
    }
    if (createType === 'interna' && !selectedAnnouncementId) {
      toast.error('Scegli quale annuncio promuovere.')
      return
    }
    if (createType === 'esterna') {
      if (!extUrl.trim() || !extTitle.trim() || !extPrice) {
        toast.error('Compila link, titolo e prezzo prima di continuare.')
        return
      }
      if (Number(extPrice) <= 0) {
        toast.error('Il prezzo deve essere maggiore di zero.')
        return
      }
    }

    setPaying(true)
    try {
      const res = await fetch('/api/stripe/vetrina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          type: createType,
          announcementId: createType === 'interna' ? selectedAnnouncementId : undefined,
          externalUrl: createType === 'esterna' ? extUrl.trim() : undefined,
          title: createType === 'esterna' ? extTitle.trim() : undefined,
          imageUrl: createType === 'esterna' ? extImage : undefined,
          price: createType === 'esterna' ? extPrice : undefined,
          shippingCost: createType === 'esterna' ? (extShipping || '0') : undefined,
        }),
      })
      const data = await res.json()

      // Vetrina gratuita: la voce e' gia' pubblicata, non c'e' nessun
      // pagamento da fare. Chiudiamo il modulo e ricarichiamo l'elenco.
      if (data.gratuita) {
        toast.success('Pubblicato in Vetrina!')
        setShowCreateModal(false)
        setExtUrl(''); setExtTitle(''); setExtImage(''); setExtPrice(''); setExtShipping('')
        setSelectedAnnouncementId('')
        setPaying(false)
        fetchVetrina()
        return
      }

      if (!res.ok || data.error || !data.url) {
        toast.error(data.error || "Errore nell'avvio del pagamento.")
        setPaying(false)
        return
      }
      window.location.href = data.url
    } catch (err) {
      console.error('Errore pagamento vetrina:', err)
      toast.error('Errore di connessione.')
      setPaying(false)
    }
  }

  async function handleExternalClick(itemId: string) {
    try {
      await supabase.rpc('increment_vetrina_click', { item_id: itemId })
    } catch (err) {
      // Non blocchiamo mai l'apertura del link per un errore nel solo
      // conteggio dei click - è un dato accessorio, non deve rovinare
      // l'esperienza di chi sta solo cercando di visitare il link.
      console.error('Errore tracciamento click:', err)
    }
  }

  // Se è stato scelto un venditore dal nastro scorrevole, mostriamo solo i
  // suoi annunci in Vetrina Interna; altrimenti tutti.
  const internaFiltrata = selectedSeller
    ? internaItems.filter(item => item.user_id === selectedSeller)
    : internaItems
  const items = activeTab === 'interna' ? internaFiltrata : esternaItems

  // Elenco dei venditori distinti presenti in Vetrina Interna, nell'ordine
  // in cui compare la loro voce più recente.
  const venditoriDistinti = Array.from(
    new Map(internaItems.map(item => [item.user_id, item])).values()
  )

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-16 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 text-8xl">✨</div>
        <div className="text-center max-w-2xl px-6 relative z-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase italic text-stone-900 tracking-tighter mb-2">Vetrina Re-love</h1>
          <p className="text-rose-500 font-bold text-[10px] uppercase tracking-[0.3em]">Gli oggetti in evidenza della community</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border border-stone-100">
            <button
              onClick={() => setActiveTab('interna')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'interna' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              🏠 Vetrina Interna
            </button>
            <button
              onClick={() => setActiveTab('esterna')}
              className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'esterna' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              🔗 Vetrina Esterna
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 bg-rose-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-900 transition-all shadow-md"
          >
            <Plus size={14} /> Aggiungi alla Vetrina
          </button>
        </div>

        {/* NASTRO VENDITORI SCORREVOLE - solo se ci sono venditori in
            Vetrina Interna da mostrare. Toccando un nome si filtra la lista
            sotto a quel solo venditore, senza cambiare pagina; il tondino
            "Tutti" toglie il filtro. */}
        {venditoriDistinti.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-3 mb-6 custom-scrollbar">
            <button
              onClick={() => router.push('/vetrina')}
              className={`shrink-0 flex flex-col items-center gap-1.5 transition-all ${!selectedSeller ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-sm ${!selectedSeller ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-500'}`}>
                Tutti
              </div>
              <span className="text-[9px] font-black uppercase text-stone-500">Vetrina</span>
            </button>
            {venditoriDistinti.map(item => {
              const profilo = sellerProfiles[item.user_id]
              const nome = profilo?.first_name || 'Utente'
              const attivo = selectedSeller === item.user_id
              return (
                <button
                  key={item.user_id}
                  onClick={() => { setActiveTab('interna'); router.push(`/vetrina?venditore=${item.user_id}`) }}
                  className={`shrink-0 flex flex-col items-center gap-1.5 transition-all ${attivo ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-lg uppercase ${attivo ? 'bg-rose-600 text-white ring-2 ring-rose-300' : 'bg-white text-rose-500 border border-rose-200'}`}>
                    {nome[0]}
                  </div>
                  <span className="text-[9px] font-black uppercase text-stone-700 max-w-[64px] truncate">{nome}</span>
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm border border-stone-200 animate-pulse h-56">
                <div className="w-full h-28 bg-stone-200 rounded-2xl mb-4"></div>
                <div className="w-3/4 h-4 bg-stone-200 rounded mb-2"></div>
                <div className="w-1/2 h-6 bg-stone-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white border border-red-200 rounded-[2rem] p-16 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Controlla la connessione e riprova.</p>
            <button onClick={fetchVetrina} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-[3rem] p-16 text-center">
            <span className="text-6xl block mb-4">{activeTab === 'interna' ? '🏠' : '🔗'}</span>
            <h3 className="text-xl font-black uppercase text-stone-900 mb-2">
              {activeTab === 'interna' ? 'Nessun annuncio in vetrina' : 'Nessun link in vetrina'}
            </h3>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Sii il primo a comparire qui!</p>
          </div>
        ) : activeTab === 'interna' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {internaItems.map(item => item.announcements && (
              <div key={item.id} className="group bg-white rounded-[2rem] overflow-hidden border border-orange-300 ring-1 ring-orange-300/40 shadow-md hover:shadow-lg transition-all flex flex-col relative">
                <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-rose-500 to-orange-400 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-sm tracking-widest">
                  ✨ Vetrina
                </div>
                {IS_STAFF && (
                  <button
                    onClick={() => handleDeleteVetrinaItem(item.id, item.announcements.title)}
                    title="Elimina dalla Vetrina (Staff)"
                    className="absolute top-3 right-3 z-10 bg-stone-900/80 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                <Link href={`/announcement/${item.announcements.id}`} className="contents">
                  <div className="aspect-square bg-stone-50 relative">
                    <img src={item.announcements.image_url || '/usato.png'} className="w-full h-full object-cover" alt={item.announcements.title} />
                  </div>
                  <div className="p-4">
                    <h4 className="text-[11px] font-black uppercase truncate text-stone-800">{item.announcements.title}</h4>
                    <p className="text-lg font-black text-rose-600 italic mt-1">€ {item.announcements.price}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {esternaItems.map(item => (
              <div
                key={item.id}
                className="group bg-white rounded-[2rem] overflow-hidden border border-blue-200 shadow-md hover:shadow-lg transition-all flex flex-col relative"
              >
                <div className="absolute top-3 left-3 z-10 bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-sm tracking-widest flex items-center gap-1">
                  <ExternalLink size={9} /> Link Esterno
                </div>
                {IS_STAFF && (
                  <button
                    onClick={() => handleDeleteVetrinaItem(item.id, item.title)}
                    title="Elimina dalla Vetrina (Staff)"
                    className="absolute top-3 right-3 z-10 bg-stone-900/80 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
                <div
                  onClick={() => { handleExternalClick(item.id); setPendingUrl(item.external_url) }}
                  className="contents cursor-pointer"
                >
                <div className="aspect-square bg-stone-50 relative">
                  {item.image_url ? (
                    <img src={item.image_url} className="w-full h-full object-contain p-2" alt={item.title} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300">
                      <ExternalLink size={40} />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="text-[11px] font-black uppercase truncate text-stone-800">{item.title}</h4>
                  <p className="text-lg font-black text-blue-600 italic mt-1">€ {Number(item.price).toFixed(2)}</p>
                  {Number(item.shipping_cost) > 0 && (
                    <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-0.5">
                      + € {Number(item.shipping_cost).toFixed(2)} spedizione
                    </p>
                  )}
                  <p className="text-[8px] font-bold text-stone-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                    <Eye size={10} /> {item.clicks} visite al link
                  </p>
                </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- MODALE CREAZIONE VOCE VETRINA --- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[90vh] overscroll-contain overflow-y-auto relative animate-in zoom-in duration-200">
            <div className="p-8">
              <button onClick={() => setShowCreateModal(false)} className="absolute top-5 right-5 text-stone-400 hover:text-stone-800 text-2xl font-bold">✕</button>

              <div className="text-center mb-6">
                <Sparkles size={48} className="text-rose-500 mx-auto mb-3" />
                <h2 className="text-2xl font-black uppercase italic text-stone-900">Aggiungi alla Vetrina</h2>
                <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest mt-1">Gratis · Sempre visibile finché attiva</p>
              </div>

              <div className="flex gap-2 mb-6 bg-stone-50 p-1.5 rounded-xl border border-stone-100">
                <button
                  onClick={() => setCreateType('interna')}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${createType === 'interna' ? 'bg-stone-900 text-white' : 'text-stone-500'}`}
                >
                  Un mio annuncio
                </button>
                <button
                  onClick={() => setCreateType('esterna')}
                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${createType === 'esterna' ? 'bg-stone-900 text-white' : 'text-stone-500'}`}
                >
                  Un link esterno
                </button>
              </div>

              {createType === 'interna' ? (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Quale annuncio vuoi promuovere?</label>
                  {myListings.length === 0 ? (
                    <p className="text-xs font-bold text-stone-400 text-center py-8 bg-stone-50 rounded-xl border border-stone-100">
                      Non hai ancora nessun annuncio pubblicato.
                    </p>
                  ) : (
                    <select
                      value={selectedAnnouncementId}
                      onChange={(e) => setSelectedAnnouncementId(e.target.value)}
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-rose-400"
                    >
                      <option value="">Seleziona un annuncio...</option>
                      {myListings.map(ad => (
                        <option key={ad.id} value={ad.id}>{ad.title} (€{ad.price})</option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Indirizzo del link</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        placeholder="https://..."
                        value={extUrl}
                        onChange={(e) => setExtUrl(e.target.value)}
                        className="flex-1 p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none focus:border-rose-400"
                      />
                      <button
                        onClick={handleFetchPreview}
                        disabled={fetchingPreview}
                        className="shrink-0 bg-stone-900 text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50"
                      >
                        {fetchingPreview ? '...' : 'Recupera'}
                      </button>
                    </div>
                  </div>

                  {extImage && (
                    <div className="w-full h-32 bg-stone-50 rounded-xl border border-stone-100 overflow-hidden flex items-center justify-center">
                      <img src={extImage} className="max-h-full max-w-full object-contain" alt="Anteprima" />
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Titolo</label>
                    <input
                      type="text"
                      value={extTitle}
                      onChange={(e) => setExtTitle(e.target.value)}
                      placeholder="Nome dell'articolo"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Prezzo da mostrare (€) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={extPrice}
                      onChange={(e) => setExtPrice(e.target.value)}
                      placeholder="Il prezzo che vuoi mostrare tu"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
                    />
                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-2 ml-2">
                      Questo è il prezzo che vedranno gli utenti - non viene mai preso dal sito collegato.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Spese di spedizione (€, opzionale)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={extShipping}
                      onChange={(e) => setExtShipping(e.target.value)}
                      placeholder="0 se gratuita o da concordare"
                      className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-stone-900 transition-all disabled:opacity-50 mt-6 shadow-md"
              >
                {paying ? 'Pubblicazione...' : 'Pubblica in Vetrina'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function VetrinaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Caricamento Vetrina...</div>}>
      <VetrinaContent />
    </Suspense>
  )
}
