'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleAuth = async (e: any) => {
    e.preventDefault()
    setMessage('Elaborazione...')
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else setMessage('Controlla la tua email per il link di conferma!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-3xl p-8 border border-stone-200 shadow-sm text-center">
        <h2 className="text-2xl font-black uppercase italic mb-6">Materiali Auth</h2>
        <form onSubmit={handleAuth} className="space-y-4">
          <input required type="email" placeholder="Email" className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" className="w-full p-4 bg-stone-50 border border-stone-100 rounded-xl text-sm outline-none" onChange={e => setPassword(e.target.value)} />
          <button type="submit" className="w-full bg-stone-900 text-white p-4 rounded-2xl font-black uppercase text-xs hover:bg-emerald-600 transition-all">
            {isSignUp ? 'Registrati' : 'Accedi'}
          </button>
        </form>
        {message && <p className="mt-4 text-[10px] font-bold text-emerald-600 uppercase">{message}</p>}
        <button onClick={() => setIsSignUp(!isSignUp)} className="mt-6 text-[10px] font-black uppercase text-stone-400 hover:text-stone-900">
          {isSignUp ? 'Hai già un account? Accedi' : 'Non hai un account? Registrati'}
        </button>
        <Link href="/" className="block mt-4 text-[10px] font-black uppercase text-stone-300">Torna alla Home</Link>
      </div>
    </div>
  )
}
