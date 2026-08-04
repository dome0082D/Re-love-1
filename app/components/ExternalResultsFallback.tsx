'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'

interface AffiliateProduct {
  title: string
  price: number
  currency: string
  imageUrl: string
  affiliateUrl: string
  platform: 'Amazon' | 'eBay' | 'AliExpress'
}

const PLATFORM_COLORS: Record<string, string> = {
  Amazon: 'bg-orange-100 text-orange-700',
  eBay: 'bg-blue-100 text-blue-700',
  AliExpress: 'bg-red-100 text-red-700',
}

// ZERO-STATE MONETIZATION: mostrato quando la ricerca su Re-love non produce
// risultati. Interroga /api/search, che a sua volta prova prima il catalogo
// interno e poi i partner esterni (Amazon, eBay, AliExpress) solo se serve.
export default function ExternalResultsFallback({ query }: { query: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [products, setProducts] = useState<AffiliateProduct[]>([])

  useEffect(() => {
    if (!query.trim()) return

    // Piccolo debounce: aspettiamo che l'utente smetta di scrivere prima di
    // interrogare tre API esterne - evita di chiamarle ad ogni lettera digitata.
    const timeout = setTimeout(async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Errore ricerca')
        setProducts(data.products || [])
      } catch (err) {
        console.error('Ricerca esterna fallita:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }, 500)

    return () => clearTimeout(timeout)
  }, [query])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-stone-400">
        <Loader2 className="animate-spin mb-3" size={28} />
        <p className="text-xs font-bold uppercase tracking-widest">Cerco tra i partner...</p>
      </div>
    )
  }

  if (error || products.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-bold text-stone-400">Nessun risultato, nemmeno tra i partner esterni.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 px-1">
        <span className="bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
          Non c'è su Re-love, ma lo trovi sui siti partner
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {products.map((p, i) => (
          <a
            key={i}
            href={p.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="group bg-white rounded-2xl border-2 border-dashed border-stone-200 hover:border-rose-300 overflow-hidden transition-all shadow-sm hover:shadow-md"
          >
            <div className="relative aspect-square bg-stone-50">
              {p.imageUrl && (
                <img src={p.imageUrl} alt={p.title} className="w-full h-full object-contain p-2" loading="lazy" decoding="async" />
              )}
              <span className={`absolute top-2 left-2 text-[9px] font-black uppercase px-2 py-1 rounded ${PLATFORM_COLORS[p.platform] || 'bg-stone-100 text-stone-700'}`}>
                {p.platform}
              </span>
            </div>
            <div className="p-3">
              <p className="text-xs font-bold text-stone-800 line-clamp-2 mb-1">{p.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-stone-900">
                  {p.price > 0 ? `${p.currency === 'EUR' ? '€' : p.currency + ' '}${p.price.toFixed(2)}` : ''}
                </span>
                <ExternalLink size={14} className="text-stone-400 group-hover:text-rose-500 transition-colors" />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Disclosure: in Italia (Codice del Consumo) e nella maggior parte dei
          paesi UE i link di affiliazione vanno segnalati chiaramente come tali.
          Non toglierla senza aver verificato la normativa con un legale. */}
      <p className="text-center text-[9px] font-bold uppercase text-stone-300 tracking-widest mt-6">
        Link esterni a siti partner — Re-love può ricevere una commissione
      </p>
    </div>
  )
}
