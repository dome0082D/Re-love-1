'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { Users, Clock, ArrowRight, ArrowLeft, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LaboratoriPage() {
  const [user, setUser] = useState<User | null>(null)
  const [courses, setCourses] = useState<any[]>([])
  const [membersData, setMembersData] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'bacheca' | 'calendario'>('bacheca')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)

    // Peschiamo i laboratori REALI dal database
    const { data: wsData } = await supabase.from('workshops').select('*').order('created_at', { ascending: false })
    const { data: mData } = await supabase.from('workshop_members').select('*')

    if (wsData) setCourses(wsData)
    if (mData) setMembersData(mData)
    
    setLoading(false)
  }

  // Conta gli iscritti reali per un corso
  const getMembersCount = (courseId: string) => {
    return membersData.filter(m => m.workshop_id === courseId).length + 1 // +1 per includere il creatore
  }

  // Formatta la data reale
  const formatEventDate = (dateString: string, timeString: string) => {
    if (!dateString) return 'Data da definire'
    const d = new Date(dateString)
    const formattedDate = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    return `${formattedDate} ${timeString ? `- ${timeString.slice(0, 5)}` : ''}`
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      <header className="w-full bg-[#f5efdf] border-b border-stone-200 pt-12 pb-16 px-4 md:px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-6 transition-colors">
              <ArrowLeft size={12} /> Torna alla Home
            </Link>
            <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-stone-900 leading-none mb-2">
              Laboratori <span className="text-stone-400">&</span> Corsi
            </h1>
            <p className="text-xs font-bold text-stone-600 uppercase tracking-widest max-w-xl">
              Unisciti alla community. Impara, baratta competenze e crea i tuoi gruppi di lavoro.
            </p>
          </div>
          <Link href="/?create=true" className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-wider px-5 py-3 rounded-xl hover:bg-rose-600 transition-all flex items-center gap-2 shadow-md shrink-0 w-fit">
            <Plus size={14} /> Crea Laboratorio
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-8">
        {/* TABS REALI */}
        <div className="flex gap-6 border-b border-stone-200 mb-8">
          <button 
            onClick={() => setActiveTab('bacheca')}
            className={`pb-3 text-[11px] font-black uppercase tracking-widest transition-colors relative ${activeTab === 'bacheca' ? 'text-rose-600' : 'text-stone-400 hover:text-stone-900'}`}
          >
            Bacheca Gruppi
            {activeTab === 'bacheca' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-600 rounded-t-full"></div>}
          </button>
          <button 
            onClick={() => setActiveTab('calendario')}
            className={`pb-3 text-[11px] font-black uppercase tracking-widest transition-colors relative ${activeTab === 'calendario' ? 'text-rose-600' : 'text-stone-400 hover:text-stone-900'}`}
          >
            Calendario Corsi
            {activeTab === 'calendario' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-600 rounded-t-full"></div>}
          </button>
        </div>

        {/* CONTENUTO REALE */}
        {loading ? (
          <div className="text-center py-20 text-[10px] font-black uppercase text-stone-400 tracking-widest">Caricamento in corso...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-stone-200">
             <p className="text-sm font-black text-stone-900 uppercase tracking-widest">Nessun laboratorio trovato</p>
             <p className="text-[10px] font-bold text-stone-500 uppercase mt-2">Sii il primo a creare un gruppo!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses
              .filter(course => activeTab === 'bacheca' ? true : course.event_date) // Il calendario mostra solo quelli con data
              .sort((a, b) => activeTab === 'calendario' ? new Date(a.event_date).getTime() - new Date(b.event_date).getTime() : 0)
              .map(course => (
              <Link href={`/laboratori/${course.id}`} key={course.id} className="bg-white rounded-[2rem] p-6 border border-stone-200 shadow-sm hover:shadow-md hover:border-rose-200 transition-all flex flex-col group cursor-pointer">
                <div className="mb-6 flex justify-between items-start">
                  <span className="bg-stone-900 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md">
                    {course.category}
                  </span>
                </div>
                
                <h3 className="text-sm font-black uppercase text-stone-900 mb-6 leading-snug group-hover:text-rose-600 transition-colors line-clamp-2">
                  {course.title}
                </h3>
                
                <div className="mt-auto space-y-2">
                  <div className="flex items-center gap-2 text-[9px] font-black text-stone-500 uppercase tracking-widest">
                    <Users size={12} /> {getMembersCount(course.id)} Iscritti
                  </div>
                  <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                    <div className="flex items-center gap-2 text-stone-500">
                      <Clock size={12} /> {formatEventDate(course.event_date, course.start_time)}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center group-hover:bg-rose-100 group-hover:text-rose-600 transition-colors">
                      <ArrowRight size={12} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}