'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Sparkles, ExternalLink } from 'lucide-react'
import { srcFoto, srcSetFoto, fotoQuadrata } from '@/lib/immagini'

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
      console.error('Errore tracciamento click:', err)
    }
  }

  if (!loading && gruppi.length === 0) return null

  return (
    <section className="mb-12 max-w-[1300px] mx-auto px-2">
      {/* FIX: questo titolo, come "Vetrina Top Nuovo" e "Tutti gli Annunci"
          in page.tsx, era scritto senza nessuno sfondo dietro - sopra
          l'illustrazione fissa del sito il testo si sovrapponeva a quello
          disegnato nell'immagine, rendendo entrambi illeggibili. Le singole
          card sotto (bg-white) erano già protette; mancava solo questo
          titolo. */}
      <div className="flex items-center justify-between mb-6 bg-white rounded-2xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Sparkles size={16} className="text-rose-500" />
          <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900">Vetrine della Community</h2>
        </div>
        {/* NOTA: /vetrina è ora SOLO la propria vetrina. Le vetrine degli
            altri utenti si aprono dai riquadri qui sotto, ognuna sulla
            propria pagina - non esiste più un elenco unico di tutte. */}
        <Link href="/vetrina" className="text-[10px] font-black uppercase text-rose-500 hover:text-stone-900 tracking-widest transition-colors">
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
            /* ================================================================
               TUTTA LA SCHEDA E' TOCCABILE (segnalato: "il tocco sul riquadro
               laterale vetrina assente, fai in modo che ci sia tocco anche
               intorno al riquadro").

               Prima erano toccabili solo tre cose: la riga col nome, le
               singole foto, e la scritta in fondo. Tutto il resto - il bordo
               interno da 20px, gli spazi fra le foto, l'area sotto il nome -
               non reagiva: il dito toccava la scheda e non succedeva niente.
               Su un telefono, dove si tocca "verso" una scheda e non un punto
               preciso, sembrava semplicemente rotta.

               Ora c'e' uno strato invisibile che copre l'intera scheda e porta
               alla vetrina di quella persona. Le singole foto stanno SOPRA
               quello strato e continuano ad avere la precedenza, cosi' chi
               centra una foto apre quell'oggetto e chi tocca a lato apre
               comunque la vetrina. Il contenitore delle foto lascia passare il
               tocco negli spazi vuoti fra una foto e l'altra.
               ================================================================ */
            <div key={gruppo.userId} className="shrink-0 w-64 bg-white rounded-[2rem] border border-stone-200 shadow-sm p-5 flex flex-col relative hover:border-rose-200 transition-colors">
              <Link
                href={`/vetrina/utente/${gruppo.userId}`}
                aria-label={`Apri la vetrina di ${gruppo.nome}`}
                className="absolute inset-0 rounded-[2rem] z-0"
              />

              {/* Nome e avatar: non serve piu' che siano un link a se', ci
                  pensa lo strato qui sopra. "pointer-events-none" li toglie
                  di mezzo cosi' il tocco arriva allo strato. */}
              <div className="flex items-center gap-3 mb-4 pointer-events-none">
                <div className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm uppercase shrink-0">
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
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer sponsored' : undefined}
                    onClick={() => item.external && handleClickEsterno(item.itemId)}
                    className="block bg-stone-50 rounded-xl overflow-hidden border border-stone-100 hover:border-rose-300 transition-all relative z-10 pointer-events-auto"
                  >
                    <div className="aspect-square bg-stone-100 relative">
                      <img src={fotoQuadrata(item.image, 200).src || '/usato.png'} srcSet={fotoQuadrata(item.image, 200).srcSet} className="w-full h-full object-cover" alt={item.title} loading="lazy" decoding="async" />
                      {item.external && (
                        <div className="absolute top-1 right-1 bg-blue-600 text-white rounded-full p-1 shadow-sm">
                          <ExternalLink size={8} />
                        </div>
                      )}
                    </div>
                    <div className="px-1.5 py-1">
                      <p className="text-[9px] font-black text-rose-600 truncate">€ {Number(item.price).toFixed(2)}</p>
                    </div>
                  </a>
                ))}
              </div>

              <span className="mt-auto block text-center text-[9px] font-black uppercase text-stone-400 tracking-widest pointer-events-none">
                Vedi tutta la vetrina →
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
