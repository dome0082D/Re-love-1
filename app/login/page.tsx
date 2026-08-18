'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ type: '', msg: '' })
  const router = useRouter()

  // FIX: dopo l'accesso si finiva SEMPRE in home, anche quando si era
  // arrivati qui da un link preciso - per esempio il link di approvazione di
  // una delega, che porta con se' il codice. Chi lo apriva senza aver fatto
  // accesso perdeva il codice e doveva farselo rimandare. Ora si torna dove
  // si era diretti. Accettiamo solo percorsi interni (che iniziano con una
  // sola "/"): un indirizzo esterno qui sarebbe un invito a spedire la gente
  // altrove partendo da un link Re-love.
  // Letto da window.location al momento dell'invio, non con
  // useSearchParams(): quello obbligherebbe a chiudere la pagina d'ingresso
  // dentro un <Suspense>, lasciandola vuota finche' il browser non ha finito
  // di agganciare il codice.
  function destinazioneDopoAccesso() {
    if (typeof window === 'undefined') return '/'
    const richiesto = new URLSearchParams(window.location.search).get('redirect')
    // Solo percorsi interni: un indirizzo esterno qui sarebbe un invito a
    // spedire la gente altrove partendo da un link Re-love.
    if (!richiesto || !richiesto.startsWith('/') || richiesto.startsWith('//')) return '/'
    return richiesto
  }

  const handleLogin = async (e?: React.FormEvent) => {
    // FIX: gestiamo anche l'invio del modulo col tasto Invio della tastiera
    // (prima funzionava solo cliccando il pulsante: su Android, dove la
    // tastiera mostra un tasto "Vai/Invio" ben visibile, era spontaneo
    // premerlo e non succedeva nulla).
    if (e) e.preventDefault()

    if (!email.trim() || !password) {
      setStatus({ type: 'error', msg: 'Inserisci email e password.' })
      return
    }

    setLoading(true)
    setStatus({ type: '', msg: '' })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        // FIX: il messaggio grezzo di Supabase per credenziali errate è in
        // inglese ("Invalid login credentials") - lo traduciamo, come già
        // facevamo nella versione precedente di questa pagina.
        setStatus({
          type: 'error',
          msg: error.message === 'Invalid login credentials'
            ? 'Email o password errate.'
            : error.message
        })
      } else {
        router.push(destinazioneDopoAccesso())
        router.refresh()
      }
    } catch (err: any) {
      console.error('Errore autenticazione:', err)
      setStatus({ type: 'error', msg: 'Errore di connessione. Controlla la rete e riprova.' })
    } finally {
      // FIX: spostato in "finally" - se qualcosa lanciava un'eccezione prima
      // di arrivare in fondo, il pulsante restava bloccato su "Attendi..."
      // per sempre, proprio sulla pagina d'ingresso di tutta l'app.
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans pb-32">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 border border-stone-200 shadow-xl text-center">

        <h2 className="text-4xl font-black uppercase italic mb-2 text-rose-500 tracking-tighter">Re-love</h2>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-8">
          Bentornato a bordo
        </p>

        {status.msg && (
          <div className={`p-4 rounded-xl mb-6 border ${
            status.type === 'error'
              ? 'bg-red-50 border-red-100'
              : 'bg-emerald-50 border-emerald-100'
          }`}>
            <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${
              status.type === 'error' ? 'text-red-500' : 'text-emerald-600'
            }`}>
              {status.msg}
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            required
            type="email"
            placeholder="Indirizzo Email"
            value={email}
            autoComplete="email"
            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 focus:bg-white transition-all"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            required
            type="password"
            placeholder="Password"
            value={password}
            autoComplete="current-password"
            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 focus:bg-white transition-all"
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Attendi...' : 'Accedi'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col gap-4">
          <Link
            href="/register"
            className="text-xs font-black uppercase text-stone-400 hover:text-stone-900 tracking-widest transition-colors"
          >
            Nuovo utente? Registrati
          </Link>

          <Link
            href="/"
            className="inline-block text-[10px] font-bold uppercase text-stone-300 hover:text-stone-500 tracking-widest transition-colors"
          >
            ← Torna alla vetrina
          </Link>
        </div>

      </div>
    </div>
  )
}
