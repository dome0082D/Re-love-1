'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import Link from 'next/link'

// Pagina del Curatore: crea la bozza dell'oggetto di un Proprietario e
// genera il QR di delega da fargli scansionare di persona. Nessuna vendita
// né annuncio pubblico esiste ancora a questo punto - solo dopo che il
// Proprietario approva (vedi app/curatore/scansiona), l'annuncio viene
// creato per davvero.
//
// FIX: il campo immagine NON è più un indirizzo web da incollare a mano -
// ora è un vero allegato caricato dal telefono/PC, con anteprima
// immediata, esattamente come nella pagina "Inserisci Annuncio" normale
// (app/add). Il file viene caricato su Supabase Storage solo al momento
// della creazione del mandato, nello stesso bucket già usato per gli
// annunci normali.

export default function NuovoMandatoPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [condition, setCondition] = useState('Usato')
  const [custodyType, setCustodyType] = useState<'in_sede' | 'in_custodia'>('in_sede')
  const [ownerPercentage, setOwnerPercentage] = useState('70')
  const [curatorPercentage, setCuratorPercentage] = useState('20')

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null)

  // FIX ANDROID: le URL create con URL.createObjectURL() restano allocate
  // in memoria finché non vengono revocate esplicitamente - stessa
  // precauzione già presa in app/add per evitare di accumulare memoria non
  // liberata su telefoni con RAM limitata.
  const imagePreviewUrlRef = useRef<string | null>(null)
  useEffect(() => { imagePreviewUrlRef.current = imagePreviewUrl }, [imagePreviewUrl])
  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current)
    }
  }, [])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(file)
    setImagePreviewUrl(URL.createObjectURL(file))
  }

  function removeImage() {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    setImageFile(null)
    setImagePreviewUrl(null)
  }

  // Stesso identico meccanismo di ripetizione già usato in app/add: un
  // blip di rete transitorio non deve costringere l'utente a rifare tutto
  // da capo.
  async function uploadWithRetry(file: File, filePath: string, attempts = 2) {
    let lastError: any = null
    for (let i = 0; i < attempts; i++) {
      const { error } = await supabase.storage.from('announcements').upload(filePath, file)
      if (!error) return
      lastError = error
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, 800))
      }
    }
    throw lastError
  }

  async function handleCreate() {
    if (!title.trim() || !price || Number(price) <= 0) {
      toast.error('Inserisci almeno titolo e prezzo validi.')
      return
    }

    const ownerPct = Number(ownerPercentage)
    const curatorPct = Number(curatorPercentage)
    // La commissione ReLove resta fissa al 10%: le altre due percentuali
    // devono sommare esattamente a 90.
    if (ownerPct + curatorPct !== 90) {
      toast.error('Le percentuali di Proprietario e Curatore devono sommare a 90 (la commissione ReLove è fissa al 10%).')
      return
    }

    setCreating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Devi accedere per creare un mandato.')
        router.push('/login')
        return
      }

      // Il Curatore deve avere anche lui un conto pronto a ricevere
      // pagamenti - stessa verifica già richiesta ai venditori normali,
      // riusata qui invece di inventare un controllo nuovo.
      const { data: profile } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', user.id)
        .single()

      if (!profile?.stripe_account_id) {
        toast.error('Devi prima configurare il tuo conto per ricevere pagamenti, dal tuo profilo.')
        setCreating(false)
        return
      }

      // NUOVO: caricamento vero della foto allegata, solo ora che sappiamo
      // che il mandato sarà davvero creato - se manca la foto, il mandato
      // viene comunque creato senza immagine (il Proprietario la vedrà
      // comunque nell'anteprima con un placeholder).
      let uploadedImageUrl: string | null = null
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `${user.id}/curatore-${fileName}`

        await uploadWithRetry(imageFile, filePath)

        const { data: publicUrlData } = supabase.storage.from('announcements').getPublicUrl(filePath)
        uploadedImageUrl = publicUrlData.publicUrl
      }

      const { data: mandate, error } = await supabase
        .from('curator_mandates')
        .insert([{
          curator_id: user.id,
          custody_type: custodyType,
          owner_percentage: ownerPct,
          curator_percentage: curatorPct,
          draft_title: title.trim(),
          draft_description: description.trim() || null,
          draft_price: Number(price),
          draft_condition: condition,
          draft_image_url: uploadedImageUrl,
        }])
        .select()
        .single()

      if (error || !mandate) {
        console.error('Errore creazione mandato:', error)
        toast.error('Errore durante la creazione del mandato.')
        return
      }

      // Il QR contiene solo il token, con un prefisso per riconoscerlo
      // dallo scanner ed evitare di confonderlo con un QR qualsiasi
      // inquadrato per sbaglio.
      const qrContent = `RELOVE_MANDATE:${mandate.qr_token}`
      const dataUrl = await QRCode.toDataURL(qrContent, { width: 320, margin: 2 })
      setQrDataUrl(dataUrl)
      setQrExpiresAt(mandate.qr_expires_at)
      toast.success('Mandato creato! Fai scansionare il QR al Proprietario.')
    } catch (err) {
      console.error('Errore:', err)
      toast.error('Errore di connessione.')
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setQrDataUrl(null)
    setTitle('')
    setDescription('')
    setPrice('')
    removeImage()
  }

  if (qrDataUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-stone-200 p-10 text-center">
          <span className="text-5xl block mb-4">📲</span>
          <h1 className="text-2xl font-black uppercase italic text-stone-900 mb-2">Fai scansionare questo QR</h1>
          <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-6">
            Al Proprietario di "{title}"
          </p>

          <div className="bg-stone-50 rounded-2xl p-6 border border-stone-200 mb-6">
            <img src={qrDataUrl} alt="QR di delega" className="w-full h-auto" />
          </div>

          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-8">
            Il Proprietario apre Re-love sul suo telefono, va su "Approva Delega" e inquadra questo codice.
            {qrExpiresAt && ` Valido per 30 minuti.`}
          </p>

          <a
            href="/documenti/Modulo-Responsabilita-Curatore-Locale.docx"
            download
            className="w-full flex items-center justify-center gap-2 bg-stone-50 border border-stone-200 text-stone-700 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 transition-all mb-6"
          >
            📄 Scarica il modulo di responsabilità da firmare
          </a>

          <div className="flex flex-col gap-3">
            <button
              onClick={resetForm}
              className="w-full bg-stone-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 transition-all"
            >
              Crea un altro mandato
            </button>
            <Link href="/curatore" className="w-full text-center text-stone-400 py-3 text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-colors">
              Torna ai miei mandati
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">Nuovo Mandato di Delega</h1>
          <p className="text-stone-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Curatore Locale</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-10">
        <div className="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-8 space-y-5">

          <div>
            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Titolo dell'oggetto</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Bicicletta da corsa"
              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Descrizione (opzionale)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Condizioni, dettagli utili..."
              className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400 resize-none"
            />
          </div>

          {/* NUOVO: vero allegato invece di un indirizzo web da incollare -
              stessa identica esperienza già usata in "Inserisci Annuncio". */}
          <div>
            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Foto dell'oggetto</label>
            {imagePreviewUrl ? (
              <div className="relative w-32 h-32 mt-1 rounded-2xl overflow-hidden border-2 border-stone-100 group">
                <img src={imagePreviewUrl} className="w-full h-full object-cover" alt="Anteprima" />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-stone-900/80 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center hover:bg-rose-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="w-32 h-32 mt-1 rounded-2xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center text-stone-400 hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-all cursor-pointer">
                <span className="text-2xl mb-1">+</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Allega foto</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Prezzo (€)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Condizione</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
              >
                <option value="Nuovo">Nuovo</option>
                <option value="Usato">Usato</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Dove si trova l'oggetto</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setCustodyType('in_sede')}
                className={`p-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${custodyType === 'in_sede' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-500 border border-stone-200'}`}
              >
                🏠 In Sede
                <span className="block text-[9px] font-bold normal-case mt-1 opacity-70">Resta dal Proprietario</span>
              </button>
              <button
                type="button"
                onClick={() => setCustodyType('in_custodia')}
                className={`p-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${custodyType === 'in_custodia' ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-500 border border-stone-200'}`}
              >
                📦 In Custodia
                <span className="block text-[9px] font-bold normal-case mt-1 opacity-70">Lo ritiri tu</span>
              </button>
            </div>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-2 ml-2">
              {custodyType === 'in_custodia'
                ? 'Attenzione: in caso di danni o difformità, la responsabilità ricade su di te.'
                : 'La responsabilità di eventuali difformità resta del Proprietario.'}
            </p>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest ml-2">Divisione del ricavato</label>
            <div className="grid grid-cols-2 gap-4 mt-1">
              <div>
                <label className="text-[9px] font-bold text-stone-400 uppercase ml-2">Proprietario %</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={ownerPercentage}
                  onChange={(e) => setOwnerPercentage(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold text-stone-400 uppercase ml-2">Tuo (Curatore) %</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={curatorPercentage}
                  onChange={(e) => setCuratorPercentage(e.target.value)}
                  className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl font-bold text-sm outline-none mt-1 focus:border-rose-400"
                />
              </div>
            </div>
            <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mt-2 ml-2">
              + 10% commissione ReLove (fissa). Le due percentuali qui sopra devono sommare a 90.
            </p>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-stone-900 transition-all disabled:opacity-50 mt-4 shadow-md"
          >
            {creating ? 'Creazione...' : 'Crea mandato e genera QR'}
          </button>
        </div>
      </div>
    </div>
  )
}
