'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function ChatListPage() {
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    if (!u) return

    // Se Staff carica tutto, altrimenti solo i propri
    let query = supabase.from('messages').select('*, announcement_id(title)')
    if (u.email !== 'dome0082@gmail.com') {
      query = query.or(`sender_id.eq.${u.id},receiver_id.eq.${u.id}`)
    }
    
    const { data } = await query.order('created_at', { ascending: false })
    if (data) setConversations(data)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className={`p-8 text-white flex justify-between ${IS_STAFF ? 'bg-red-700' : 'bg-slate-800'}`}>
          <h1 className="text-2xl font-black uppercase italic">{IS_STAFF ? 'Staff: Archivio Globale Chat' : 'I Miei Messaggi'}</h1>
          <Link href="/" className="text-[10px] font-bold uppercase opacity-50">Torna alla Home</Link>
        </div>
        <div className="p-6 space-y-3">
          {conversations.map((c, i) => (
            <div key={i} className="flex justify-between items-center p-5 bg-slate-50 border rounded-2xl">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Oggetto: {c.announcement_id?.title || 'Generico'}</p>
                <p className="text-sm font-medium italic">"{c.content}"</p>
              </div>
              <Link href={`/chat/${c.sender_id === user?.id ? c.receiver_id : c.sender_id}`} className="bg-sky-600 text-white px-5 py-2 rounded-lg text-[9px] font-black uppercase">Vedi Chat</Link>
            </div>
          ))}
          {conversations.length === 0 && <p className="text-center py-20 text-slate-400 font-bold uppercase tracking-widest text-xs">Nessun messaggio trovato</p>}
        </div>
      </div>
    </div>
  )
}
