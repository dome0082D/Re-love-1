'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import jsQR from 'jsqr'
import Link from 'next/link'
import { estraiTokenMandato, PARAMETRO_CODICE } from '@/lib/mandato'

// Pagina del Proprietario: apre la fotocamera VERA del telefono dentro
// l'app (non rimanda al browser/fotocamera di sistema), legge il QR
// generato dal Curatore, mostra un'anteprima di cosa sta per approvare, e
// solo dopo un tap esplicito conferma il mandato.
//
// NUOVO: la scansione non è più l'unica strada. Il QR contiene ora un vero
// link, quindi il Proprietario può anche:
//   - inquadrarlo con la fotocamera normale del telefono e finire qui;
//   - ricevere il link su WhatsApp e toccarlo;
//   - incollare link o codice nel campo qui sotto.
// In tutti i casi si arriva alla stessa schermata di conferma. Prima solo
// il codice nudo funzionava: incollare il link rispondeva "Codice QR non
// riconosciuto", ed era il problema segnalato.
//
// FIX: la fotocamera NON parte più da sola all'apertura della pagina
// (era uno useEffect automatico). Su una PWA installata (schermata Home),
// Android a volte blocca in silenzio l'accesso alla fotocamera se la
// richiesta non parte da un tocco diretto dell'utente - nessun permesso
// chiesto, nessun errore, il video resta vuoto. Ora la fotocamera si
// avvia SOLO al tocco del pulsante "Attiva Fotocamera", garantendo che la
// richiesta parta sempre da un gesto reale dell'utente.

interface Anteprima {
  token: string
  title: string
  description?: string
  price: number
  condition: string
  imageUrl?: string
  custodyType: 'in_sede' | 'in_custodia'
  ownerPercentage: number
  curatorPercentage: number
  curatorName: string
  scadeIl?: string
  /** Motivo per cui chi guarda NON può approvare (null = può). */
  bloccante?: string | null
}

