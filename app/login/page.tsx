'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  
  // Gestione messaggi e caricamento
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    // FIX: l'intero corpo della funzione non aveva alcuna protezione da
    // eccezioni. Su una connessione Android che cade a metà richiesta - il
    // caso più frequente in tutta questa revisione - la funzione si fermava
    // prima di raggiungere "setLoading(false)": il pulsante "Accedi" restava
    // bloccato su "Attendi..." per sempre, disabilitato, senza nessun modo
    // di riprovare senza ricaricare tutta la pagina. Proprio sulla pagina di
    // login, che è l'ingresso a tutto il resto.
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password 
        })
        if (error) {
          setErrorMsg(error.message)
        } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
          // FIX: per motivi di sicurezza (evitare che si possa scoprire quali
          // email sono già registrate), Supabase risponde SENZA errore anche
          // quando l'email esiste già - la differenza si vede solo qui,
          // nell'array "identities" vuoto. Senza questo controllo, chi
          // proseguiva a registrarsi con un'email già usata vedeva "Controlla
          // la tua email per confermare" e aspettava per sempre un'email di
          // conferma che non sarebbe mai arrivata.
          setErrorMsg('Questo indirizzo email è già registrato. Prova ad accedere invece.')
        } else {
          setSuccessMsg('🎉 Registrazione completata! Controlla la tua casella email (anche nello Spam) per confermare il tuo account.')
          // Svuotiamo i campi per sicurezza
          setEmail('')
          setPassword('')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ 
          email, 
          password 
        })
        if (error) {
          setErrorMsg(error.message === 'Invalid login credentials' ? 'Email o password errate.' : error.message)
        } else {
          router.push('/')
        }
      }
    } catch (err: any) {
      console.error('Errore autenticazione:', err)
      setErrorMsg('Errore di connessione. Controlla la rete e riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans pb-20">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 border border-stone-200 shadow-xl text-center">
        
        <h2 className="text-4xl font-black uppercase italic mb-2 text-rose-500 tracking-tighter">Re-love</h2>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 mb-8">
          {isSignUp ? 'Crea il tuo profilo' : 'Bentornato a bordo'}
        </p>

        <form onSubmit={handleAuth} className="space-y-4">
          <input 
            required 
            type="email" 
            placeholder="Indirizzo Email" 
            value={email}
            autoComplete="email"
            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 focus:bg-white transition-all" 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            required 
            type="password" 
            placeholder="Password (min 6 caratteri)" 
            value={password}
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-bold outline-none focus:border-rose-400 focus:bg-white transition-all" 
            onChange={e => setPassword(e.target.value)} 
          />
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Attendi...' : (isSignUp ? 'Registrati' : 'Accedi')}
          </button>
        </form>

        {/* MESSAGGI DI ERRORE O SUCCESSO */}
        {errorMsg && (
          <div className="mt-6 bg-red-50 p-4 rounded-xl border border-red-100">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-relaxed">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="mt-6 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-relaxed">{successMsg}</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-stone-100 flex flex-col gap-4">
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }} 
            className="text-xs font-black uppercase text-stone-400 hover:text-stone-900 tracking-widest transition-colors"
          >
            {isSignUp ? 'Hai già un account? Accedi' : 'Nuovo utente? Registrati'}
          </button>
          
          <Link href="/" className="inline-block text-[10px] font-bold uppercase text-stone-300 hover:text-stone-500 tracking-widest transition-colors">
            ← Torna al sito
          </Link>
        </div>

      </div>
    </div>
  )
}
