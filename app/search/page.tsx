'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // Parametri URL
  const query = searchParams.get('q') || ''
  const categoryParams = searchParams.get('cat') || ''
  const conditionParams = searchParams.get('cond') || ''

  // Stati locali per i filtri
  const [searchTerm, setSearchTerm] = useState(query)
  const [selectedCat, setSelectedCat] = useState(categoryParams)
  const [selectedCond, setSelectedCond] = useState(conditionParams)
  
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const categorieFisse = [
    { id: '', name: 'Tutte le categorie' },
    { id: '1', name: '👕 Abbigliamento e Accessori' },
    { id: '2', name: '💻 Elettronica e Informatica' },
    { id: '3', name: '🛋️ Casa, Arredo, Giardino' },
    { id: '4', name: '🍎 Alimentari e Bevande' },
    { id: '5', name: '📚 Libri, Film e Musica' },
    { id: '6', name: '💄 Salute e Bellezza' },
    { id: '7', name: '⚽ Sport e Tempo Libero' },
    { id: '8', name: '🚗 Motori e Veicoli' },
    { id: '9', name: '📦 Altro / Varie' }
  ]

  const condizioniFisse = [
    { id: '', name: 'Tutte le modalità' },
    { id: 'Nuovo', name: 'Solo Nuovo' },
    { id: 'Usato', name: 'Solo Usato' },
    { id: 'Regalo', name: 'Solo Regalo' },
    { id: 'Baratto', name: 'Solo Baratto' }
  ]

  useEffect(() => {
    fetchResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryParams, conditionParams])

  async function fetchResults() {
    setLoading(true)
    
    let dbQuery = supabase.from('announcements').select('*').order('created_at', { ascending: false })

    // Applica i filtri solo se esistono
    if (query) {
      dbQuery = dbQuery.ilike('title', `%${query}%`) // Cerca parole simili nel titolo
    }
    if (categoryParams) {
      dbQuery = dbQuery.eq('category_id', categoryParams)
    }
    if (conditionParams) {
      dbQuery = dbQuery.eq('condition', conditionParams)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.error("Errore ricerca:", error)
    } else if (data) {
      // Escludi gli annunci con quantità 0 (tranne per il baratto/regalo che potrebbero non usare la quantità)
      const filteredData = data.filter(item => item.quantity > 0 || item.condition === 'Baratto' || item.condition === 'Regalo')
      setResults(filteredData)
    }
    setLoading(false)
  }

  // Aggiorna l'URL quando l'utente preme "Cerca"
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (searchTerm) params.set('q', searchTerm)
    if (selectedCat) params.set('cat', selectedCat)
    if (selectedCond) params.set('cond', selectedCond)
    
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER DI RICERCA */}
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-200 mb-10">
          <h1 className="text-2xl md:text-3xl font-black uppercase italic text-stone-900 mb-6 text-center">
            Esplora Re-love
          </h1>
          
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="Cosa stai cercando? (es. iPhone, Scarpe...)" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-grow p-4 bg-stone-50 rounded-xl border border-stone-200 outline-none focus:border-rose-400 text-sm font-bold text-stone-800"
            />
            
            <select 
              value={selectedCat} 
              onChange={(e) => setSelectedCat(e.target.value)}
              className="p-4 bg-stone-50 rounded-xl border border-stone-200 outline-none focus:border-rose-400 text-sm font-bold text-stone-800 md:w-64"
            >
              {categorieFisse.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>

            <select 
              value={selectedCond} 
              onChange={(e) => setSelectedCond(e.target.value)}
              className="p-4 bg-stone-50 rounded-xl border border-stone-200 outline-none focus:border-rose-400 text-sm font-bold text-stone-800 md:w-48"
            >
              {condizioniFisse.map(cond => <option key={cond.id} value={cond.id}>{cond.name}</option>)}
            </select>

            <button type="submit" className="bg-stone-900 text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500 transition-colors shadow-md">
              Cerca
            </button>
          </form>
        </div>

        {/* RISULTATI DELLA RICERCA */}
        <div>
          <h2 className="text-[10px] font-black uppercase text-stone-400 tracking-[0.2em] mb-6 ml-2">
            {loading ? 'Ricerca in corso...' : `${results.length} Risultati Trovati`}
          </h2>

          {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
               {[1,2,3].map(n => <div key={n} className="bg-stone-200 h-64 rounded-3xl"></div>)}
             </div>
          ) : results.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[3rem] border border-stone-100 shadow-sm">
              <span className="text-6xl mb-4 block">🏜️</span>
              <h3 className="text-xl font-black uppercase italic text-stone-900">Nessun annuncio trovato</h3>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-2">Prova a cambiare i filtri di ricerca</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {results.map((annuncio) => (
                <Link href={`/announcement/${annuncio.id}`} key={annuncio.id} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-stone-100 flex flex-col">
                  <div className="relative h-48 w-full overflow-hidden bg-stone-100">
                    <img 
                      src={annuncio.image_url} 
                      alt={annuncio.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-4 left-4">
                      <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-lg shadow-md text-white tracking-widest
                        ${annuncio.condition === 'Nuovo' ? 'bg-rose-500' : 
                          annuncio.condition === 'Usato' ? 'bg-orange-400' : 
                          annuncio.condition === 'Baratto' ? 'bg-blue-500' : 'bg-rose-400'}`}>
                        {annuncio.condition}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="text-lg font-black uppercase italic text-stone-900 line-clamp-1">{annuncio.title}</h3>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1 mb-4 line-clamp-2">
                      📍 {annuncio.city} ({annuncio.region})
                    </p>
                    
                    <div className="mt-auto pt-4 border-t border-stone-50 flex justify-between items-center">
                      {annuncio.condition === 'Baratto' ? (
                        <span className="text-sm font-black text-blue-500 uppercase italic">Scambio</span>
                      ) : annuncio.condition === 'Regalo' ? (
                        <span className="text-sm font-black text-rose-500 uppercase italic">Gratis</span>
                      ) : (
                        <span className="text-lg font-black text-stone-900">€{annuncio.price.toFixed(2)}</span>
                      )}
                      
                      <span className="text-xl group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex justify-center items-center font-black uppercase text-[10px] text-stone-400 tracking-widest">Inizializzazione Ricerca...</div>}>
      <SearchContent />
    </Suspense>
  )
}