'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { ArrowLeft, Users, Calendar as CalendarIcon, Settings, Plus, MapPin, Share2 } from 'lucide-react'
import { toast } from 'sonner'

export default function WorkshopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isMember, setIsMember] = useState(false)

  // Simuleremo il caricamento del corso in base all'ID per ora
  const workshopId = params.id as string
  const isStaff = user?.email === 'dome0082@gmail.com'
  const isCreator = true // In futuro: user?.email === workshop.creator
  const canManage = isStaff || isCreator

  useEffect(() => {
    async function getUser() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
    }
    getUser()
  }, [])

  const handleJoin = () => {
    if (!user) {
      toast.error("Accedi per unirti al gruppo!")
      return
    }
    setIsMember(!isMember)
    if (!isMember) {
      toast.success("Ti sei unito al laboratorio! 🎉")
    } else {
      toast("Sei uscito dal laboratorio.")
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      {/* HEADER SPECIFICO DEL CORSO */}
      <div className="w-full bg-[#f5efdf] border-b border-stone-200 pt-10 pb-12 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <Link href="/laboratori" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-6 transition-colors">
            <ArrowLeft size={12} /> Torna alla Bacheca
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="bg-stone-900 text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full w-max mb-4 tracking-widest shadow-sm">
                Categoria Gruppo
              </div>
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-stone-900 leading-none">
                Dettaglio<br/><span className="text-rose-600">Laboratorio</span>
              </h1>
            </div>
            
            <div className="flex gap-3">
              <button className="w-12 h-12 bg-white rounded-[1rem] border border-stone-200 shadow-sm flex items-center justify-center hover:bg-stone-100 transition-colors">
                <Share2 size={20} className="text-stone-600" />
              </button>
              <button 
                onClick={handleJoin}
                className={`px-8 py-3 rounded-[1rem] text-[11px] font-black uppercase tracking-widest shadow-md transition-all ${isMember ? 'bg-stone-200 text-stone-600 border border-stone-300' : 'bg-stone-900 text-white hover:bg-rose-600'}`}
              >
                {isMember ? 'Iscritto ✓' : 'Partecipa'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* COLONNA PRINCIPALE (SINISTRA) */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white border border-stone-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-900 mb-4 border-b border-stone-100 pb-4">Info del Gruppo</h3>
            <p className="text-xs font-bold text-stone-500 leading-relaxed">
              Questo spazio è dedicato alla condivisione di competenze. I membri di questo gruppo organizzano incontri, condividono attrezzi e si aiutano a vicenda. 
              <br/><br/>
              Una volta creato il database, qui apparirà la descrizione ufficiale inserita dal creatore del gruppo.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-[2rem] p-6 md:p-8 shadow-sm">
            <div className="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-stone-900">Calendario Incontri</h3>
              {canManage && (
                <button className="text-[9px] font-black uppercase tracking-widest text-rose-600 hover:text-stone-900 flex items-center gap-1 transition-colors">
                  <Plus size={12} /> Aggiungi
                </button>
              )}
            </div>
            
            {/* Esempio Incontro */}
            <div className="bg-stone-50 border border-stone-200 rounded-[1.5rem] p-4 flex items-center justify-between group hover:bg-[#f5efdf] transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="bg-white border border-stone-200 w-12 h-12 rounded-xl flex items-center justify-center shadow-sm">
                  <CalendarIcon size={20} className="text-stone-400" />
                </div>
                <div>
                  <h4 className="text-[12px] font-black uppercase text-stone-900">Riunione Organizzativa</h4>
                  <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-1 flex items-center gap-1"><MapPin size={10}/> Online / Zoom</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-white px-3 py-1.5 rounded-lg border border-stone-200">20:00</span>
            </div>
          </div>
        </div>

        {/* COLONNA LATERALE (DESTRA) */}
        <div className="space-y-6">
          <div className="bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-stone-900 mb-4 flex items-center gap-2">
              <Users size={16} className="text-rose-600" />
              Membri (12)
            </h3>
            <div className="flex flex-wrap gap-2">
              {/* Pallini avatar fittizi */}
              {[1,2,3,4,5].map(i => (
                <div key={i} className="w-10 h-10 rounded-full bg-[#f5efdf] border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-black text-stone-500 uppercase">
                  U{i}
                </div>
              ))}
              <div className="w-10 h-10 rounded-full bg-stone-100 border-2 border-dashed border-stone-300 flex items-center justify-center text-[9px] font-black text-stone-400">
                +7
              </div>
            </div>
          </div>

          {canManage && (
            <div className="bg-stone-900 border border-stone-800 rounded-[2rem] p-6 shadow-xl text-white">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-rose-400 mb-4 flex items-center gap-2">
                <Settings size={16} />
                Gestione Admin
              </h3>
              <p className="text-[9px] font-bold text-stone-400 uppercase mb-4 leading-relaxed">
                Come admin di questo gruppo, puoi modificarne i dati o cancellarlo definitivamente.
              </p>
              <button className="w-full bg-white/10 hover:bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider py-3 rounded-xl transition-colors">
                Modifica Laboratorio
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}