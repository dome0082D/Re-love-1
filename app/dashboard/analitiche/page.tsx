'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [stats, setStats] = useState({
    activeListings: 0,
    totalValue: 0,
    potentialEarnings: 0,
    barters: 0,
    gifts: 0,
    totalViews: 0 // <-- NUOVO: STATO PER LE VISUALIZZAZIONI
  })
  const router = useRouter()

  useEffect(() => {
    fetchStats()
  }, [router])

  async function fetchStats() {
    setLoading(true)
    setLoadError(false)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      // FIX: mancava lo spegnimento del caricamento prima di uscire dalla
      // funzione - chi non era loggato restava a fissare "Elaborazione
      // Dati..." per tutto il tempo del reindirizzamento, invece di vederlo
      // sparire subito. È lo stesso dettaglio già corretto nella pagina
      // delle controversie.
      setLoading(false)
      router.push('/login')
      return
    }

    // FIX: aggiunto try/catch attorno a tutto - senza, un fallimento di rete
    // (Android instabile) durante una qualsiasi delle due chiamate lasciava
    // la pagina bloccata per sempre su "Elaborazione Dati...", perché
    // l'eccezione non gestita impediva di raggiungere il setLoading(false)
    // finale. In più, né la lettura degli annunci né quella delle
    // visualizzazioni controllavano l'errore: un caricamento fallito
    // mostrava "0 Annunci Attivi, €0.00", identico a come appare per un
    // venditore che genuinamente non ha ancora pubblicato nulla - ora c'è
    // uno stato d'errore distinto dai dati vuoti.
    try {
      // 1. Recuperiamo tutti gli annunci dell'utente
      const { data: ads, error: adsError } = await supabase
        .from('announcements')
        .select('id, price, quantity, condition')
        .eq('user_id', user.id)

      if (adsError) throw adsError

      if (ads && ads.length > 0) {
        let value = 0;
        let bCount = 0;
        let gCount = 0;
        
        // Estraiamo gli ID degli annunci per cercare le loro visualizzazioni
        const adIds = ads.map(ad => ad.id);

        ads.forEach(ad => {
          value += (Number(ad.price) * Number(ad.quantity));
          if (ad.condition === 'Baratto') bCount++;
          if (ad.condition === 'Regalo') gCount++;
        });

        // 2. Recuperiamo il numero totale di visualizzazioni (Traffico)
        // FIX: prima venivano contate ANCHE le visite del venditore ai propri
        // annunci. Ogni volta che aprivi un tuo annuncio per controllarlo, la
        // pagina registrava una visualizzazione: bastava riaprirlo venti
        // volte per vedersi scrivere "20 visite" e credere che ci fosse
        // interesse, quando eri solo tu. Ora escludiamo le tue visite,
        // continuando però a contare quelle anonime (chi guarda senza essere
        // loggato, che sono la maggioranza e vanno assolutamente contate).
        const { count: viewCount, error: viewsError } = await supabase
          .from('page_views')
          .select('*', { count: 'exact', head: true })
          .in('announcement_id', adIds)
          .or(`viewer_id.is.null,viewer_id.neq.${user.id}`);

        if (viewsError) throw viewsError

        setStats({
          activeListings: ads.length,
          totalValue: value,
          potentialEarnings: value * 0.90, // Togliamo il 10% di commissione
          barters: bCount,
          gifts: gCount,
          totalViews: viewCount || 0
        });
      } else {
        // FIX: se non ci sono annunci, prima non veniva aggiornato NULLA -
        // quindi chi cancellava tutti i propri annunci e ricaricava questa
        // pagina continuava a vedere i vecchi numeri (valore magazzino,
        // visite) come se gli annunci ci fossero ancora.
        setStats({
          activeListings: 0,
          totalValue: 0,
          potentialEarnings: 0,
          barters: 0,
          gifts: 0,
          totalViews: 0
        });
      }
    } catch (err) {
      console.error('Errore caricamento statistiche:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center font-black uppercase tracking-widest text-xs text-stone-400">Elaborazione Dati...</div>

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      
      <div className="w-full py-16 bg-stone-50 border-b border-stone-100 flex items-center justify-center">
         <div className="text-center max-w-2xl px-6">
            <h1 className="text-4xl font-black uppercase italic text-stone-900 tracking-tighter mb-2">Seller Hub</h1>
            <p className="text-stone-400 font-bold text-[10px] uppercase tracking-[0.3em]">Le performance del tuo negozio Re-love</p>
         </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-12">

        {loadError && (
          <div className="bg-red-50 border border-red-200 rounded-[2rem] p-6 mb-10 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-4">I dati mostrati sotto potrebbero non essere aggiornati. Controlla la connessione e riprova.</p>
            <button onClick={fetchStats} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4">Valore Magazzino</p>
            <h2 className="text-4xl font-black text-stone-900">€ {stats.totalValue.toFixed(2)}</h2>
            <p className="text-xs font-bold text-emerald-500 mt-2">Stimato: € {stats.potentialEarnings.toFixed(2)} netti</p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-stone-200 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4">Annunci Attivi</p>
            <h2 className="text-4xl font-black text-stone-900">{stats.activeListings}</h2>
            <p className="text-xs font-bold text-stone-500 mt-2 flex gap-4">
              <span>🤝 {stats.barters} Baratti</span>
              <span>🎁 {stats.gifts} Regali</span>
            </p>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden bg-gradient-to-br from-white to-emerald-50">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">📈</div>
            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-4">Traffico Totale</p>
            <h2 className="text-4xl font-black text-stone-900">{stats.totalViews}</h2>
            <p className="text-[10px] font-bold text-emerald-500 uppercase mt-2 tracking-widest">Visite agli annunci</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-rose-50 p-8 rounded-[2.5rem] border border-rose-100 flex flex-col justify-center items-center text-center group hover:bg-rose-100 transition-colors">
            <span className="text-4xl mb-4 group-hover:scale-110 transition-transform">⚖️</span>
            <h3 className="text-xl font-black uppercase text-stone-900 mb-2">Centro Controversie</h3>
            <p className="text-xs font-medium text-stone-600 mb-6">Gestisci i rimborsi, i resi e i problemi con gli acquirenti in totale sicurezza.</p>
            
            {/* BOTTONE ORA ATTIVO CHE PORTA AL TRIBUNALE */}
            <Link href="/dashboard/controversie" className="bg-rose-500 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-stone-900 transition-all">
              Entra nel Tribunale
            </Link>
          </div>

          <div className="bg-blue-50 p-8 rounded-[2.5rem] border border-blue-100 flex flex-col justify-center items-center text-center group hover:bg-blue-100 transition-colors">
            <span className="text-4xl mb-4 group-hover:scale-110 transition-transform">📦</span>
            <h3 className="text-xl font-black uppercase text-stone-900 mb-2">Etichette Spedizione</h3>
            <p className="text-xs font-medium text-stone-600 mb-6">Genera e stampa automaticamente le lettere di vettura per i tuoi pacchi.</p>
            {/* FIX: questo pulsante non aveva nessun onClick - un tap non
                faceva letteralmente nulla, senza nemmeno un messaggio che
                spiegasse perché. Non esiste da nessuna parte in questo
                progetto una pagina o funzione per configurare corrieri o
                generare etichette, quindi non ho inventato una destinazione
                falsa: ho aggiunto un avviso onesto che dice che la
                funzionalità non è ancora disponibile, invece di lasciare
                che sembri rotto. Quando costruirai davvero questa
                funzionalità, sostituisci l'onClick con la destinazione vera. */}
            <button
              onClick={() => toast('🚧 Funzionalità in arrivo! La configurazione corrieri non è ancora disponibile.')}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-stone-900 transition-all"
            >
              Configura Corriere
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
