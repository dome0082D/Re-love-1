'use client'

// components/BanGate.tsx
// Controlla, su OGNI pagina del sito (e' agganciato in layout.tsx, che
// avvolge tutto), se l'utente che ha effettuato l'accesso e' stato
// bloccato dallo staff o dal sistema automatico anti-scambio-contatti. Se
// lo e', mostra una schermata a schermo intero che impedisce di
// continuare a usare il sito, con indicato il motivo e un contatto per
// chiedere allo staff di riesaminare il caso.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function BanGate() {
  const [banInfo, setBanInfo] = useState<{ reason: string | null } | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    checkBanStatus()

    // Ricontrolla anche quando l'utente accede/esce, non solo al primo
    // caricamento della pagina - cosi' se viene bloccato mentre e' gia'
    // dentro al sito (es. subito dopo aver inviato un messaggio vietato),
    // lo vede comunque appena la pagina si aggiorna.
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      checkBanStatus()
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function checkBanStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setBanInfo(null)
        setChecked(true)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('is_banned, banned_reason')
        .eq('id', user.id)
        .single()

      if (!error && data?.is_banned) {
        setBanInfo({ reason: data.banned_reason || null })
      } else {
        setBanInfo(null)
      }
    } catch (err) {
      console.error('[BanGate] Errore controllo blocco:', err)
    } finally {
      setChecked(true)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Finche' non abbiamo ancora controllato, o se l'utente non e' bloccato,
  // non mostriamo nulla - il sito funziona normalmente.
  if (!checked || !banInfo) return null

  return (
    <div className="fixed inset-0 z-[999999] bg-stone-950 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-stone-900 border border-rose-900/50 rounded-[2.5rem] p-10 shadow-2xl">
        <span className="text-6xl block mb-6">⛔</span>
        <h1 className="text-2xl font-black uppercase italic text-rose-500 mb-4">Account Sospeso</h1>
        <p className="text-sm font-bold text-stone-300 mb-2">
          Il tuo account e' stato sospeso dallo staff di Re-love.
        </p>
        {banInfo.reason && (
          <p className="text-xs text-stone-400 italic mt-4 p-4 bg-stone-800/60 rounded-2xl border border-stone-700">
            Motivo: {banInfo.reason}
          </p>
        )}
        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-8 mb-6">
          Se pensi si tratti di un errore, contatta lo staff per chiedere la riattivazione.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href="mailto:dome0082@gmail.com?subject=Richiesta%20riattivazione%20account%20Re-love"
            className="w-full bg-rose-600 text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all"
          >
            Contatta lo Staff
          </a>
          <button
            onClick={handleSignOut}
            className="w-full bg-stone-800 text-stone-300 py-4 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-stone-700 transition-all"
          >
            Esci dall'account
          </button>
        </div>
      </div>
    </div>
  )
}
