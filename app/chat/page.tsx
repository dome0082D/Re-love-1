'use client'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function ChatListContent() {
  const [conversations, setConversations] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return; setUser(u)
    
    const IS_STAFF = u.email === 'dome0082@gmail.com';
    let query = supabase.from('messages').select('*')
    
    if (!IS_STAFF) query = query.or(`sender_id.eq.${u.id},receiver_id.eq.${u.id}`)
    
    const { data } = await query.order('created_at', { ascending: false })
    if (data) {
      const unique = new Map()
      data.forEach(m => {
        const otherId = m.sender_id === u.id ? m.receiver_id : m.sender_id
        const key = [m.sender_id, m.receiver_id].sort().join('-')
        if (!unique.has(key)) unique.set(key, { ...m, otherId })
      })
      setConversations(Array.from(unique.values()))
    }
  }

  async function deleteConversation(otherId: string) {
    if (!confirm("Vuoi cancellare definitivamente questa conversazione dal database?")) return
    const { data: { user: u } } = await supabase.auth.getUser()
    // L'admin può cancellare basandosi sull'otherId in generale
    await supabase.from('messages').delete().or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`)
    load()
  }

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-10">
           <h1 className="text-2xl font-black uppercase italic text-stone-800">
              {IS_STAFF ? '👑 Tutte le Chat' : '💬 Le tue Chat'}
           </h1>
           <Link href="/" className="text-[9px] font-black uppercase text-stone-400 bg-white border px-3 py-2 rounded-lg">Home</Link>
        </div>

        <div className="space-y-4">
           {conversations.map((c, i) => (
             <div key={i} className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100 flex justify-between items-center group hover:shadow-md transition-all">
                <Link href={`/chat/${c.otherId}`} className="flex items-center gap-4 flex-1">
                   <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400 font-black text-xs uppercase">{c.otherId.slice(0, 3)}</div>
                   <div>
                      <p className="font-bold text-stone-900 uppercase text-sm">Conversazione: {c.otherId.slice(0, 8)}...</p>
                      <p className="text-[10px] text-stone-400 italic mt-1 line-clamp-1">"{c.content}"</p>
                   </div>
                </Link>
                {IS_STAFF && (
                  <button onClick={() => deleteConversation(c.otherId)} className="bg-red-50 text-red-500 p-3 rounded-xl opacity-0 group-hover:opacity-100 transition-all font-black text-[8px] uppercase border border-red-100">🗑️ Elimina</button>
                )}
             </div>
           ))}
           {conversations.length === 0 && <p className="text-center text-xs font-bold text-stone-300 uppercase py-10">Nessun messaggio trovato.</p>}
        </div>
      </div>
    </div>
  )
}

export default function ChatListPage() {
   return <Suspense fallback={<div className="p-10 font-black uppercase text-xs text-center">Caricamento...</div>}><ChatListContent /></Suspense>
}
