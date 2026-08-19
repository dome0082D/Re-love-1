'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Sparkles, ExternalLink } from 'lucide-react'
import { fotoQuadrata } from '@/lib/immagini'

// ============================================================================
// LE VETRINE DELLA COMMUNITY IN HOME, DIVISE PER TIPO.
//
// Prima era una fascia sola: ogni scheda mescolava gli annunci Re-love di
// quella persona e i suoi link a negozi esterni, e portava tutta a una pagina
// mista. Due cose diverse trattate come una: chi cercava roba da comprare su
// Re-love si ritrovava su Amazon, e viceversa.
//
// Adesso il componente rende UNA fascia per volta, scelta con "tipo", e la
// Home lo usa due volte. Ogni scheda porta alla pagina giusta di quella
// persona - /vetrina/utente/<id>/interna oppure /esterna - che esistevano già
// ma da qui non erano raggiungibili.
//
// Le due fasce hanno anche colori e parole diverse, perché un link che porta
// fuori dal sito deve dirlo prima che ci si clicchi sopra, non dopo.
// ============================================================================

interface VoceVetrina {
  userId: string
  title: string
  price: number
  image: string | null
  href: string
  itemId?: string
}

interface Gruppo {
  userId: string
  nome: string
  items: VoceVetrina[]
}

type TipoVetrina = 'interna' | 'esterna'

const ASPETTO: Record<TipoVetrina, {
  titolo: string
  sottotitolo: string
  percorso: (userId: string) => string
  coloreTesto: string
  bordoScheda: string
}> = {
  interna: {
    titolo: 'Vetrine della Community',
    sottotitolo: 'Annunci Re-love',
    percorso: (id) => `/vetrina/utente/${id}/interna`,
    coloreTesto: 'text-rose-600',
    bordoScheda: 'hover:border-rose-200',
  },
  esterna: {
    titolo: 'Consigliati dalla Community',
    sottotitolo: 'Link a negozi esterni',
    percorso: (id) => `/vetrina/utente/${id}/esterna`,
    coloreTesto: 'text-blue-700',
    bordoScheda: 'hover:border-blue-200',
  },
}

