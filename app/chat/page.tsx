'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const router = useRouter()
  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  useEffect(() => { loadChat() }, [])

  async function loadChat() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    let query = supabase.from('messages').select('*').order('created_at', { ascending: true })
    if (!IS_STAFF) query = query.or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    const { data } = await query
    if (data) setMessages(data)
  }

  async function sendMessage() {
    if (!newMessage.trim()) return
    await supabase.from('messages').insert([{ content: newMessage, sender_id: user.id }])
    setNewMessage('')
    loadChat()
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      <div className="bg-white p-6 border-b border-stone-200 flex justify-between items-center">
        <h1 className="text-xl font-black uppercase italic">Chat</h1>
        <Link href="/" className="text-[10px] font-black uppercase text-stone-400">← Home</Link>
      </div>
      <div className="flex-grow p-4 space-y-4 overflow-y-auto max-w-2xl mx-auto w-full">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-bold ${m.sender_id === user?.id ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200'}`}>
              {m.content}
            </div>
            {IS_STAFF && <button onClick={async () => { await supabase.from('messages').delete().eq('id', m.id); loadChat() }} className="text-[7px] font-black text-red-500 uppercase mt-1">Cancella (Staff)</button>}
          </div>
        ))}
      </div>
      <div className="p-6 bg-white border-t border-stone-200">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input value={newMessage} onChange={e => setNewMessage(e.target.value)} type="text" placeholder="Scrivi..." className="flex-grow p-4 bg-stone-50 border border-stone-100 rounded-2xl text-xs outline-none" />
          <button onClick={sendMessage} className="bg-stone-900 text-white px-8 rounded-2xl font-black uppercase text-[10px]">Invia</button>
        </div>
      </div>
    </div>
  )
}
