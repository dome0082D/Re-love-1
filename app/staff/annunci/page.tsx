'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { azioneStaff } from '@/lib/staffClient'
import { useRouter } from 'next/navigation'

export default function StaffAnnunciPage() {
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const router = useRouter()
  const ADMIN_EMAIL = 'dome0082@gmail.com'

  useEffect(() => {
    checkAdminAndFetch()
  }, [])

  // FIX: mancava del tutto la verifica che chi apre questa pagina sia
  // davvero dello staff - a differenza di app/staff/page.tsx, che invece la
  // fa correttamente. Chiunque conoscesse l'indirizzo vedeva l'intero
  // pannello di moderazione, pulsante "Elimina" compreso, su ogni annuncio
  // della piattaforma - anche se poi il vero eliminare falliva per le
  // regole del database, la pagina non doveva comunque essere visibile.
  async function checkAdminAndFetch() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) {
      router.push('/')
      return
    }
    fetchAnnouncements()
  }

  async function fetchAnnouncements() {
    setLoading(true)
    setLoadError(false)
    // Recupera tutti gli annunci ignorando i filtri normali
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    // FIX: prima un errore di caricamento veniva ignorato in silenzio - la
    // tabella mostrava "Nessun annuncio trovato", identico a come appare
    // quando davvero non ce ne sono, inducendo in errore chi la guarda.
    if (error) {
      console.error('Errore caricamento annunci:', error)
      setLoadError(true)
    } else if (data) {
      setAnnouncements(data)
    }
    setLoading(false)
  }

  // FIX: la cancellazione avveniva dal browser con la chiave anonima. Oggi
  // funziona solo per un difetto della configurazione del database (che
  // permette a QUALSIASI utente autenticato di cancellare gli annunci
  // altrui); appena quel buco viene chiuso - come deve - smetterebbe di
  // funzionare senza dare errore, cancellando zero righe e dicendo comunque
  // "Annuncio eliminato". Ora passa dalla route di moderazione, che verifica
  // lo staff e riferisce quante righe ha davvero rimosso.
  async function handleDelete(id: string) {
    if (!window.confirm('Sei sicuro di voler eliminare definitivamente questo annuncio?')) return;

    const { ok, errore } = await azioneStaff({ azione: 'elimina-annuncio', announcementId: id })
    if (!ok) {
      alert(errore || "Errore durante l'eliminazione.")
      return
    }
    setAnnouncements(announcements.filter(a => a.id !== id))
    alert('Annuncio eliminato.')
  }

  return (
    <div className="min-h-screen p-6 md:p-10 pt-20">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Moderazione Annunci</h1>
        <p className="text-stone-500 font-bold uppercase tracking-widest text-[10px] mb-8">Pannello di controllo Staff</p>
        
        {loading ? (
          <p className="text-stone-400 font-bold uppercase">Caricamento annunci...</p>
        ) : loadError ? (
          <div className="bg-white rounded-3xl border border-red-200 p-10 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-[10px] font-bold text-stone-500 uppercase mb-6">Controlla la connessione e riprova.</p>
            <button onClick={fetchAnnouncements} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-5 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 text-[10px] uppercase tracking-widest text-stone-500">
                    <th className="p-4 font-bold">Immagine</th>
                    <th className="p-4 font-bold">Titolo</th>
                    <th className="p-4 font-bold">Prezzo</th>
                    <th className="p-4 font-bold">Categoria</th>
                    <th className="p-4 font-bold text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((item) => (
                    <tr key={item.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="p-4">
                        <img src={item.image_url || '/usato.png'} alt="img" className="w-12 h-12 rounded-lg object-cover" />
                      </td>
                      <td className="p-4 text-xs font-bold text-stone-800">{item.title}</td>
                      <td className="p-4 text-xs font-black text-rose-500">€ {item.price}</td>
                      <td className="p-4 text-[10px] font-bold text-stone-500 uppercase">{item.category || 'N/D'}</td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-100 text-red-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))}
                  {announcements.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-stone-400 text-xs font-bold uppercase">Nessun annuncio trovato</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