export default function VetrinaCarousel({ tipo }: { tipo: TipoVetrina }) {
  const [gruppi, setGruppi] = useState<Gruppo[]>([])
  const [loading, setLoading] = useState(true)
  const aspetto = ASPETTO[tipo]

  useEffect(() => {
    let annullato = false

    async function carica() {
      setLoading(true)
      try {
        // Le due letture sono diverse: gli annunci interni portano con sé i
        // dati dell'annuncio collegato, i link esterni hanno titolo, prezzo e
        // immagine propri (letti dalla pagina del negozio al momento della
        // pubblicazione).
        const query = tipo === 'interna'
          ? supabase.from('vetrina_items').select('*, announcements(*)').eq('type', 'interna')
          : supabase.from('vetrina_items').select('*').eq('type', 'esterna')

        const { data } = await query
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        const voci: VoceVetrina[] = tipo === 'interna'
          ? (data || [])
              // Un annuncio cancellato dopo essere stato messo in vetrina
              // lascia la voce orfana: saltarla evita schede vuote.
              .filter((i: any) => i.announcements)
              .map((i: any) => ({
                userId: i.user_id,
                title: i.announcements.title,
                price: i.announcements.price,
                image: i.announcements.image_url,
                href: `/announcement/${i.announcements.id}`,
              }))
          : (data || []).map((i: any) => ({
              userId: i.user_id,
              title: i.title,
              price: i.price,
              image: i.image_url,
              href: i.external_url,
              itemId: i.id,
            }))

        if (voci.length === 0) {
          if (!annullato) setGruppi([])
          return
        }

        const idVenditori = Array.from(new Set(voci.map(v => v.userId)))
        const { data: profili } = await supabase
          .from('profiles').select('id, first_name, nickname').in('id', idVenditori)

        const nomi: Record<string, string> = {}
        ;(profili || []).forEach((p: any) => {
          nomi[p.id] = p.nickname || p.first_name || 'Utente'
        })

        const perUtente: Record<string, VoceVetrina[]> = {}
        voci.forEach(v => {
          if (!perUtente[v.userId]) perUtente[v.userId] = []
          perUtente[v.userId].push(v)
        })

        const risultato = Object.entries(perUtente).map(([userId, items]) => ({
          userId,
          nome: nomi[userId] || 'Utente',
          items: items.slice(0, 4),
        }))

        if (!annullato) setGruppi(risultato)
      } catch (err) {
        console.error(`Errore caricamento vetrine (${tipo}):`, err)
      } finally {
        if (!annullato) setLoading(false)
      }
    }

    carica()
    return () => { annullato = true }
  }, [tipo])

  async function contaClickEsterno(itemId?: string) {
    if (!itemId) return
    try {
      await supabase.rpc('increment_vetrina_click', { item_id: itemId })
    } catch (err) {
      // Il conteggio è accessorio: non deve mai impedire di aprire il negozio.
      console.error('Errore tracciamento click:', err)
    }
  }

  // Niente riquadro vuoto quando quel tipo di vetrina non ha ancora nulla.
  if (!loading && gruppi.length === 0) return null

  return (
    <section className="mb-10 max-w-[1300px] mx-auto px-2">
      <div className="flex items-center justify-between mb-6 bg-white rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          {tipo === 'interna'
            ? <Sparkles size={16} className="text-rose-500 shrink-0" />
            : <ExternalLink size={16} className="text-blue-600 shrink-0" />}
          <div className="min-w-0">
            <h2 className="text-[13px] font-black uppercase tracking-[0.3em] text-stone-900 truncate">
              {aspetto.titolo}
            </h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
              {aspetto.sottotitolo}
            </p>
          </div>
        </div>
        <Link href="/vetrina" className={`text-[10px] font-black uppercase ${aspetto.coloreTesto} hover:text-stone-900 tracking-widest transition-colors shrink-0`}>
          La mia Vetrina →
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
            /* Tutta la scheda è toccabile grazie allo strato qui sotto: il
               bordo interno e gli spazi fra le foto non restano zone morte.
               Le singole foto stanno sopra quello strato e hanno la
               precedenza, così chi centra una foto apre quella, chi tocca a
               lato apre comunque la vetrina della persona. */
            <div
              key={gruppo.userId}
              className={`shrink-0 w-64 bg-white rounded-[2rem] border border-stone-200 shadow-sm p-5 flex flex-col relative transition-colors ${aspetto.bordoScheda}`}
            >
              <Link
                href={aspetto.percorso(gruppo.userId)}
                aria-label={`Apri la vetrina di ${gruppo.nome}`}
                className="strato-tocco absolute inset-0 rounded-[2rem] z-0"
              />

              <div className="flex items-center gap-3 mb-4 pointer-events-none">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm uppercase shrink-0 ${
                  tipo === 'interna' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-700'
                }`}>
                  {gruppo.nome[0]}
                </div>
                <span className="text-[11px] font-black uppercase text-stone-800 truncate">
                  {gruppo.nome}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 pointer-events-none">
                {gruppo.items.map((item, i) => (
                  <a
                    key={i}
                    href={item.href}
                    target={tipo === 'esterna' ? '_blank' : undefined}
                    rel={tipo === 'esterna' ? 'noopener noreferrer sponsored' : undefined}
                    onClick={() => tipo === 'esterna' && contaClickEsterno(item.itemId)}
                    className="block bg-stone-50 rounded-xl overflow-hidden border border-stone-100 hover:border-rose-300 transition-all relative z-10 pointer-events-auto"
                  >
                    <div className="aspect-square bg-stone-100 relative">
                      <img
                        src={fotoQuadrata(item.image, 200).src || '/usato.png'}
                        srcSet={fotoQuadrata(item.image, 200).srcSet}
                        className="w-full h-full object-cover"
                        alt={item.title}
                        loading="lazy"
                        decoding="async"
                      />
                      {tipo === 'esterna' && (
                        <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm">
                          <ExternalLink size={8} />
                        </div>
                      )}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className={`text-[9px] font-black truncate ${aspetto.coloreTesto}`}>
                        € {Number(item.price).toFixed(2)}
                      </p>
                    </div>
                  </a>
                ))}
              </div>

              <span className="mt-auto block text-center text-[9px] font-black uppercase text-stone-400 tracking-widest pointer-events-none">
                {tipo === 'interna' ? 'Vedi i suoi annunci →' : 'Vedi i suoi consigli →'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
