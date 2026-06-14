'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { ArrowLeft, Share2, CalendarDays, Edit, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export default function DettaglioLaboratorio() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string

  const [user, setUser] = useState<User | null>(null)
  const [course, setCourse] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [courseId])

  async function fetchData() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)

    // Fetch Dati reali del Corso
    const { data: cData, error } = await supabase.from('workshops').select('*').eq('id', courseId).single()
    if (error || !cData) {
      toast.error("Corso non trovato")
      router.push('/laboratori')
      return
    }
    setCourse(cData)

    // Fetch Membri reali del Corso
    const { data: mData } = await supabase.from('workshop_members').select('*').eq('workshop_id', courseId)
    if (mData) setMembers(mData)

    setLoading(false)
  }

  const isCreator = user?.id === course?.creator_id
  const isStaff = user?.email === 'dome0082@gmail.com'
  const canModify = isCreator || isStaff
  const isEnrolled = members.some(m => m.user_id === user?.id)

  const handleJoinLeave = async () => {
    if (!user) return toast.error("Devi accedere per partecipare!")

    if (isEnrolled) {
      // Esci dal corso
      await supabase.from('workshop_members').delete().eq('workshop_id', courseId).eq('user_id', user.id)
      setMembers(members.filter(m => m.user_id !== user.id))
      toast.success("Ti sei disiscritto dal corso.")
    } else {
      // Iscriviti al corso
      const { error } = await supabase.from('workshop_members').insert([{ workshop_id: courseId, user_id: user.id, user_email: user.email }])
      if (!error) {
        setMembers([...members, { workshop_id: courseId, user_id: user.id, user_email: user.email }])
        toast.success("Iscrizione avvenuta con successo! 🎉")
      }
    }
  }

  const handleDelete = async () => {
    if (confirm("Sei sicuro di voler eliminare questo laboratorio?")) {
      await supabase.from('workshops').delete().eq('id', courseId)
      toast.success("Laboratorio eliminato.")
      router.push('/laboratori')
    }
  }

  if (loading) return <div className="min-h-screen bg-stone-50 flex items-center justify-center font-black uppercase tracking-widest text-[10px] text-stone-400">Caricamento Dettagli...</div>
  if (!course) return null

  // Estrae le vere iniziali dall'email per i tondini
  const getInitials = (email: string) => email.substring(0, 2).toUpperCase()

  // Unisce il creatore ai membri per la visualizzazione
  const allParticipants = [{ user_email: course.creator_email, isCreator: true }, ...members]

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      {/* HEADER REALE */}
      <header className="w-full bg-[#f5efdf] border-b border-stone-200 pt-10 pb-12 px-4 md:px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <Link href="/laboratori" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-6 transition-colors">
              <ArrowLeft size={12} /> Torna alla Bacheca
            </Link>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-stone-900 leading-none">
              Dettaglio <br/><span className="text-rose-600">Laboratorio</span>
            </h1>
            <h2 className="mt-4 text-xl font-bold text-stone-800">{course.title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiato!") }} className="w-12 h-12 rounded-full bg-white border border-stone-200 flex items-center justify-center shadow-sm hover:bg-stone-100 transition-colors text-stone-600">
              <Share2 size={18} />
            </button>
            <button onClick={handleJoinLeave} className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-md transition-colors ${isEnrolled ? 'bg-stone-200 text-stone-600 hover:bg-stone-300' : 'bg-stone-900 text-white hover:bg-rose-600'}`}>
              {isEnrolled ? 'Esci dal Gruppo' : 'Partecipa'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLONNA SINISTRA: INFO E CALENDARIO REALE */}
        <div className="md:col-span-2 space-y-8">
          
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-stone-200">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-900 mb-4">Info del Gruppo</h3>
            <p className="text-sm font-medium text-stone-600 leading-relaxed whitespace-pre-wrap">
              {course.description || "Nessuna descrizione fornita dal creatore per questo gruppo."}
            </p>
            
            <div className="mt-6 pt-6 border-t border-stone-100 grid grid-cols-2 gap-4">
               <div>
                  <span className="text-[9px] font-black uppercase text-stone-400 block mb-1">Categoria</span>
                  <span className="text-xs font-bold text-stone-800 uppercase">{course.category}</span>
               </div>
               <div>
                  <span className="text-[9px] font-black uppercase text-stone-400 block mb-1">Costo Partecipazione</span>
                  <span className="text-xs font-black text-rose-600 uppercase">{course.price > 0 ? `€ ${course.price}` : 'Gratuito'}</span>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-stone-200">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-900">Calendario Incontri</h3>
            </div>
            
            {course.event_date ? (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white w-14 h-14 rounded-xl shadow-sm border border-stone-200 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[9px] font-black text-rose-600 uppercase">{new Date(course.event_date).toLocaleDateString('it-IT', { month: 'short' })}</span>
                    <span className="text-lg font-black text-stone-900 leading-none">{new Date(course.event_date).getDate()}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-stone-900">{course.title}</h4>
                    <p className="text-[10px] font-bold text-stone-500 uppercase flex items-center gap-1 mt-1">
                      <MapPin size={10} /> {course.location}
                    </p>
                  </div>
                </div>
                {course.start_time && (
                  <div className="text-right sm:text-center shrink-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 block mb-0.5">Orario</span>
                    <span className="text-sm font-black text-stone-900">{course.start_time.slice(0, 5)} {course.end_time ? `- ${course.end_time.slice(0, 5)}` : ''}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-bold text-stone-500 text-center py-6 bg-stone-50 rounded-2xl border border-stone-200">Nessun incontro pianificato.</p>
            )}
          </div>

        </div>

        {/* COLONNA DESTRA: MEMBRI E ADMIN REALI */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-stone-200">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-900 mb-4 flex items-center gap-2">
              <Users size={14} className="text-rose-600" /> Membri ({allParticipants.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {allParticipants.map((participant, index) => (
                <div key={index} className="relative group">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm border-2 ${participant.isCreator ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                    {getInitials(participant.user_email)}
                  </div>
                  {/* Tooltip per vedere l'email intera al passaggio del mouse */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-stone-900 text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                    {participant.user_email} {participant.isCreator && '(Creatore)'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {canModify && (
            <div className="bg-stone-900 rounded-[2rem] p-6 shadow-md border border-stone-800 text-white">
              <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 mb-2 text-rose-400">
                <Crown size={14} /> Gestione Admin
              </h3>
              <p className="text-[10px] font-medium text-stone-400 mb-6 leading-relaxed">
                Sei il proprietario di questo gruppo {isStaff && '(Staff)'}. Puoi rimuoverlo definitivamente dal database.
              </p>
              
              <button onClick={handleDelete} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest border border-red-500/20">
                <Trash2 size={14} /> Elimina Laboratorio
              </button>
            </div>
          )}

        </div>

      </main>
    </div>
  )
}