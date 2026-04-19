'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function StaffUserProfile() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u || u.email !== 'dome0082@gmail.com') {
      router.push('/')
      return
    }

    const { data: p } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (p) setProfile(p)

    const { data: ann } = await supabase.from('announcements').select('*').eq('user_id', id).order('created_at', { ascending: false })
    if (ann) setAnnouncements(ann)

    setLoading(false)
  }

  async function deleteAd(adId: string) {
    if(!confirm("STAFF: Sicuro di voler cancellare questo annuncio?")) return
    await supabase.from('announcements').delete().eq('id', adId)
    setAnnouncements(announcements.filter(a => a.id !== adId))
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-bold uppercase tracking-widest text-[10px] text-stone-400">Caricamento Profilo...</div>
  if (!profile) return <div className="min-h-screen flex items-center justify-center font-black uppercase text-xl">Profilo non trovato</div>

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-xl border border-stone-100 overflow-hidden">
        
        <div className="bg-stone-900 p-8 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-light uppercase tracking-[0.2em]">Profilo Utente: <span className="text-emerald-400 font-bold">{profile.user_serial_id}</span></h1>
          </div>
          <Link href="/staff/users" className="text-[10px] border border-stone-700 px-4 py-2.5 rounded-md font-bold uppercase hover:bg-stone-800 transition-colors">← Torna alla Lista</Link>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
          
          {/* DATI UTENTE */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Dati Personali & Recapiti</h3>
            <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 space-y-3">
              <p className="text-sm"><span className="font-bold text-stone-400 uppercase text-[10px] block">Nome completo:</span> <span className="font-medium text-stone-800">{profile.first_name || '-'} {profile.last_name || '-'}</span></p>
              <p className="text-sm"><span className="font-bold text-stone-400 uppercase text-[10px] block">Nazione e Regione:</span> <span className="font-medium text-stone-800">{profile.residence_country || '-'}, {profile.residence_region || '-'}</span></p>
              <p className="text-sm"><span className="font-bold text-stone-400 uppercase text-[10px] block">Città e CAP:</span> <span className="font-medium text-stone-800">{profile.residence_city || '-'} ({profile.residence_zip || '-'})</span></p>
              <p className="text-sm"><span className="font-bold text-stone-400 uppercase text-[10px] block">Indirizzo (Via/Civico):</span> <span className="font-medium text-stone-800">{profile.residence_street || '-'}, n. {profile.residence_number || '-'}</span></p>
            </div>
          </div>

          {/* ANNUNCI UTENTE */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400 border-b border-stone-100 pb-2">Annunci Pubblicati ({announcements.length})</h3>
            <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {announcements.length === 0 ? (
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest py-4">Nessun annuncio pubblicato.</p>
              ) : announcements.map(ann => (
                <div key={ann.id} className="p-4 bg-white border border-stone-200 rounded-lg flex justify-between items-center shadow-sm">
                  <div>
                    <span className={`px-2 py-1 text-[7px] font-black tracking-widest rounded-sm text-white mr-2 ${ann.type === 'wanted' ? 'bg-amber-500' : 'bg-emerald-600'}`}>{ann.type}</span>
                    <span className="text-xs font-bold uppercase text-stone-800 truncate">{ann.title}</span>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">€{ann.price}</p>
                  </div>
                  <button onClick={() => deleteAd(ann.id)} className="bg-red-50 text-red-500 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-md text-[8px] font-black uppercase tracking-widest transition-colors border border-red-200 hover:border-red-600">Elimina</button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
