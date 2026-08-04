'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function RealtimeNotifications() {
  const [popupMessage, setPopupMessage] = useState<string | null>(null)
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let channel: any;
    // FIX: se il componente si smonta mentre supabase.auth.getUser() è ancora
    // in corso (es. durante il doppio mount di React Strict Mode in sviluppo,
    // o una navigazione molto rapida), senza questo flag il canale realtime
    // verrebbe creato DOPO che il cleanup è già passato - restando quindi
    // sottoscritto per sempre senza che nessuno lo rimuova più (leak).
    let cancelled = false;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return;

      // Ci mettiamo in ascolto della tabella 'notifications'
      channel = supabase.channel('custom-notification-channel')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}` // Ascoltiamo SOLO le notifiche di questo utente!
          },
          (payload) => {
            // EUREKA! È arrivata una notifica! Mostriamo il popup!
            setPopupMessage(payload.new.message);
            
            // FIX: se arriva una seconda notifica entro 6 secondi dalla prima,
            // il vecchio timer scadeva comunque e nascondeva subito il nuovo
            // messaggio (durata effettiva più corta di 6s, imprevedibile).
            // Cancellando sempre il timer precedente, ogni messaggio resta
            // visibile per i suoi 6 secondi pieni.
            if (dismissTimeoutRef.current) {
              clearTimeout(dismissTimeoutRef.current)
            }
            dismissTimeoutRef.current = setTimeout(() => {
              setPopupMessage(null);
              dismissTimeoutRef.current = null
            }, 6000);

            // FIX: Navbar.tsx apriva una SECONDA sottoscrizione separata
            // esattamente agli stessi INSERT su "notifications", solo per
            // aggiornare il pallino della campanella e provare la notifica
            // nativa - due connessioni WebSocket per lo stesso identico
            // evento. Questo componente resta l'unico che parla davvero con
            // Supabase; Navbar ora si limita ad ascoltare questo evento del
            // browser invece di aprire un canale tutto suo.
            window.dispatchEvent(new CustomEvent('relove:new-notification', { detail: payload.new }))
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current);
    }
  }, [])

  if (!popupMessage) return null;

  return (
    <div className="fixed top-24 right-4 z-[9999] max-w-[calc(100vw-2rem)] sm:max-w-sm bg-stone-900 text-white p-5 rounded-2xl shadow-2xl animate-in slide-in-from-right flex items-center gap-4 border border-rose-500">
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
