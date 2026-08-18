'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { srcFoto, srcSetFoto } from '@/lib/immagini'

const ADMIN_EMAIL = 'dome0082@gmail.com'

export default function StaffUserInspectPage() {
  const { id } = useParams()
  const router = useRouter()

  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({})
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    if (id) checkAdminAndFetch()
  }, [id])

  async function checkAdminAndFetch() {
    setLoading(true)
    setLoadError(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      setAuthorized(false)
      setLoading(false)
      router.push('/')
      return
    }
    setAuthorized(true)

    try {
      const [profRes, annRes, msgRes, allProfRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('announcements').select('*').eq('user_id', id).order('created_at', { ascending: false }),
        supabase.from('messages').select('*').or(`sender_id.eq.${id},receiver_id.eq.${id}`).order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, first_name, email'),
      ])

      if (profRes.error) throw profRes.error

      setProfile(profRes.data)
      setAnnouncements(annRes.data || [])
      setMessages(msgRes.data || [])

      const pMap: Record<string, any> = {}
      ;(allProfRes.data || []).forEach((p: any) => { pMap[p.id] = p })
      setProfilesMap(pMap)
    } catch (err) {
      console.error('Errore caricamento profilo staff:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  // NUOVO: blocca/sblocca l'account direttamente da qui, senza dover
  // tornare alla lista generale in app/staff/page.tsx.
  async function handleToggleBan() {
    if (!profile) return
    const azione = profile.is_banned ? 'sbloccare' : 'bloccare'
    if (!confirm(`Vuoi ${azione} questo utente?`)) return
    setActionLoading(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_banned: !profile.is_banned,
          banned_reason: !profile.is_banned ? 'Bloccato manualmente dallo staff.' : null,
          banned_at: !profile.is_banned ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error
      setProfile((prev: any) => ({ ...prev, is_banned: !prev.is_banned }))
      toast.success(profile.is_banned ? 'Utente sbloccato.' : 'Utente bloccato.')
    } catch (err: any) {
      console.error('Errore blocco/sblocco:', err)
      toast.error("Errore durante l'operazione.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteAnnouncement(annId: string, title: string) {
    if (!confirm(`Eliminare definitivamente l'annuncio "${title}"?`)) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', annId)
      if (error) throw error
      setAnnouncements(prev => prev.filter(a => a.id !== annId))
      toast.success('Annuncio eliminato.')
    } catch (err: any) {
      console.error('Errore eliminazione annuncio:', err)
      toast.error("Errore durante l'eliminazione dell'annuncio.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm('Eliminare definitivamente questo messaggio?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.from('messages').delete().eq('id', msgId)
      if (error) throw error
      setMessages(prev => prev.filter(m => m.id !== msgId))
      toast.success('Messaggio eliminato.')
    } catch (err: any) {
      console.error('Errore eliminazione messaggio:', err)
      toast.error("Errore durante l'eliminazione del messaggio.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteConversation(pairKey: string) {
    if (!confirm('Eliminare DEFINITIVAMENTE tutta questa conversazione, per entrambi gli utenti coinvolti? Azione irreversibile.')) return
    const [u1, u2] = pairKey.split('_')
    setActionLoading(true)
    try {
      const { error } = await supabase.from('messages').delete()
        .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`)
      if (error) throw error
      setMessages(prev => prev.filter(m => {
        const p = [m.sender_id, m.receiver_id].sort().join('_')
        return p !== pairKey
      }))
      toast.success('Conversazione eliminata.')
    } catch (err: any) {
      console.error('Errore eliminazione conversazione:', err)
      toast.error("Errore durante l'eliminazione della conversazione.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSvuotaChat() {
    if (!confirm('Sei sicuro? Questa azione eliminerà TUTTE le chat (inviate e ricevute) di questo utente in modo irreversibile.')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user_chats', { target_user_id: id })
      if (error) throw error
      setMessages([])
      toast.success('Tutte le chat dell\'utente sono state eliminate.')
    } catch (err: any) {
      console.error('Errore svuotamento chat:', err)
      toast.error("Errore durante l'eliminazione: " + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDeleteProfileCascade() {
    if (!confirm('AZIONE NUCLEARE: verranno eliminati messaggi, recensioni, transazioni, annunci, notifiche e l\'ACCESSO AL SITO di questo utente. Sicuro di voler distruggere questi dati?')) return
    setActionLoading(true)
    try {
      const { error } = await supabase.rpc('delete_user_cascade', { target_user_id: id })
      if (error) throw error
      toast.success('Utente eliminato definitivamente dal database.')
      router.push('/staff')
    } catch (err: any) {
      console.error('Errore eliminazione a cascata:', err)
      toast.error('Il database ha bloccato l\'eliminazione: ' + err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const conversations: Record<string, any[]> = {}
  messages.forEach(m => {
    if (!m.sender_id || !m.receiver_id) return
    const pair = [m.sender_id, m.receiver_id].sort().join('_')
    if (!conversations[pair]) conversations[pair] = []
    conversations[pair].push(m)
  })

  if (loading) {
    return <div className="min-h-screen bg-[#1c1c1c] flex items-center justify-center font-black uppercase text-rose-500 tracking-widest animate-pulse">Caricamento profilo...</div>
  }

  if (authorized === false) return null

  if (loadError || !profile) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] flex flex-col items-center justify-center gap-6 text-center p-6">
        <p className="text-rose-500 font-black uppercase text-sm">Impossibile caricare questo profilo.</p>
        <button onClick={checkAdminAndFetch} className="bg-stone-800 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border border-stone-700 hover:bg-stone-700 transition-all">
          Riprova
        </button>
        <Link href="/staff" className="text-stone-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          ← Torna alla Stanza dei Bottoni
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] p-6 md:p-12 font-sans text-stone-200">
      <div className="max-w-6xl mx-auto">

        <Link href="/staff" className="inline-block mb-8 text-stone-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          ← Torna alla Stanza dei Bottoni
        </Link>

        <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 inline-block shadow-lg ${profile.is_banned ? 'bg-rose-600 text-white shadow-rose-500/20' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
              {profile.is_banned ? 'Account Bloccato' : 'Profilo Sotto Lente'}
            </span>
            <h1 className="text-3xl md:text-4xl font-black uppercase italic text-white tracking-tighter break-all">
              {profile.email || 'Nessuna Email'}
            </h1>
          </div>

          {/* NUOVO: blocco/sblocco diretto da qui */}
          <button
            onClick={handleToggleBan}
            disabled={actionLoading}
            className={`px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${profile.is_banned ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
          >
            {profile.is_banned ? '✅ Sblocca Utente' : '⛔ Blocca Utente'}
          </button>
        </div>

        {profile.is_banned && profile.banned_reason && (
          <div className="mb-10 p-5 bg-rose-950/40 border border-rose-900/50 rounded-2xl">
            <p className="text-[9px] font-black uppercase text-rose-400 tracking-widest mb-1">Motivo del blocco</p>
            <p className="text-sm font-bold text-stone-200">{profile.banned_reason}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          {[
            { l: '📧 Indirizzo Email', v: profile.email || '⚠️ Vuota' },
            { l: '👤 Nome', v: profile.first_name || 'Non inserito' },
            { l: '👥 Cognome', v: profile.last_name || 'Non inserito' },
            { l: '🏙️ Città', v: profile.city || 'Non inserito' },
            { l: '📍 Indirizzo', v: profile.address || 'Non inserito' },
            { l: '📅 Data Iscrizione', v: new Date(profile.created_at).toLocaleString('it-IT') },
            { l: '🛡️ Ruolo Sistema', v: profile.role || 'user' },
            { l: '🆔 ID Database', v: profile.id },
            { l: '💳 Stripe Connect', v: profile.stripe_account_id || 'Account non collegato' },
          ].map((item, idx) => (
            <div key={idx} className="bg-stone-800 p-5 rounded-2xl border border-stone-700/50">
              <p className="text-[9px] font-black uppercase text-stone-500 tracking-widest mb-2">{item.l}</p>
              <p className="text-sm font-bold text-white truncate" title={item.v}>{item.v}</p>
            </div>
          ))}
        </div>

        <div className="mb-14">
          <h3 className="text-[11px] font-black uppercase text-orange-400 tracking-[0.3em] mb-6 flex items-center gap-3">
            <span className="w-10 h-[1px] bg-orange-500/30"></span>
            Annunci Pubblicati ({announcements.length})
          </h3>
          {announcements.length === 0 ? (
            <p className="text-stone-600 text-xs italic text-center py-10 bg-stone-800/30 rounded-3xl border border-dashed border-stone-700">
              Nessun annuncio pubblicato da questo utente.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {announcements.map(ann => (
                <div key={ann.id} className="bg-stone-800 rounded-2xl border border-stone-700/50 overflow-hidden flex flex-col">
                  <div className="h-32 bg-stone-900 relative">
                    <img loading="lazy" decoding="async" src={srcFoto(ann.image_url, 300) || '/usato.png'} srcSet={srcSetFoto(ann.image_url, 300)} className="w-full h-full object-cover" alt={ann.title} />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs font-black text-white uppercase truncate">{ann.title}</p>
                      <p className="text-[10px] text-stone-500 font-bold mt-1">€ {ann.price} · {ann.condition}</p>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href={`/announcement/${ann.id}`} target="_blank" className="flex-1 text-center bg-stone-700 text-stone-300 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-stone-600 transition-colors">
                        Vedi
                      </Link>
                      <button
                        onClick={() => handleDeleteAnnouncement(ann.id, ann.title)}
                        disabled={actionLoading}
                        className="flex-1 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mb-14">
          <h3 className="text-[11px] font-black uppercase text-blue-400 tracking-[0.3em] mb-6 flex items-center gap-3">
            <span className="w-10 h-[1px] bg-blue-500/30"></span>
            Conversazioni ({Object.keys(conversations).length})
          </h3>
          {Object.keys(conversations).length === 0 ? (
            <p className="text-stone-600 text-xs italic text-center py-10 bg-stone-800/30 rounded-3xl border border-dashed border-stone-700">
              L'utente non ha ancora scambiato messaggi sulla piattaforma.
            </p>
          ) : (
            <div className="space-y-8">
              {Object.entries(conversations).map(([pairKey, msgs]) => {
                const [u1, u2] = pairKey.split('_')
                const altroId = u1 === profile.id ? u2 : u1
                const altroProfilo = profilesMap[altroId]
                const altroNome = altroProfilo?.first_name || altroProfilo?.email || 'Utente sconosciuto'

                return (
                  <div key={pairKey} className="bg-stone-800/30 rounded-[2rem] border border-stone-700/50 overflow-hidden">
                    <div className="p-5 bg-stone-900/50 border-b border-stone-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <p className="text-xs font-black text-white uppercase">Con: {altroNome}</p>
                      <button
                        onClick={() => handleDeleteConversation(pairKey)}
                        disabled={actionLoading}
                        className="bg-rose-500/10 border border-rose-500/40 text-rose-400 text-[9px] font-black uppercase px-4 py-2 rounded-lg hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        🔥 Elimina Intera Conversazione
                      </button>
                    </div>
                    <div className="p-6 space-y-3">
                      {msgs.map((msg: any) => (
                        <div key={msg.id} className={`p-4 rounded-2xl text-sm border flex justify-between items-start gap-4 ${msg.sender_id === profile.id ? 'bg-stone-800 border-stone-700 ml-0 sm:ml-8' : 'bg-stone-900 border-stone-800 mr-0 sm:mr-8'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-2 gap-2">
                              <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md shrink-0 ${msg.sender_id === profile.id ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                {msg.sender_id === profile.id ? 'Inviato' : 'Ricevuto'}
                              </span>
                              <span className="text-[9px] font-bold text-stone-600 uppercase truncate">{new Date(msg.created_at).toLocaleString('it-IT')}</span>
                            </div>
                            <p className="text-stone-200 font-medium leading-relaxed italic break-words">"{msg.content}"</p>
                          </div>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            disabled={actionLoading}
                            title="Elimina questo messaggio"
                            className="shrink-0 text-stone-500 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="pt-10 border-t border-stone-800 flex flex-wrap gap-4">
          <button onClick={handleSvuotaChat} disabled={actionLoading} className="bg-orange-500/10 border border-orange-500/40 text-orange-500 hover:bg-orange-500 hover:text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50">
            🔥 Svuota Tutte le Chat
          </button>
          <button onClick={handleDeleteProfileCascade} disabled={actionLoading} className="bg-rose-500 text-white hover:bg-rose-600 px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-rose-500/20 disabled:opacity-50">
            ⚠️ Elimina Utente a Cascata
          </button>
        </div>

      </div>
    </div>
  )
}
