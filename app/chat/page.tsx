'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { pushNotify } from '@/lib/pushNotify'
import { containsForbiddenContact, reportChatViolation } from '@/lib/chatSecurity'

const POPULAR_EMOJIS = [
  '😀', '😂', '🥰', '😎', '🤔', '😢', '😡', '😱',
  '👍', '👎', '❤️', '🔥', '🎉', '✨', '👀', '🙌',
  '🙏', '🤝', '✅', '❌', '👋', '💡', '💰', '📦'
]

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({})
  const [activeChatPair, setActiveChatPair] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hiddenPairs, setHiddenPairs] = useState<Set<string>>(new Set())
  const [showEmojis, setShowEmojis] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const IS_STAFF = user?.email === 'dome0082@gmail.com';

  // NOTA: le funzioni sotto sono dichiarate PRIMA degli useEffect che le
  // richiamano - non solo per ordine estetico, ma perché una regola più
  // recente di ESLint/Next (react-hooks) segnala come ERRORE vero e
  // proprio l'uso di una funzione dentro un useEffect quando è definita
  // più in basso nel componente, anche se in JavaScript funzionerebbe lo
  // stesso grazie al "hoisting". Questo errore rischiava di bloccare la
  // build su Vercel, come già successo altre volte con questo progetto.

  async function loadInitialData() {
    try {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { router.push('/login'); return }
      setUser(currentUser)

      const { data: profs } = await supabase.from('profiles').select('id, first_name, user_serial_id, email')
      const pMap: Record<string, any> = {}
      if (profs) profs.forEach(p => pMap[p.id] = p)
      setProfilesMap(pMap)

      const isStaffUser = currentUser.email === 'dome0082@gmail.com'
      let query = supabase.from('messages').select('*').order('created_at', { ascending: true })
      if (!isStaffUser) {
         query = query.or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      }

      const { data: msgs, error: msgsError } = await query

      if (msgsError) throw msgsError
      if (msgs) setMessages(msgs)

      if (!isStaffUser) {
        const { data: hidden, error: hiddenError } = await supabase
          .from('hidden_conversations')
          .select('other_user_id')
          .eq('user_id', currentUser.id)
        if (!hiddenError && hidden) {
          setHiddenPairs(new Set(hidden.map((h: any) => h.other_user_id)))
        }
      }

    } catch (error: any) {
      console.error("Errore caricamento chat:", error)
      setErrorMsg(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !activeChatPair) return

    const usersInChat = activeChatPair.split('_')
    const receiverId = usersInChat.find(u => u !== user.id) || usersInChat[0]

    // FIX: prima, rilevare un link/numero di telefono bloccava SOLO
    // l'invio del messaggio, con un avviso - l'utente poteva riprovare
    // quante volte voleva. Su richiesta, ora il sistema registra il caso
    // e concede qualche giorno di tempo: se tra i due utenti risulta poi
    // una vendita/scambio VERO concluso su Re-love, non succede nulla. Se
    // il tempo scade senza che sia successo nulla, a quel punto (e solo
    // a quel punto) entrambi gli account vengono bloccati - il controllo
    // gira automaticamente una volta al giorno (vedi
    // app/api/cron/check-suspicious-exchanges). La regola di rilevamento
    // e' condivisa (lib/chatSecurity.ts) con la chat pubblica della Home,
    // cosi' e' identica ovunque.
    if (containsForbiddenContact(newMessage)) {
       await reportChatViolation(user.id, receiverId, newMessage)
       alert("ATTENZIONE - RE-LOVE SECURITY:\nQuesto messaggio contiene un contatto esterno o un riferimento a un pagamento fuori dalla piattaforma, e non e' stato inviato.\n\nSe tu e l'altro utente non concludete uno scambio vero su Re-love entro 30 giorni, i vostri account potrebbero essere sospesi.")
       setNewMessage('')
       return
    }

    const messageContent = newMessage;
    setShowEmojis(false)

    try {
      const { error: sendError } = await supabase.from('messages').insert([{
          content: messageContent,
          sender_id: user.id,
          receiver_id: receiverId
      }])

      if (sendError) throw sendError

      setNewMessage('')

      if (receiverId !== user.id) {
        try {
          const senderName = profilesMap[user.id]?.first_name || 'Un utente';
          const anteprima = messageContent.length > 20 ? messageContent.substring(0, 20) + '...' : messageContent;
          await supabase.from('notifications').insert([{
            user_id: receiverId,
            message: `💬 Nuovo messaggio da ${senderName}: "${anteprima}"`,
            is_read: false
          }])
          pushNotify(receiverId, 'Nuovo messaggio 💬', `${senderName}: ${anteprima}`, '/chat')
        } catch (notifErr) {
          console.warn("Notifica di nuovo messaggio non inviata:", notifErr)
        }
      }

    } catch (e: any) {
      console.error("Errore invio:", e)
      alert("Messaggio non inviato. Il testo e' rimasto nel campo, riprova.")
    }
  }


  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji)
  }

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Eliminare definitivamente questo messaggio? L'azione è irreversibile.")) return
    try {
      const { error } = await supabase.from('messages').delete().eq('id', messageId)
      if (error) throw error
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err: any) {
      console.error('Errore eliminazione messaggio:', err)
      alert("Errore durante l'eliminazione. Riprova.")
    }
  }

  async function handleDeleteConversation(pairKey: string) {
    const [u1, u2] = pairKey.split('_')
    const otherUserId = u1 === user?.id ? u2 : u1

    if (IS_STAFF) {
      if (!confirm("ATTENZIONE STAFF: stai per eliminare DEFINITIVAMENTE tutti i messaggi di questa conversazione, per entrambi gli utenti. L'azione è irreversibile e toglie anche la prova utile per eventuali controversie. Continuare?")) return
      try {
        const { error } = await supabase.from('messages').delete()
          .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`)
        if (error) throw error
        setMessages(prev => prev.filter(m => {
          const p = [m.sender_id, m.receiver_id].sort().join('_')
          return p !== pairKey
        }))
        setActiveChatPair(null)
      } catch (err: any) {
        console.error('Errore eliminazione conversazione:', err)
        alert("Errore durante l'eliminazione. Riprova.")
      }
    } else {
      if (!confirm("Vuoi eliminare questa conversazione? Sparirà solo dalla tua vista - se questa persona ti scrive di nuovo, ricomparirà.")) return
      try {
        const { error } = await supabase.from('hidden_conversations')
          .upsert([{ user_id: user.id, other_user_id: otherUserId }], { onConflict: 'user_id,other_user_id' })
        if (error) throw error
        setHiddenPairs(prev => new Set(prev).add(otherUserId))
        setActiveChatPair(null)
      } catch (err: any) {
        console.error('Errore nascondimento conversazione:', err)
        alert("Errore durante l'eliminazione. Riprova.")
      }
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (!user) return;

    const appendMessageDedup = (incoming: any) => {
      setMessages((current) => {
        if (current.some((m) => m.id === incoming.id)) return current
        return [...current, incoming]
      })
      if (!IS_STAFF && incoming.sender_id && incoming.sender_id !== user.id) {
        setHiddenPairs((prev) => {
          if (!prev.has(incoming.sender_id)) return prev
          const next = new Set(prev)
          next.delete(incoming.sender_id)
          return next
        })
      }
    }

    try {
      let channelBuilder = supabase.channel(`chat-messages-${user.id}`)

      if (IS_STAFF) {
        channelBuilder = channelBuilder.on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => appendMessageDedup(payload.new)
        )
      } else {
        channelBuilder = channelBuilder
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
            (payload) => appendMessageDedup(payload.new)
          )
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${user.id}` },
            (payload) => appendMessageDedup(payload.new)
          )
      }

      const channel = channelBuilder.subscribe()
      return () => { supabase.removeChannel(channel) }
    } catch (err) {
      console.warn("Realtime non avviato:", err)
    }
  }, [user, IS_STAFF])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeChatPair])

  const conversations: Record<string, any[]> = {}
  messages.forEach(m => {
     if (!m.sender_id || !m.receiver_id) return
     const pair = [m.sender_id, m.receiver_id].sort().join('_')
     if (!conversations[pair]) conversations[pair] = []
     conversations[pair].push(m)
  })

  const visibleConversationEntries = Object.entries(conversations).filter(([pairKey]) => {
    if (IS_STAFF) return true
    const [u1, u2] = pairKey.split('_')
    const otherUserId = u1 === user?.id ? u2 : u1
    return !hiddenPairs.has(otherUserId)
  })

  return (
    <div className="min-h-screen flex flex-col font-sans pb-24">
      <div className="bg-white p-6 border-b border-stone-200 flex justify-between items-center shadow-sm z-10 sticky top-0">
        <h1 className="text-xl md:text-2xl font-black uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400">
           {activeChatPair ? 'Conversazione' : 'I Tuoi Messaggi'}
        </h1>
        <div className="flex gap-4 items-center">
          {activeChatPair ? (
            <>
              <button onClick={() => handleDeleteConversation(activeChatPair)} className="text-[10px] font-black uppercase text-stone-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <Trash2 size={12} /> {IS_STAFF ? 'Elimina Chat (Staff)' : 'Elimina Chat'}
              </button>
              <button onClick={() => {setActiveChatPair(null); setShowEmojis(false);}} className="text-[10px] font-black uppercase text-stone-400 hover:text-rose-500 transition-colors">← Indietro</button>
            </>
          ) : (
             <Link href="/" className="text-[10px] font-black uppercase text-stone-400 hover:text-rose-500 transition-colors">← Home</Link>
          )}
        </div>
      </div>

      <div className="flex-grow p-4 md:p-8 overflow-y-auto max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="text-center py-20 text-stone-400 text-xs font-bold uppercase tracking-widest animate-pulse">
            Caricamento messaggi...
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 p-6 rounded-3xl border border-red-200 text-center">
            <p className="text-red-500 font-bold uppercase text-[10px] tracking-widest mb-2">Impossibile caricare i messaggi</p>
            <p className="text-xs text-red-400">{errorMsg}</p>
          </div>
        ) : !activeChatPair && visibleConversationEntries.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-stone-100 shadow-sm">
            <span className="text-6xl block mb-4">📭</span>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">Nessuna Chat Attiva</p>
            <p className="text-xs text-stone-400 mt-2">I tuoi messaggi appariranno qui.</p>
          </div>
        ) : !activeChatPair && (
          <div className="space-y-3">
             {visibleConversationEntries.map(([pairKey, msgs]) => {
                const u1 = pairKey.split('_')[0]; const u2 = pairKey.split('_')[1];
                const otherUserId = u1 === user?.id ? u2 : u1;
                const otherName = profilesMap[otherUserId]?.first_name || 'Utente';
                const lastMsg = msgs[msgs.length - 1];

                return (
                  <div key={pairKey} onClick={() => setActiveChatPair(pairKey)} className="group bg-white p-5 rounded-2xl border border-stone-100 shadow-sm hover:border-rose-300 hover:shadow-md transition-all cursor-pointer flex justify-between items-center">
                     <div>
                        <h3 className="text-sm font-bold text-stone-800 uppercase">{otherName}</h3>
                        <p className="text-xs text-stone-500 truncate italic mt-1 group-hover:text-rose-600 transition-colors">&quot;{lastMsg.content}&quot;</p>
                     </div>
                     <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                       💬
                     </div>
                  </div>
                )
             })}
          </div>
        )}

        {activeChatPair && (
          <div className="space-y-4">
            {conversations[activeChatPair]?.map(m => {
              const isMe = m.sender_id === user?.id
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="relative max-w-[80%] flex items-center gap-2">
                    {isMe && (
                      <button onClick={() => handleDeleteMessage(m.id)} title="Elimina messaggio" className="order-first text-stone-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div className={`p-4 rounded-2xl text-xs font-bold shadow-sm ${isMe ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white rounded-tr-none' : 'bg-white border border-stone-200 text-stone-800 rounded-tl-none'}`}>
                      {m.content}
                    </div>
                    {IS_STAFF && !isMe && (
                      <button onClick={() => handleDeleteMessage(m.id)} title="Elimina messaggio (Staff)" className="text-stone-300 hover:text-red-500 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      {activeChatPair && (
        <div className="p-4 bg-white border-t border-stone-200 fixed bottom-0 w-full left-0 z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto relative">

            {showEmojis && (
              <div className="absolute bottom-[calc(100%+10px)] left-0 bg-white border border-stone-200 shadow-xl rounded-2xl p-4 z-30 animate-in slide-in-from-bottom-2 fade-in">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                  {POPULAR_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="text-2xl hover:scale-125 transition-transform cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 items-center">
              <button
                type="button"
                onClick={() => setShowEmojis(!showEmojis)}
                className={`text-2xl transition-all ${showEmojis ? 'text-rose-500 scale-110' : 'text-stone-400 hover:text-rose-400'}`}
              >
                😊
              </button>

              <input
                value={newMessage}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                onChange={e => setNewMessage(e.target.value)}
                type="text"
                placeholder="Scrivi un messaggio..."
                className="flex-grow p-4 bg-stone-50 border border-stone-200 rounded-2xl text-xs font-medium outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all"
              />
              <button
                onClick={sendMessage}
                className="bg-gradient-to-r from-rose-500 to-orange-400 text-white px-6 md:px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md hover:scale-105 transition-all"
              >
                Invia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