// NOTA: il codice nell'indirizzo si legge da window.location, NON con
// useSearchParams(). Quest'ultimo obbligherebbe a chiudere tutta la pagina
// dentro un <Suspense>, e finche' il browser non ha finito di agganciare il
// codice l'utente vedrebbe soltanto il riquadro vuoto della schermata di
// attesa - proprio su una pagina che si apre da un link, spesso su
// connessione lenta. Cosi' invece la schermata compare subito e il codice
// viene letto un istante dopo.
export default function ScansionaMandatoPage() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanningRef = useRef(true)
  const animationFrameRef = useRef<number | null>(null)

  const [cameraStarted, setCameraStarted] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [preview, setPreview] = useState<Anteprima | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // NUOVO: alternative alla scansione dal vivo. Servono davvero - con un
  // solo telefono a disposizione è impossibile inquadrare lo schermo su cui
  // il QR è mostrato, e su parecchi display la lettura fallisce comunque
  // (riflessi, pellicola opaca, luminosità bassa).
  const [codiceManuale, setCodiceManuale] = useState('')
  const [analizzandoFoto, setAnalizzandoFoto] = useState(false)

  function stopCamera() {
    scanningRef.current = false
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
  }

  // Fermiamo comunque la fotocamera se l'utente lascia la pagina mentre è
  // attiva - questo effetto NON avvia nulla, si limita a pulire.
  useEffect(() => {
    return () => stopCamera()
  }, [])

  async function startCamera() {
    setCameraError(null)
    setCameraStarted(true)

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // Succede sul serio: i browser negano del tutto getUserMedia fuori da
      // un contesto sicuro (http:// che non sia localhost). Prima l'errore
      // finiva nel catch generico e diceva "controlla i permessi", mandando
      // a cercare un permesso che il browser non chiederà mai.
      setCameraError(
        typeof window !== 'undefined' && !window.isSecureContext
          ? 'La fotocamera funziona solo su connessione sicura (https). Apri Re-love dal suo indirizzo https, oppure usa il codice a mano qui sotto.'
          : 'Questo browser non permette di usare la fotocamera. Usa il codice a mano qui sotto.'
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          // Una risoluzione decente aiuta a leggere un QR mostrato sullo
          // schermo di un altro telefono, dove i moduli sono piccoli.
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream

      // FIX: il <video> viene montato solo quando cameraStarted diventa
      // true, quindi in questo punto videoRef può essere ancora vuoto e lo
      // stream non veniva mai collegato: schermata nera e scansione che non
      // parte mai - il sintomo "sembra finta, non inquadra niente".
      // Aspettiamo che l'elemento esista davvero prima di collegarlo.
      const video = await attendiVideo()
      if (!video) {
        setCameraError('Non è stato possibile avviare l\'anteprima della fotocamera. Usa il codice a mano qui sotto.')
        stopCamera()
        return
      }

      video.srcObject = stream
      video.setAttribute('playsinline', 'true') // iOS: senza, il video va a schermo intero
      await video.play()

      scanningRef.current = true
      animationFrameRef.current = requestAnimationFrame(scanFrame)
    } catch (err) {
      console.error('Errore accesso fotocamera:', err)
      const nome = (err as { name?: string })?.name
      setCameraError(
        nome === 'NotAllowedError'
          ? 'Permesso fotocamera negato. Puoi darlo dalle impostazioni del browser, oppure usare il codice a mano qui sotto.'
          : nome === 'NotFoundError'
          ? 'Nessuna fotocamera disponibile su questo dispositivo. Usa il codice a mano qui sotto.'
          : "Impossibile accedere alla fotocamera. Usa il codice a mano qui sotto."
      )
    }
  }

  /** Attende che l'elemento <video> sia stato montato da React (max ~1s). */
  function attendiVideo(): Promise<HTMLVideoElement | null> {
    return new Promise(resolve => {
      let tentativi = 0
      const controlla = () => {
        if (videoRef.current) return resolve(videoRef.current)
        if (++tentativi > 60) return resolve(null)
        requestAnimationFrame(controlla)
      }
      controlla()
    })
  }

  /** Cerca un QR dentro un fotogramma già disegnato su canvas. */
  function leggiQrDaCanvas(canvas: HTMLCanvasElement): string | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    // "attemptBoth" legge anche i QR chiari su fondo scuro, che capitano
    // quando si inquadra uno schermo in modalità notte.
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    })
    return code?.data || null
  }

  // Il riconoscimento del codice vive in lib/mandato.ts, condiviso con il
  // server: link, contenuto del QR e codice nudo sono tutti validi.
  // Dalla fotocamera restiamo severi (secondo argomento false) per non
  // interrompere la scansione su un QR qualsiasi inquadrato per sbaglio;
  // da un incolla siamo permissivi, perché lì arriva spesso un messaggio
  // intero copiato da una chat.

  function scanFrame() {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    // FIX: prima la condizione era "readyState === HAVE_ENOUGH_DATA" (4).
    // Su parecchi telefoni Android il flusso della fotocamera si ferma
    // stabilmente a 3 (HAVE_FUTURE_DATA): il fotogramma è disponibile e
    // disegnabile, ma quel confronto secco lo scartava e non veniva mai
    // analizzato nulla. L'anteprima si vedeva e il QR non veniva mai letto.
    if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
      // FIX: prima si copiava il fotogramma alla risoluzione piena della
      // fotocamera (spesso 1920x1080 o più) 60 volte al secondo. Su un
      // telefono, getImageData + jsQR su 2 milioni di pixel impiega molto
      // più di un fotogramma: la pagina si impastava e la lettura risultava
      // lentissima o mai riuscita. Riduciamo il lato lungo a 640px, più che
      // sufficiente per un QR e circa dieci volte più veloce.
      const MAX_LATO = 640
      const scala = Math.min(1, MAX_LATO / Math.max(video.videoWidth, video.videoHeight))
      canvas.width = Math.round(video.videoWidth * scala)
      canvas.height = Math.round(video.videoHeight * scala)

      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const contenuto = leggiQrDaCanvas(canvas)
        const token = contenuto ? estraiTokenMandato(contenuto) : null

        if (token) {
          scanningRef.current = false
          stopCamera()
          setQrToken(token)
          fetchPreview(token)
          return
        }
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanFrame)
  }

  /** Fallback: legge il QR da una foto scattata o scelta dalla galleria. */
  async function handleFotoQr(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // così si può riprovare con la stessa foto
    if (!file) return

    setAnalizzandoFoto(true)
    const objectUrl = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = objectUrl
      })

      const canvas = document.createElement('canvas')
      const MAX_LATO = 1280 // qui possiamo permetterci più risoluzione: è un solo fotogramma
      const scala = Math.min(1, MAX_LATO / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * scala)
      canvas.height = Math.round(img.height * scala)
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, canvas.width, canvas.height)

      const contenuto = leggiQrDaCanvas(canvas)
      const token = contenuto ? estraiTokenMandato(contenuto, true) : null

      if (!token) {
        toast.error(contenuto
          ? 'Questo QR non è un codice di delega Re-love.'
          : 'Nessun QR riconosciuto nella foto. Riprova più da vicino, o digita il codice a mano.')
        return
      }

      stopCamera()
      setQrToken(token)
      fetchPreview(token)
    } catch (err) {
      console.error('Errore lettura foto QR:', err)
      toast.error('Non è stato possibile leggere questa immagine.')
    } finally {
      URL.revokeObjectURL(objectUrl)
      setAnalizzandoFoto(false)
    }
  }

  /** Il Proprietario incolla il link ricevuto, o digita il codice. */
  function handleCodiceManuale() {
    const pulito = codiceManuale.trim()
    if (!pulito) {
      toast.error('Incolla il link ricevuto dal Curatore, o il codice sotto il QR.')
      return
    }
    // Permissivo: qui arriva spesso un messaggio intero copiato da una chat.
    const token = estraiTokenMandato(pulito, true)
    if (!token) {
      toast.error('Non ho riconosciuto nessun codice di delega qui dentro. Controlla di aver copiato tutto il link.')
      return
    }
    stopCamera()
    setQrToken(token)
    fetchPreview(token)
  }

  // Il link di approvazione porta il codice nell'indirizzo: chi lo apre (dal
  // QR inquadrato con la fotocamera normale, o da un messaggio ricevuto)
  // trova l'anteprima già caricata, senza dover incollare niente.
  const linkGiaUsato = useRef(false)
  useEffect(() => {
    if (linkGiaUsato.current) return
    const codiceDaLink = new URLSearchParams(window.location.search).get(PARAMETRO_CODICE)
    if (!codiceDaLink) return
    const token = estraiTokenMandato(codiceDaLink, true)
    if (!token) return
    linkGiaUsato.current = true
    setQrToken(token)
    fetchPreview(token)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchPreview(token: string) {
    setLoadingPreview(true)
    try {
      // Il token di sessione serve al server per dire subito se chi guarda
      // può approvare (per esempio: non può, è lui stesso il Curatore).
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/curatore/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ qrToken: token }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Codice non valido.')
        resetScanner()
        return
      }
      // Usiamo il codice normalizzato dal server, non quello incollato.
      setQrToken(data.token || token)
      setPreview(data)
    } catch (err) {
      console.error('Errore anteprima:', err)
      toast.error('Errore di connessione.')
      resetScanner()
    } finally {
      setLoadingPreview(false)
    }
  }

  function resetScanner() {
    setQrToken(null)
    setPreview(null)
    setCodiceManuale('')
    // Riavviamo la fotocamera solo se era stata avviata: chi è arrivato qui
    // digitando il codice a mano non deve vedersi chiedere il permesso
    // fotocamera solo perché il codice era sbagliato.
    if (cameraStarted && !cameraError) startCamera()
  }

  async function handleDecision(azione: 'approva' | 'rifiuta') {
    if (!qrToken) return
    setSubmitting(true)
    try {
      // Il server non accetta più un id scritto nel corpo della richiesta:
      // l'identità di chi approva deve arrivare dal token di sessione.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Devi accedere per approvare una delega.')
        // Ci portiamo dietro il codice, così dopo l'accesso si torna qui e
        // l'anteprima si riapre da sola invece di far ricominciare tutto.
        router.push(`/login?redirect=${encodeURIComponent(`/curatore/scansiona?${PARAMETRO_CODICE}=${qrToken}`)}`)
        return
      }

      const res = await fetch('/api/curatore/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ qrToken, azione }),
      })
      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || "Errore durante l'operazione.")
        if (data.requiresPayoutSetup) {
          router.push('/profile')
        }
        return
      }

      if (azione === 'rifiuta') {
        toast.success('Mandato rifiutato.')
        router.push('/')
      } else {
        toast.success('Mandato approvato! L\'annuncio è ora pubblico.')
        router.push(`/announcement/${data.announcementId}`)
      }
    } catch (err) {
      console.error('Errore decisione mandato:', err)
      toast.error('Errore di connessione.')
    } finally {
      setSubmitting(false)
    }
  }

  if (preview) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-stone-200 p-8">
          <span className="text-4xl block text-center mb-3">🤝</span>
          <h1 className="text-xl font-black uppercase italic text-stone-900 text-center mb-1">Conferma Delega</h1>
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center mb-6">
            Proposta da {preview.curatorName}
          </p>

          {preview.imageUrl && (
            <div className="w-full h-40 bg-stone-50 rounded-2xl border border-stone-100 overflow-hidden mb-4 flex items-center justify-center">
              <img src={preview.imageUrl} className="max-h-full max-w-full object-contain" alt={preview.title} />
            </div>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
              <span className="text-[10px] font-black uppercase text-stone-400">Oggetto</span>
              <span className="text-sm font-black text-stone-900">{preview.title}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
              <span className="text-[10px] font-black uppercase text-stone-400">Prezzo</span>
              <span className="text-sm font-black text-rose-600">€ {Number(preview.price).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
              <span className="text-[10px] font-black uppercase text-stone-400">Custodia</span>
              <span className="text-sm font-black text-stone-900">{preview.custodyType === 'in_custodia' ? 'Presso il Curatore' : 'Resta da te'}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[10px] font-black uppercase text-emerald-700">La tua quota</span>
              <span className="text-lg font-black text-emerald-700">{preview.ownerPercentage}%</span>
            </div>
          </div>

          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest text-center mb-6">
            {preview.custodyType === 'in_custodia'
              ? 'L\'oggetto sarà ritirato dal Curatore. In caso di danni o difformità, la responsabilità è sua.'
              : 'L\'oggetto resta a casa tua. Sei tu il responsabile della sua conformità.'}
          </p>

          {/* Se chi guarda non può approvare, lo diciamo QUI invece di
              lasciarglielo scoprire premendo il pulsante. Il caso più
              frequente è il Curatore che apre il proprio link per provarlo. */}
          {preview.bloccante ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
              <p className="text-xs font-bold text-amber-800 leading-relaxed">{preview.bloccante}</p>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/curatore/scansiona?${PARAMETRO_CODICE}=${preview.token || qrToken || ''}`)}`}
                className="inline-block mt-4 bg-stone-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all"
              >
                Accedi con l&apos;altro account
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleDecision('approva')}
                disabled={submitting}
                className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {submitting ? 'Approvazione...' : '✅ Approva Delega'}
              </button>
              <button
                onClick={() => handleDecision('rifiuta')}
                disabled={submitting}
                className="w-full bg-stone-100 text-stone-600 py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-stone-200 transition-all disabled:opacity-50"
              >
                Rifiuta
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 font-sans bg-stone-950">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-black uppercase italic text-white mb-2">Approva una Delega</h1>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-6">
          Inquadra il QR mostrato dal Curatore
        </p>

        {!cameraStarted ? (
          // NUOVO: schermata iniziale con pulsante esplicito - la fotocamera
          // parte SOLO da qui, mai in automatico all'apertura della pagina.
          <div className="bg-stone-900 border border-stone-800 rounded-[2rem] p-10">
            <span className="text-5xl block mb-4">📷</span>
            <p className="text-xs font-bold text-stone-300 mb-6 leading-relaxed">
              Per leggere il QR ci serve accedere alla tua fotocamera. Tocca il pulsante per attivarla.
            </p>
            <button
              onClick={startCamera}
              className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-rose-700 transition-all"
            >
              Attiva Fotocamera
            </button>
          </div>
        ) : cameraError ? (
          <div className="bg-stone-900 border border-rose-900/50 rounded-2xl p-8">
            <p className="text-sm font-bold text-rose-400 mb-4">{cameraError}</p>
            <button onClick={startCamera} className="bg-stone-800 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all">
              Riprova
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-square rounded-[2rem] overflow-hidden border border-stone-800 bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {loadingPreview && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <p className="text-white text-xs font-black uppercase tracking-widest animate-pulse">Caricamento...</p>
              </div>
            )}
            <div className="absolute inset-8 border-2 border-white/40 rounded-2xl pointer-events-none" />
          </div>
        )}

        {/* NUOVO: alternative SEMPRE disponibili, non nascoste dietro un
            errore della fotocamera. Sono la differenza fra una funzione
            usabile e una che non si riesce a completare: chi ha un solo
            telefono non può inquadrare lo schermo su cui il QR è mostrato,
            e su molti display la lettura fallisce comunque. */}
        <div className="mt-8 bg-stone-900 border border-stone-800 rounded-[2rem] p-6 text-left">
          <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4 text-center">
            Oppure, senza inquadrare
          </p>

          <label className="text-[9px] font-black uppercase text-stone-500 tracking-widest">
            Link ricevuto, o codice sotto il QR
          </label>
          <div className="flex gap-2 mt-2 mb-5">
            <input
              type="text"
              value={codiceManuale}
              onChange={(e) => setCodiceManuale(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCodiceManuale() }}
              placeholder="Incolla qui il link o il codice"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-stone-950 border border-stone-700 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-rose-500"
            />
            <button
              onClick={handleCodiceManuale}
              disabled={loadingPreview}
              className="shrink-0 bg-rose-600 text-white px-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all disabled:opacity-50"
            >
              Vai
            </button>
          </div>

          <label className="block w-full">
            <span className="block w-full text-center bg-stone-800 text-stone-200 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all cursor-pointer">
              {analizzandoFoto ? 'Lettura in corso...' : '🖼️ Carica una foto del QR'}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFotoQr}
              disabled={analizzandoFoto}
              className="hidden"
            />
          </label>
        </div>

        <Link href="/" className="inline-block mt-8 text-stone-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          ← Torna alla Home
        </Link>
      </div>
    </div>
  )
}
