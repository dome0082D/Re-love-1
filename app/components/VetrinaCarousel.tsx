'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Sparkles, ExternalLink } from 'lucide-react'

interface VoceVetrina {
  userId: string
  title: string
  price: number
  image: string
  href: string
  external: boolean
  itemId?: string // solo per i link esterni, serve per contare i click
}

export default function VetrinaCarousel() {
  const [gruppi, setGruppi] = useState<{ userId: string; nome: string; items: VoceVetrina[] }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVetrina()
  }, [])

  async function fetchVetrina() {
    setLoading(true)
    try {
      const [{ data: interna }, { data: esterna }] = await Promise.all([
        supabase.from('vetrina_items').select('*, announcements(*)').eq('type', 'interna').eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('vetrina_items').select('*').eq('type', 'esterna').eq('is_active', true).order('created_at', { ascending: false }),
      ])

      const tutti: VoceVetrina[] = [
        ...(interna || [])
          .filter((i: any) => i.announcements)
          .map((i: any) => ({
            userId: i.user_id,
            title: i.announcements.title,
            price: i.announcements.price,
            image: i.announcements.image_url,
            href: `/announcement/${i.announcements.id}`,
            external: false,
          })),
        ...(esterna || []).map((i: any) => ({
          userId: i.user_id,
          title: i.title,
          price: i.price,
          image: i.image_url,
          href: i.external_url,
          external: true,
          itemId: i.id,
        })),
      ]

      if (tutti.length === 0) {
        setGruppi([])
        return
      }

      // Una sola richiesta per i nomi di TUTTI i venditori coinvolti, non
      // una per ciascuno - importante qui perché il carosello può mostrare
      // decine di venditori diversi in una volta sola.
      const idVenditori = Array.from(new Set(tutti.map(t => t.userId)))
      const { data: profili } = await supabase.from('profiles').select('id, first_name').in('id', idVenditori)
      const mappaNomi: Record<string, string> = {}
      ;(profili || []).forEach((p: any) => { mappaNomi[p.id] = p.first_name || 'Utente' })

      const mappaGruppi: Record<string, VoceVetrina[]> = {}
      tutti.forEach(item => {
        if (!mappaGruppi[item.userId]) mappaGruppi[item.userId] = []
        mappaGruppi[item.userId].push(item)
      })

      const risultato = Object.entries(mappaGruppi).map(([userId, items]) => ({
        userId,
        nome: mappaNomi[userId] || 'Utente',
        // Al massimo 4 oggetti per riquadro, il resto si vede aprendo la
        // vetrina completa di quel venditore.
        items: items.slice(0, 4),
      }))

      setGruppi(risultato)
    } catch (err) {
      console.error('Errore caricamento carosello vetrine:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleClickEsterno(itemId?: string) {
    if (!itemId) return
    try {
      await supabase.rpc('increment_vetrina_click', { item_id: itemId })
    } catch (err) {
      // Non blocchiamo mai l'apertura del link per un errore nel solo
      // conteggio dei click - stessa scelta già fatta dentro /vetrina.
      console.error('Errore tracciamento click:', err)
    }
  }

  // Niente da mostrare: la sezione semplicemente non compare, invece di
  // lasciare un riquadro vuoto sulla Home.
  if (!loading && gruppi.length === 0) return null

  return (
    <section className="mb-12 max-w-[1300px] mx-auto px-2">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-rose-500" />
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900">Vetrine della Community</h2>
        </div>
        <Link href="/vetrina" className="text-[10px] font-black uppercase text-rose-500 hover:text-stone-900 tracking-widest transition-colors">
          Vedi Tutte →
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-5 overflow-x-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-64 h-72 bg-white rounded-[2rem] border border-stone-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-3 custom-scrollbar">
          {gruppi.map(gruppo => (
            <div key={gruppo.userId} className="shrink-0 w-64 bg-white rounded-[2rem] border border-stone-200 shadow-sm p-5 flex flex-col">
              <Link href={`/vetrina?venditore=${gruppo.userId}`} className="flex items-center gap-3 mb-4 group">
                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm uppercase shrink-0">
                  {gruppo.nome[0]}
                </div>
                <span className="text-[11px] font-black uppercase text-stone-800 truncate group-hover:text-rose-600 transition-colors">
                  {gruppo.nome}
                </span>
              </Link>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {gruppo.items.map((item, i) => (
                  <a
                    key={i}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer sponsored' : undefined}
                    onClick={() => item.external && handleClickEsterno(item.itemId)}
                    className="block bg-stone-50 rounded-xl overflow-hidden border border-stone-100 hover:border-rose-300 transition-all relative"
                  >
                    <div className="aspect-square bg-stone-100 relative">
                      <img src={item.image || '/usato.png'} className="w-full h-full object-cover" alt={item.title} loading="lazy" decoding="async" />
                      {item.external && (
                        <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm">
                          <ExternalLink size={8} />
                        </div>
                      )}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className="text-[9px] font-black text-rose-600 truncate">€ {Number(item.price).toFixed(0)}</p>
                    </div>
                  </a>
                ))}
              </div>

              <Link href={`/vetrina?venditore=${gruppo.userId}`} className="mt-auto block text-center text-[9px] font-black uppercase text-stone-400 hover:text-rose-500 tracking-widest transition-colors">
                Vedi tutta la vetrina →
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
