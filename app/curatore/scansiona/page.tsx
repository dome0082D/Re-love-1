'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import jsQR from 'jsqr'
import Link from 'next/link'

// Pagina del Proprietario: apre la fotocamera VERA del telefono dentro
// l'app (non rimanda al browser/fotocamera di sistema), legge il QR
// generato dal Curatore, mostra un'anteprima di cosa sta per approvare, e
// solo dopo un tap esplicito conferma il mandato.
//
// FIX: la fotocamera NON parte più da sola all'apertura della pagina
// (era uno useEffect automatico). Su una PWA installata (schermata Home),
// Android a volte blocca in silenzio l'accesso alla fotocamera se la
// richiesta non parte da un tocco diretto dell'utente - nessun permesso
// chiesto, nessun errore, il video resta vuoto. Ora la fotocamera si
// avvia SOLO al tocco del pulsante "Attiva Fotocamera", garantendo che la
// richiesta parta sempre da un gesto reale dell'utente.

interface Anteprima {
  title: string
  description?: string
  price: number
  condition: string
  imageUrl?: string
  custodyType: 'in_sede' | 'in_custodia'
  ownerPercentage: number
  curatorPercentage: number
  curatorName: string
}

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

  function stopCamera() {
    scanningRef.current = false
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }

  // Fermiamo comunque la fotocamera se l'utente lascia la pagina mentre è
  // attiva - questo effetto NON avvia nulla, si limita a pulire.
  useEffect(() => {
    return () => stopCamera()
  }, [])

  async function startCamera() {
    setCameraError(null)
    setCameraStarted(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      scanningRef.current = true
      requestAnimationFrame(scanFrame)
    } catch (err) {
      console.error('Errore accesso fotocamera:', err)
      setCameraError("Impossibile accedere alla fotocamera. Controlla di aver dato il permesso a Re-love nelle impostazioni del browser.")
    }
  }

  function scanFrame() {
    if (!scanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)

        if (code && code.data.startsWith('RELOVE_MANDATE:')) {
          const token = code.data.replace('RELOVE_MANDATE:', '')
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

  async function fetchPreview(token: string) {
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/curatore/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || "QR non valido.")
        resetScanner()
        return
      }
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
    startCamera()
  }

  async function handleDecision(azione: 'approva' | 'rifiuta') {
    if (!qrToken) return
    setSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Devi accedere per approvare un mandato.')
        router.push('/login')
        return
      }

      const res = await fetch('/api/curatore/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, ownerId: user.id, azione }),
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

        <Link href="/" className="inline-block mt-8 text-stone-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          ← Torna alla Home
        </Link>
      </div>
    </div>
  )
}
