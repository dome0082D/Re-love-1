'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function RealtimeNotifications() {
  const [popupMessage, setPopupMessage] = useState<string | null>(null)
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tiene traccia dell'utente per cui siamo attualmente in ascolto, così da
  // non ricreare inutilmente lo stesso canale a ogni evento di autenticazione
  // (Supabase ne emette diversi: TOKEN_REFRESHED, USER_UPDATED, ecc.)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let channel: any = null
    let cancelled = false

    const teardownChannel = () => {
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
      currentUserIdRef.current = null
    }

    const setupRealtimeFor = (userId: string) => {
      if (cancelled) return
      // Già in ascolto per questo stesso utente: non facciamo nulla.
      if (currentUserIdRef.current === userId && channel) return

      teardownChannel()
      currentUserIdRef.current = userId

      // FIX: nome del canale legato all'utente invece di uno fisso
      // ("custom-notification-channel"). Con un nome fisso, un rimontaggio
      // del componente o un cambio di account potevano lasciare due canali
      // omonimi a contendersi lo stesso nome.
      channel = supabase.channel(`notifications-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}` // Ascoltiamo SOLO le notifiche di questo utente!
          },
          (payload) => {
            setPopupMessage(payload.new.message)

            // Se arriva una seconda notifica entro 6 secondi dalla prima, il
            // vecchio timer scadeva comunque e nascondeva subito il nuovo
            // messaggio. Cancellando sempre il timer precedente, ogni
            // messaggio resta visibile per i suoi 6 secondi pieni.
            if (dismissTimeoutRef.current) {
              clearTimeout(dismissTimeoutRef.current)
            }
            dismissTimeoutRef.current = setTimeout(() => {
              setPopupMessage(null)
              dismissTimeoutRef.current = null
            }, 6000)

            // Navbar ascolta questo evento del browser invece di aprire una
            // seconda sottoscrizione tutta sua agli stessi identici INSERT.
            window.dispatchEvent(new CustomEvent('relove:new-notification', { detail: payload.new }))
          }
        )
        .subscribe()
    }

    // 1. Controllo iniziale: se siamo già loggati all'apertura della pagina.
    const initialCheck = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!cancelled && user) setupRealtimeFor(user.id)
      } catch (err) {
        console.error('Errore controllo utente per notifiche:', err)
      }
    }
    initialCheck()

    // 2. FIX IMPORTANTE: prima il controllo qui sopra era l'UNICO. Chi apriva
    // il sito da sloggato e poi faceva login NON riceveva più nessuna
    // notifica in tempo reale per tutta la sessione: questo componente aveva
    // già rinunciato all'avvio e non riprovava mai più. E dato che la pagina
    // di login naviga senza ricaricare davvero il sito, il componente non
    // veniva nemmeno rimontato - restava muto fino a un ricaricamento
    // manuale della pagina. Ora ci mettiamo in ascolto dei cambi di stato:
    // al login attiviamo il canale, al logout lo chiudiamo.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (session?.user) {
        setupRealtimeFor(session.user.id)
      } else {
        teardownChannel()
        setPopupMessage(null)
      }
    })

    return () => {
      cancelled = true
      teardownChannel()
      authListener?.subscription?.unsubscribe()
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current)
    }
  }, [])

  if (!popupMessage) return null

  return (
    // FIX ANDROID: aggiunto lo spazio della barra di stato al posizionamento.
    // Con "viewportFit: cover" attivo in layout.tsx (serve per lo sfondo a
    // tutto schermo), un elemento ancorato in alto può finire parzialmente
    // sotto orologio e batteria su alcuni telefoni. Il calcolo qui sotto
    // aggiunge automaticamente lo spazio necessario, che varia da modello a
    // modello, e vale 0 dove non serve.
    <div
      className="fixed right-4 z-[9999] max-w-[calc(100vw-2rem)] sm:max-w-sm bg-stone-900 text-white p-5 rounded-2xl shadow-2xl animate-in slide-in-from-right flex items-center gap-4 border border-rose-500"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 6rem)' }}
    >
      <div className="text-3xl animate-bounce shrink-0">🔔</div>
      <div className="min-w-0">
        <h4 className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Nuovo Avviso</h4>
        <p className="text-sm font-black text-white break-words">{popupMessage}</p>
      </div>
      <button onClick={() => setPopupMessage(null)} className="ml-4 text-stone-400 hover:text-white transition-colors shrink-0">
        ✕
      </button>
    </div>
  )
}
