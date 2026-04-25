'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ChatDetailPage() {
  const { id: receiver_id } = useParams()
  const searchParams = useSearchParams()
  const ann_id = searchParams.get('ann')
  const router = useRouter()
  
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [myId, setMyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false) // Stato per sbloccare i contatti
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { 
    setup()
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function setup() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      if (ann_id) {
        const { data: ann } = await supabase.from('announcements').select('condition, user_id').eq('id', ann_id).single();
        
        if (ann) {
          const sellerId = ann.user_id;
          const buyerId = user.id === sellerId ? receiver_id : user.id;

          // 1. CONTROLLO PAGAMENTO (LUCCHETTO CHAT)
          if (ann.condition === 'Baratto') {
            const { data: txs } = await supabase.from('transactions').select('buyer_id, status').eq('announcement_id', ann_id).eq('status', 'Pagato');
            const paidUsers = txs?.map(t => t.buyer_id) || [];
            
            if (!paidUsers.includes(user.id) || !paidUsers.includes(receiver_id as string)) {
              alert("🔒 Chat bloccata: Entrambi dovete pagare la commissione di €2.50.");
              router.push(`/announcement/${ann_id}`);
              return;
            }
          } else {
            const { data: tx } = await supabase.from('transactions').select('id, status').eq('announcement_id', ann_id).eq('buyer_id', buyerId).eq('status', 'Pagato').limit(1);
            if (!tx || tx.length === 0) {
              alert("🔒 Chat bloccata: Completa il pagamento per messaggiare.");
              router.push(`/announcement/${ann_id}`);
              return;
            }
          }

          // 2. CONTROLLO CONFERMA (PER SBLOCCO NUMERI/LINK)
          // Controlliamo se esiste una transazione 'Conclusa' o 'Ricevuta'
          const { data: checkConf } = await supabase.from('transactions')
            .select('status')
            .eq('announcement_id', ann_id)
            .in('status', ['Concluso', 'Ricevuto']) 
            .limit(1);
          
          if (checkConf && checkConf.length > 0) {
            setIsConfirmed(true);
          }
        }
      }

      const { data, error } = await supabase.from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      
      if (error) throw error
      if (data) setMessages(data)

    } catch (err) {
      console.error("Errore setup chat:", err)
    } finally {
      setLoading(false)
    }
  }

  async function sendMessage() {
    if (!newMsg.trim()) return

    // 🛡️ FILTRO SICUREZZA: BLOCCA NUMERI E LINK
    let contentToSend = newMsg;
    
    if (!isConfirmed) {
      const phoneRegex = /(\+39|0039)?\s?\d{3}[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g;
      const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(\w+\.(com|it|net|org|me|link))/gi;

      if (phoneRegex.test(newMsg) || linkRegex.test(newMsg)) {
        alert("⚠️ Per la tua sicurezza, non puoi scambiare numeri o link prima della conferma ufficiale dello scambio o dell'arrivo del pacco.");
        contentToSend = newMsg
          .replace(phoneRegex, "[CONTATTO BLOCCATO]")
          .replace(linkRegex, "[LINK BLOCCATO]");
      }
    }

    try {
      const { data, error } = await supabase.from('messages').insert([{
        sender_id: myId, 
        receiver_id: receiver_id,
        announcement_id: ann_id, 
        content: contentToSend
      }]).select()

      if (!error && data) {
        setMessages([...messages, data[0]])
        setNewMsg('')
      }
    } catch (err) {
      console.error("Errore invio messaggio:", err)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 font-sans flex flex-col items-center">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl flex flex-col h-[85vh] overflow-hidden border border-stone-200">
        
        {/* HEADER CHAT TEMA RE-LOVE */}
        <div className="p-6 border-b border-rose-100 bg-white flex justify-between items-center z-10 shadow-sm">
          <Link href="/chat" className="text-[10px] font-black uppercase text-stone-400 hover:text-rose-500 transition-colors">← Indietro</Link>
          <span className="font-black uppercase text-xs tracking-widest italic text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400">Canale Sicuro Re-love</span>
          <div className="flex items-center gap-2">
            <span className="text-[8px] uppercase font-bold text-rose-500 hidden md:block">Online</span>
            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>
          </div>
        </div>
        
        {/* AREA MESSAGGI */}
        <div className="flex-grow p-6 overflow-y-auto space-y-4 bg-stone-50">
          {loading ? (
             <div className="text-center py-10 text-stone-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
               Caricamento conversazione...
             </div>
          ) : messages.length === 0 ? (
             <div className="text-center py-10 opacity-50">
               <span className="text-4xl block mb-2">👋</span>
               <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Rompi il ghiaccio!</p>
             </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.sender_id === myId ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-4 rounded-2xl text-sm font-bold shadow-sm ${m.sender_id === myId ? 'bg-gradient-to-r from-rose-500 to-orange-400 text-white rounded-tr-none' : 'bg-white text-stone-800 rounded-tl-none border border-stone-200'}`}>
                  {m.content}
                  <span className={`block text-[8px] mt-2 text-right uppercase font-black ${m.sender_id === myId ? 'text-white/70' : 'text-stone-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
              </div>
            ))
          )}
          <div ref={scrollRef} />
        </div>

        {/* INPUT INVIO */}
        <div className="p-4 md:p-6 border-t border-stone-100 bg-white flex gap-3">
          <input 
            className="flex-grow p-4 bg-stone-50 border border-stone-200 rounded-xl outline-none text-sm font-medium focus:border-rose-400 focus:ring-2 focus:ring-rose-100 transition-all text-stone-800" 
            placeholder="Scrivi un messaggio..." 
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button onClick={sendMessage} className="bg-stone-900 text-white px-6 md:px-8 rounded-xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform shadow-md">Invia</button>
        </div>
      </div>
      
      {/* NOTA LEGALE RESPONSABILITÀ */}
      <p className="mt-4 text-[9px] font-bold text-stone-400 uppercase tracking-tight text-center max-w-2xl px-4">
        Re-love mette solo in contatto gli utenti. Il sito non ha responsabilità sulla qualità degli oggetti o sull&apos;esito dello scambio.
      </p>
    </div>
  )
}