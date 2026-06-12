'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { Calendar as CalendarIcon, Users, Plus, Hammer, ChefHat, Wrench, Package, Clock, MapPin, ChevronRight, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

export default function LaboratoriPage() {
  const [user, setUser] = useState<User | null>(null)
  const [activeTab, setActiveTab] = useState('bacheca')
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Stati per la creazione
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Riuso')

  // Dati temporanei per far funzionare subito la grafica (verranno sostituiti dal vero DB)
  const [workshops, setWorkshops] = useState([
    { id: '1', title: 'Manutenzione Moto & Scooter', category: 'Motori', members: 12, creator: 'dome0082@gmail.com', nextEvent: 'Oggi, 18:30' },
    { id: '2', title: 'Ottimizzazione Spazi Off-Grid', category: 'Eco-Design', members: 24, creator: 'luca@relove.it', nextEvent: 'Domani, 15:00' },
    { id: '3', title: 'Cucina Sostenibile a km 0', category: 'Cucina', members: 8, creator: 'mario@email.it', nextEvent: 'Sabato, 10:00' }
  ])

  useEffect(() => {
    async function getUser() {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
    }
    getUser()
  }, [])

  const handleCreate = () => {
    if (!user) {
      toast.error("Devi accedere per creare un laboratorio! 🔑")
      return
    }
    if (!newTitle.trim()) {
      toast.error("Inserisci un titolo valido!")
      return
    }
    
    // Simula creazione (poi collegheremo a Supabase)
    const newWorkshop = {
      id: Math.random().toString(),
      title: newTitle,
      category: newCategory,
      members: 1,
      creator: user.email || '',
      nextEvent: 'Nessun evento'
    }
    setWorkshops([newWorkshop, ...workshops])
    setShowCreateModal(false)
    setNewTitle('')
    toast.success("Laboratorio creato! 🎉")
  }

  const getIconForCategory = (category: string) => {
    switch (category) {
      case 'Motori': return <Wrench size={28} className="text-stone-700" />
      case 'Eco-Design': return <Hammer size={28} className="text-stone-700" />
      case 'Cucina': return <ChefHat size={28} className="text-stone-700" />
      default: return <Package size={28} className="text-stone-700" />
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 pb-20">
      
      {/* HEADER HERO-STYLE */}
      <header className="w-full bg-[#f5efdf] border-b border-stone-200 pt-10 pb-8 px-4 md:px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <Link href="/" className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-stone-500 hover:text-stone-900 mb-4 transition-colors">
              <ArrowLeft size={12} /> Torna alla Home
            </Link>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-stone-900 mb-2">
              Laboratori <span className="text-rose-600">&</span> Corsi
            </h1>
            <p className="text-xs md:text-sm font-bold text-stone-600 uppercase tracking-widest max-w-lg">
              Unisciti alla community. Impara, baratta competenze e crea i tuoi gruppi di lavoro.
            </p>
          </div>
          
          <button 
            onClick={() => user ? setShowCreateModal(true) : toast.error("Accedi per fondare un gruppo!")}
            className="bg-stone-900 text-white px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-md flex items-center gap-2 group shrink-0"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            Crea Laboratorio
          </button>
        </div>
      </header>

      {/* MODALE CREAZIONE (appare sopra) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[999] bg-stone-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-md shadow-2xl relative border border-stone-200">
            <h2 className="text-lg font-black uppercase tracking-tight mb-4">Nuovo Laboratorio</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Nome del Gruppo</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold" placeholder="Es. Riparazione Bici" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-stone-500 tracking-widest ml-2 block mb-1">Categoria</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-rose-500 text-sm font-bold uppercase">
                  <option value="Riuso">🛠️ Riuso / Riparazione</option>
                  <option value="Cucina">🍳 Cucina</option>
                  <option value="Motori">🏍️ Motori</option>
                  <option value="Eco-Design">🌱 Eco-Design</option>
                  <option value="Altro">📦 Altro</option>
                </select>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 p-3 rounded-xl bg-stone-100 text-stone-600 text-[11px] font-black uppercase tracking-widest hover:bg-stone-200">Annulla</button>
                <button onClick={handleCreate} className="flex-1 p-3 rounded-xl bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-stone-900 shadow-md">Fonda Gruppo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABS NAVIGAZIONE */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 mt-8">
        <div className="flex gap-6 border-b border-stone-300 pb-4">
          <button onClick={() => setActiveTab('bacheca')} className={`text-[11px] font-black uppercase tracking-widest pb-4 -mb-[17px] transition-all ${activeTab === 'bacheca' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-stone-400 hover:text-stone-900'}`}>Bacheca Gruppi</button>
          <button onClick={() => setActiveTab('calendario')} className={`text-[11px] font-black uppercase tracking-widest pb-4 -mb-[17px] transition-all ${activeTab === 'calendario' ? 'text-rose-600 border-b-2 border-rose-600' : 'text-stone-400 hover:text-stone-900'}`}>Calendario Corsi</button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 md:px-6 mt-8">
        
        {/* VISTA BACHECA */}
        {activeTab === 'bacheca' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workshops.map((workshop) => (
              <Link href={`/laboratori/${workshop.id}`} key={workshop.id} className="bg-white border border-stone-200 rounded-[2rem] p-6 shadow-sm hover:shadow-md hover:border-rose-200 transition-all flex flex-col group cursor-pointer relative overflow-hidden">
                <div className="bg-stone-900 text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full w-max mb-6 tracking-widest shadow-sm">
                  {workshop.category}
                </div>
                <div className="bg-[#f5efdf] w-14 h-14 rounded-2xl flex items-center justify-center border border-stone-200 mb-4 group-hover:scale-110 transition-transform shadow-inner">
                  {getIconForCategory(workshop.category)}
                </div>
                <h3 className="text-[14px] font-black uppercase leading-tight text-stone-900 mb-2 line-clamp-2">
                  {workshop.title}
                </h3>
                <div className="flex items-center gap-2 text-stone-500 text-[10px] font-bold mt-auto pt-6 tracking-widest uppercase">
                  <Users size={14} />
                  <span>{workshop.members} Iscritti</span>
                </div>
                <div className="flex items-center gap-2 text-rose-600 text-[10px] font-bold mt-2 tracking-widest uppercase">
                  <Clock size={14} />
                  <span>Prossimo: {workshop.nextEvent}</span>
                </div>
                <div className="absolute bottom-6 right-6 w-10 h-10 bg-stone-50 rounded-full shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0 transition-all border border-stone-200">
                  <ChevronRight size={18} className="text-rose-600" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* VISTA CALENDARIO */}
        {activeTab === 'calendario' && (
          <div className="bg-white border border-stone-200 rounded-[2.5rem] p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-black uppercase text-stone-900 mb-6 tracking-tight">Appuntamenti Sincronizzati</h2>
            <div className="space-y-4">
              <div className="bg-[#f5efdf] border border-stone-200 rounded-[1.5rem] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-white border border-stone-200 w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm">
                    <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Oggi</span>
                    <span className="text-sm font-black text-stone-900">18:30</span>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-black uppercase text-stone-900">Check ammortizzatori e pressione</h4>
                    <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">Moto & Scooter</p>
                  </div>
                </div>
                <button className="bg-stone-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-600 transition-colors shadow-md">Dettagli</button>
              </div>
              <div className="border-2 border-dashed border-stone-200 rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center gap-2 bg-stone-50">
                <CalendarIcon size={24} className="text-stone-300 mb-2" />
                <h4 className="text-[11px] font-black uppercase text-stone-900 tracking-widest">Il calendario si popolerà</h4>
                <p className="text-[9px] font-bold text-stone-500 uppercase">man mano che i gruppi aggiungeranno eventi.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}