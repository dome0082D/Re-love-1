'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CalendarDays, Clock, MapPin, BookOpen } from 'lucide-react'

export default function AgendaPage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    // Prende solo i laboratori che hanno una data impostata e li ordina
    const { data, error } = await supabase
      .from('workshops')
      .select('*')
      .not('event_date', 'is', null)
      .order('event_date', { ascending: true })

    if (!error && data) {
      setEvents(data)
    }
    setLoading(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      <header className="w-full bg-[#f5efdf] border-b border-stone-200 pt-10 pb-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/laboratori" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-6 transition-colors">
            <ArrowLeft size={12} /> Torna alla Bacheca
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-stone-900 text-rose-400 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-stone-800">
              <CalendarDays size={32} />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-stone-900 leading-none">
                Agenda <span className="text-rose-600">Eventi</span>
              </h1>
              <p className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-2 bg-stone-200/50 inline-block px-3 py-1 rounded-full">
                Tutti i laboratori reali dal database
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 mt-12">
        {loading ? (
          <div className="text-center text-[11px] font-black text-stone-400 uppercase py-20 animate-pulse">Caricamento agenda reale...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-stone-200">
            <p className="text-sm font-black uppercase text-stone-400">Nessun evento in programma</p>
          </div>
        ) : (
          <div className="relative border-l-4 border-stone-200 ml-4 md:ml-6 space-y-12 pb-10">
            {events.map((event) => (
              <div key={event.id} className="relative pl-8 md:pl-12">
                <div className="absolute w-6 h-6 bg-rose-600 rounded-full left-[-15px] top-0 border-4 border-stone-50 shadow-sm"></div>
                
                <div className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest mb-3 inline-flex px-4 py-1.5 rounded-full shadow-sm">
                  {formatDate(event.event_date)}
                </div>

                <div className="bg-white border border-stone-200 rounded-[2rem] p-6 md:p-8 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-4">
                    <span className="text-stone-900 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <BookOpen size={12} className="text-rose-600" /> {event.category}
                    </span>
                  </div>

                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-stone-900 mb-6 uppercase">{event.title}</h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <div className="bg-[#f5efdf] px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="text-[9px] font-black text-stone-500 uppercase block mb-1">Inizio:</span>
                      <span className="font-black text-xl text-stone-900">{event.start_time?.slice(0, 5) || '--:--'}</span>
                    </div>
                    <div className="bg-[#f5efdf] px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="text-[9px] font-black text-stone-500 uppercase block mb-1">Fine:</span>
                      <span className="font-black text-xl text-stone-900">{event.end_time?.slice(0, 5) || '--:--'}</span>
                    </div>
                    <div className="bg-stone-100 px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="text-[9px] font-black text-stone-500 uppercase block mb-1">Luogo:</span>
                      <span className="font-black text-sm text-stone-900 mt-1 leading-tight">{event.location}</span>
                    </div>
                  </div>

                  <p className="text-sm font-medium text-stone-600 leading-relaxed bg-stone-50/50 p-4 rounded-xl border border-stone-100">
                    {event.description || "Nessuna descrizione."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}