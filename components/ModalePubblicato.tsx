'use client'

import Link from 'next/link'
import BottoneCondividi from './BottoneCondividi'
import { fotoQuadrata } from '@/lib/immagini'

// ============================================================================
// "FATTO — ADESSO FALLO VEDERE A QUALCUNO"
//
// Compare subito dopo aver pubblicato: un annuncio, una voce in Vetrina, un
// link esterno. Prima al loro posto c'era solo un messaggio a scomparsa
// ("Annuncio pubblicato!") che spariva dopo due secondi, e la possibilità di
// condividere restava nascosta da qualche altra parte - o non c'era proprio,
// come per le voci in Vetrina.
//
// Il momento subito dopo la pubblicazione è l'unico in cui una persona ha in
// mano la cosa appena fatta e voglia di mostrarla. Chiedere lì è diverso dal
// chiederlo tre schermate dopo.
//
// Il link condiviso porta SEMPRE a una pagina di Re-love, anche per i link
// esterni: chi lo riceve arriva sul sito e vede l'articolo nel suo contesto,
// con chi lo consiglia. Mandare direttamente al negozio regalerebbe la visita
// a qualcun altro.
// ============================================================================

interface Props {
  aperto: boolean
  /** Titolo di cosa è stato pubblicato. */
  titolo: string
  /** Indirizzo interno da condividere, es. /announcement/123 */
  percorso: string
  /** Testo che accompagna la condivisione. */
  testo?: string
  immagine?: string | null
  /** Riga sotto al titolo: "Annuncio pubblicato", "Aggiunto in Vetrina"... */
  etichetta: string
  /** Cosa fa il pulsante scuro: di solito aprire quel che si è pubblicato. */
  vaiA?: { href: string; testo: string }
  onChiudi: () => void
}

export default function ModalePubblicato({
  aperto, titolo, percorso, testo, immagine, etichetta, vaiA, onChiudi,
}: Props) {
  if (!aperto) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-stone-900/70"
      onClick={onChiudi}
    >
      <div
        className="bg-white rounded-[2rem] w-full max-w-sm p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-4xl block mb-3">🎉</span>
        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
          {etichetta}
        </p>
        <h2 className="text-base font-black uppercase text-stone-900 leading-tight mb-5 line-clamp-2">
          {titolo}
        </h2>

        {immagine && (
          <img
            src={fotoQuadrata(immagine, 320).src}
            srcSet={fotoQuadrata(immagine, 320).srcSet}
            alt={titolo}
            loading="lazy"
            decoding="async"
            className="w-28 h-28 object-cover rounded-2xl border border-stone-200 mx-auto mb-5"
          />
        )}

        <p className="text-[11px] font-bold text-stone-500 leading-relaxed mb-5">
          Adesso falla vedere: chi apre il link arriva direttamente qui.
        </p>

        <BottoneCondividi
          percorso={percorso}
          titolo={titolo}
          testo={testo || titolo}
          className="w-full bg-rose-600 text-white p-4 rounded-xl text-xs hover:bg-rose-700"
        />

        <div className="flex gap-2 mt-3">
          {vaiA && (
            <Link
              href={vaiA.href}
              className="flex-1 bg-stone-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-800 transition-colors"
            >
              {vaiA.testo}
            </Link>
          )}
          <button
            onClick={onChiudi}
            className={`${vaiA ? 'px-5' : 'flex-1'} bg-stone-100 text-stone-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-colors`}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
