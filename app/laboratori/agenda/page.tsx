'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CalendarDays, Clock, MapPin, AlignLeft, BookOpen } from 'lucide-react'

// Interfaccia per i dati dell'evento controllata
interface WorkshopEvent {
  id: string;
  title: string;
  description: string;
  event_date: string; // Contiene data e ora inizio
  end_time: string;   // Contiene data e ora fine
  location: string;
  workshops?: {
    title: string;
    category: string;
  };
}

export default function AgendaPage() {
  const [events, setEvents] = useState<WorkshopEvent[]>([])
  const [loading, setLoading] = useState(true)

  // Dati di esempio strutturati esattamente con Data, Ora Inizio e Ora Fine
  const dummyEvents: WorkshopEvent[] = [
    {
      id: '1',
      title: 'Check-up freni e sospensioni',
      description: 'Portate la vostra moto o il vostro scooter. Faremo un controllo generale alla sicurezza del mezzo in vista dell\'estate. Portate guanti da lavoro se volete sporcarvi le mani!',
      event_date: '2026-06-15T15:00:00Z',
      end_time: '2026-06-15T18:00:00Z',
      location: 'Cortile Gemme (Via delle Rose)',
      workshops: { title: 'Manutenzione Moto & Scooter', category: 'Motori' }
    },
    {
      id: '2',
      title: 'Cucina Antispreco: Il Pane Raffermo',
      description: 'Non si butta via niente! Impareremo a fare canederli, polpette di pane e torte salate usando il pane dei giorni scorsi. Assaggio finale garantito per tutti i partecipanti.',
      event_date: '2026-06-18T10:00:00Z',
      end_time: '2026-06-18T12:30:00Z',
      location: 'Cucina Condivisa',
      workshops: { title: 'Cucina Sostenibile', category: 'Cucina' }
    },
    {
      id: '3',
      title: 'Pianificazione Spazi per Balconi',
      description: 'Come incastrare pannelli solari, piante e tavolino in pochi metri quadri. Portate le misure del vostro balcone e faremo un progetto insieme.',
      event_date: '2026-06-22T17:00:00Z',
      end_time: '2026-06-22T19:00:00Z',
      location: 'Sala Comune',
      workshops: { title: 'Ottimizzazione Spazi Off-Grid', category: 'Eco-Design' }
    }
  ]

  useEffect(() => {
    fetchEvents()
  }, [])

  async function fetchEvents() {
    setLoading(true)
    // Query a Supabase: prende gli eventi futuri e li ordina dal più vicino al più lontano
    const { data, error } = await supabase
      .from('workshop_events')
      .select('*, workshops(title, category)')
      .gte('event_date', new Date().toISOString()) 
      .order('event_date', { ascending: true })    

    if (!error && data && data.length > 0) {
      setEvents(data as unknown as WorkshopEvent[])
    } else {
      // Fallback sui dati finti se il DB è vuoto
      setEvents(dummyEvents)
    }
    setLoading(false)
  }

  // Funzione per formattare la Data esatta (es: Lunedì, 15 Giugno 2026)
  const formatDate = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Funzione per estrarre solo l'Ora (es: 15:00)
  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20 relative">
      
      {/* HEADER AGENDA IN PALETTE CON LA HERO */}
      <header className="w-full bg-[#f5efdf] border-b border-stone-200 pt-10 pb-12 px-4 md:px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <Link href="/laboratori" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-6 transition-colors">
            <ArrowLeft size={12} /> Torna alla Bacheca Corsi
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-stone-900 text-rose-400 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg border border-stone-800">
              <CalendarDays size={32} />
            </div>
            <div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-stone-900 leading-none">
                Agenda <span className="text-rose-600">Eventi</span>
              </h1>
              <p className="text-[10px] md:text-[11px] font-bold text-stone-600 uppercase tracking-widest mt-2 bg-stone-200/50 inline-block px-3 py-1 rounded-full">
                Tutti i corsi e laboratori in ordine cronologico
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* TIMELINE CRONOLOGICA VERTICALE */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 mt-12">
        {loading ? (
          <div className="text-center text-[11px] font-black text-stone-400 uppercase tracking-widest py-20 flex flex-col items-center gap-3">
            <Clock size={24} className="animate-spin text-rose-600" />
            Caricamento agenda in corso...
          </div>
        ) : (
          <div className="relative border-l-4 border-stone-200 ml-4 md:ml-6 space-y-12 pb-10">
            {events.map((event) => (
              <div key={event.id} className="relative pl-8 md:pl-12">
                
                {/* PALLINO DI SNODO SULLA LINEA TEMPORALE */}
                <div className="absolute w-6 h-6 bg-rose-600 rounded-full left-[-15px] top-0 border-4 border-stone-50 shadow-sm"></div>

                {/* VISUALIZZAZIONE DATA COMPLETA SOPRA IL RIQUADRO */}
                <div className="bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest mb-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm">
                  {formatDate(event.event_date)}
                </div>

                {/* SCHEDA CORSO DETTAGLIATA */}
                <div className="bg-white border border-stone-200 rounded-[2rem] p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                  
                  {/* Etichetta in alto a destra finta per UI */}
                  <div className="absolute top-6 right-6 text-[9px] font-black uppercase text-stone-400 bg-stone-100 px-3 py-1 rounded-lg">
                    Ingresso Libero 🤝
                  </div>

                  {/* Gruppo di riferimento e categoria */}
                  <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-4 pr-32">
                    <span className="text-stone-900 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                      <BookOpen size={12} className="text-rose-600" /> 
                      Corso: {event.workshops?.title || 'Generico'}
                    </span>
                    <span className="text-stone-300">|</span>
                    <span className="text-[9px] font-black text-stone-500 uppercase tracking-widest">
                      Categoria: {event.workshops?.category}
                    </span>
                  </div>

                  {/* Titolo specifico dell'incontro */}
                  <h3 className="text-xl md:text-2xl font-black tracking-tight text-stone-900 mb-6 leading-tight">
                    {event.title}
                  </h3>

                  {/* BOX ORARI DI INIZIO / FINE E LUOGO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    <div className="flex flex-col bg-[#f5efdf] px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-stone-500 uppercase tracking-widest mb-1">
                        <Clock size={12} /> Ora Inizio:
                      </span>
                      <span className="font-black text-xl text-stone-900">{formatTime(event.event_date)}</span>
                    </div>
                    
                    <div className="flex flex-col bg-[#f5efdf] px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-stone-500 uppercase tracking-widest mb-1">
                        <Clock size={12} /> Ora Fine:
                      </span>
                      <span className="font-black text-xl text-stone-900">{formatTime(event.end_time)}</span>
                    </div>

                    <div className="flex flex-col bg-stone-100 px-4 py-3 rounded-2xl border border-stone-200/50">
                      <span className="flex items-center gap-1.5 text-[9px] font-black text-stone-500 uppercase tracking-widest mb-1">
                        <MapPin size={12} /> Luogo:
                      </span>
                      <span className="font-black text-sm text-stone-900 mt-1 leading-tight">{event.location}</span>
                    </div>
                  </div>

                  {/* Blocco Descrizione esaustiva */}
                  {event.description && (
                    <div className="bg-stone-50/50 rounded-2xl p-5 border border-stone-200/60 mt-2">
                      <p className="text-sm font-medium text-stone-600 leading-relaxed flex gap-3">
                        {event.description}
                      </p>
                    </div>
                  )}

                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}