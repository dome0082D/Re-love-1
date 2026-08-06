'use client'

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

  const handleLogin = async () => {
    setLoading(true)
    setStatus({ type: '', msg: '' })
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setStatus({ type: 'error', msg: error.message })
      else {
        router.push('/')
        router.refresh()
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err?.message || 'Errore di autenticazione' })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-gray-200 p-8">
        <h2 className="text-3xl font-serif font-black text-slate-800 mb-6 tracking-tighter text-center uppercase">Area Riservata</h2>

        {status.msg && (
          <div className={`text-[10px] p-4 rounded-md mb-6 border font-black uppercase tracking-widest ${
            status.type === 'error' ? 'bg-red-50 text-red-500 border-red-100' : 'bg-green-50 text-green-600 border-green-100'
          }`}>
            {status.msg}
          </div>
        )}

        <div className="space-y-5">
          <input 
            type="email" placeholder="Email"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" placeholder="Password"
            className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-sky-500 text-sm"
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-4 pt-2">
            <button onClick={handleLogin} disabled={loading} className="bg-slate-800 text-white py-4 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 active:translate-y-1 transition-all">Accedi</button>
          </div>
        </div>
        <div className="mt-6 text-center text-sm">
          <Link href="/register" className="text-[10px] font-bold text-gray-400 hover:text-sky-600 uppercase tracking-widest transition-colors">Non hai un account? Registrati</Link>
        </div>
        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <Link href="/" className="text-[9px] font-bold text-gray-400 hover:text-sky-600 uppercase tracking-widest transition-colors">← Torna alla vetrina</Link>
        </div>
      </div>
    </div>
  )
}
