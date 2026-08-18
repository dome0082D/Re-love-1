'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { alternaPreferito } from '@/lib/azioniUtente'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Search, Heart } from 'lucide-react'
import ExternalResultsFallback from '../components/ExternalResultsFallback'
import { srcFoto, srcSetFoto, fotoQuadrata } from '@/lib/immagini'

function CercaContent() {
  const searchParams = useSearchParams()
  const query = (searchParams.get('q') || '').trim()

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    init()
  }, [query])

  async function init() {
    const { data: { user: u } } = await supabase.auth.getUser()
    setUser(u)
    if (u) {
      const { data: favs } = await supabase.from('favorites').select('announcement_id').eq('user_id', u.id)
      if (favs) setFavorites(favs.map(f => f.announcement_id))
    }
    fetchResults()
  }

  async function fetchResults() {
    if (!query) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError(false)
    try {
      // La virgola e le parentesi hanno un significato speciale nella
      // sintassi dei filtri di Supabase/PostgREST: se il testo cercato le
      // contiene, romperebbero la query invece di essere cercate come
      // testo. Le togliamo prima di usarle nella ricerca.
      const pulita = query.replace(/[,()]/g, ' ').trim()

      // FIX: prima la ricerca guardava SOLO titolo e descrizione - scrivere
      // il nome esatto di una categoria (es. "Elettronica e Informatica")
      // nella barra di ricerca non trovava mai nulla, anche se esistevano
      // annunci pubblicati proprio con quella categoria, perché il campo
      // "category" non veniva mai controllato. Ora la ricerca guarda anche
      // dentro la categoria, la condizione (Nuovo/Usato/Regalo/Baratto) e
      // la città - così scrivere una parola qualsiasi collegata
      // all'annuncio (non solo il suo titolo) lo fa comunque comparire.
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .or(`title.ilike.%${pulita}%,description.ilike.%${pulita}%,category.ilike.%${pulita}%,condition.ilike.%${pulita}%,city.ilike.%${pulita}%`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setResults(data || [])
    } catch (err) {
      console.error('Errore ricerca:', err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  // Stesso difetto della Home: la RLS rifiutava l'inserimento nei preferiti
  // fatto direttamente dal browser. Ora passa dalla route server.
  async function handleToggleFavorite(e: React.MouseEvent, id: string) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return
    const esito = await alternaPreferito(id)
    if (!esito.ok) return
    setFavorites(prev => esito.preferito
      ? [...prev.filter(f => f !== id), id]
      : prev.filter(f => f !== id))
  }

  return (
    <div className="min-h-screen font-sans text-stone-900 pb-32">
      <div className="w-full py-14 bg-[#f5efdf] border-b border-stone-200 flex items-center justify-center">
        <div className="text-center max-w-2xl px-6">
          <span className="inline-flex items-center gap-2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full mb-4">
            <Search size={12} /> Risultati di ricerca
          </span>
          <h1 className="text-3xl md:text-4xl font-black uppercase italic text-stone-900 tracking-tight">
            {query ? `"${query}"` : 'Nessuna ricerca'}
          </h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-10">
        {!query ? (
          <div className="bg-white border-2 border-dashed border-stone-200 rounded-[2rem] p-16 text-center">
            <Search size={48} className="text-stone-300 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-sm font-black uppercase text-stone-400">Scrivi qualcosa da cercare</p>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-[2rem] p-4 shadow-sm border border-stone-200 animate-pulse h-56">
                <div className="w-full h-28 bg-stone-200 rounded-2xl mb-4"></div>
                <div className="w-3/4 h-4 bg-stone-200 rounded mb-2"></div>
                <div className="w-1/2 h-6 bg-stone-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bg-white border border-red-200 rounded-[2rem] p-16 text-center">
            <p className="text-sm font-black uppercase text-red-500 mb-2">Errore di caricamento</p>
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-6">Controlla la connessione e riprova.</p>
            <button onClick={fetchResults} className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-rose-600 transition-all">
              Riprova
            </button>
          </div>
        ) : results.length === 0 ? (
          <>
            <div className="bg-white border-2 border-dashed border-stone-200 rounded-[3rem] p-16 text-center">
              <span className="text-6xl block mb-4">🔍</span>
              <h3 className="text-xl font-black uppercase text-stone-900 mb-2">Nessun risultato</h3>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Prova con parole diverse o più generiche.</p>
            </div>
            {/* NUOVO: quando su Re-love non c'è nulla, proponiamo i partner
                esterni - stesso componente già usato altrove nel sito, riusato
                qui invece di riscriverne una copia. */}
            <div className="mt-10">
              <ExternalResultsFallback query={query} />
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-6">
              {results.length} {results.length === 1 ? 'annuncio trovato' : 'annunci trovati'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {results.map(item => (
                <Link key={item.id} href={`/announcement/${item.id}`} className="group bg-white rounded-[2rem] overflow-hidden shadow-sm border border-stone-200 hover:shadow-md transition-all flex flex-col relative">
                  <div className="aspect-square bg-stone-100 relative">
                    {user && (
                      <button onClick={(e) => handleToggleFavorite(e, item.id)} className="absolute top-2 right-2 z-10 bg-white w-8 h-8 flex items-center justify-center rounded-full shadow-sm hover:scale-110 transition-all">
                        <Heart size={16} className={favorites.includes(item.id) ? 'fill-rose-500 text-rose-500' : 'text-stone-400'} />
                      </button>
                    )}
                    <img src={fotoQuadrata(item.image_url, 400).src || '/usato.png'} srcSet={fotoQuadrata(item.image_url, 400).srcSet} className="w-full h-full object-cover" alt={item.title} loading="lazy" decoding="async" />
                  </div>
                  <div className="p-3">
                    <h4 className="text-[10px] font-black uppercase line-clamp-2 text-stone-800 leading-tight mb-1">{item.title}</h4>
                    <p className="text-[14px] font-black text-rose-600 italic">
                      {item.condition === 'Regalo' || item.condition === 'Baratto' ? 'GRATIS' : `€ ${item.price}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CercaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center font-bold uppercase tracking-widest text-stone-400 text-xs">Ricerca in corso...</div>}>
      <CercaContent />
    </Suspense>
  )
}
