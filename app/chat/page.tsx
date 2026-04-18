'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ChatListPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    if (!u) return
    let query = supabase.from('messages').select('*, announcement_id(title)')
    if (u.email !== 'dome0082@gmail.com') query = query.or(`sender_id.eq.${u.id},receiver_id.eq.${u.id}`)
    
    const { data } = await query.order('created_at', { ascending: false })
    if (data) setConversations(data)
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-stone-100 overflow-hidden">
        <div className={`p-6 text-white flex justify-between items-center ${IS_STAFF ? 'bg-stone-900' : 'bg-emerald-700'}`}>
          <h1 className="text-lg font-light uppercase tracking-[0.2em]">{IS_STAFF ? 'Archivio Globale Chat' : 'I Miei Messaggi'}</h1>
          <Link href="/" className="text-[10px] font-bold uppercase tracking-widest border border-white/20 px-3 py-1.5 rounded hover:bg-white/10 transition-colors">Home</Link>
        </div>
        <div className="p-6 space-y-3">
          {conversations.map((c, i) => (
            <div key={i} className="flex justify-between items-center p-4 bg-stone-50 border border-stone-100 rounded-lg hover:border-emerald-200 transition-colors group">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Rif: {c.announcement_id?.title || 'Generico'}</p>
                <p className="text-sm font-medium text-stone-700">"{c.content}"</p>
              </div>
              <Link href={`/chat/${c.sender_id === user?.id ? c.receiver_id : c.sender_id}`} className="text-stone-400 hover:text-emerald-600 transition-colors p-2 text-lg">→</Link>
            </div>
          ))}
          {conversations.length === 0 && <p className="text-center py-20 text-stone-400 text-[10px] font-bold uppercase tracking-widest">Nessun messaggio trovato</p>}
        </div>
      </div>
    </div>
  )
}
