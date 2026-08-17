'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'
import { toast } from 'sonner'

// ============================================================================
// TASTO CONDIVIDI
//
// Un solo componente per tutti i punti in cui si condivide qualcosa: gli
// annunci e le due Vetrine (interna ed esterna).
//
// Come si comporta:
//  - Su telefono usa il pannello di condivisione del sistema operativo
//    (WhatsApp, Telegram, Instagram, Messaggi...), quello a cui la gente e'
//    abituata.
//  - Su computer, dove quel pannello non esiste, copia il link negli appunti
//    e lo dice.
//  - Se anche gli appunti non sono disponibili (succede nei browser dentro
//    le app e in navigazione privata), mostra il link da copiare a mano
//    invece di non fare niente.
//
// NOTA sul link condiviso: per la Vetrina esterna NON si condivide
// l'indirizzo del negozio, ma la pagina Vetrina di Re-love. Cosi' chi apre
// il link arriva sul sito e vede l'articolo nel suo contesto - ed e' anche
// il motivo per cui la Vetrina esiste.
// ============================================================================

interface Props {
  /** Percorso interno da condividere, es. "/announcement/123". */
  percorso: string
  /** Titolo mostrato nel pannello di condivisione del telefono. */
  titolo: string
  /** Riga di accompagnamento (prezzo, categoria...). */
  testo?: string
  /** "pieno" = pulsante con etichetta; "icona" = solo l'icona tonda. */
  aspetto?: 'pieno' | 'icona'
  className?: string
}

export default function BottoneCondividi({ percorso, titolo, testo, aspetto = 'pieno', className = '' }: Props) {
  const [copiato, setCopiato] = useState(false)

  async function condividi(e: React.MouseEvent) {
    // Serve su schede e riquadri cliccabili: senza, il tocco aprirebbe anche
    // l'annuncio sotto al pulsante.
    e.preventDefault()
    e.stopPropagation()

    // L'indirizzo va costruito qui e non a monte: durante il rendering sul
    // server "window" non esiste, e un link con dominio sbagliato (o con
    // localhost) e' peggio che nessun link.
    const url = `${window.location.origin}${percorso}`

    // 1. Pannello di condivisione del sistema (telefoni)
    if (navigator.share) {
      try {
        await navigator.share({ title: titolo, text: testo || titolo, url })
        return
      } catch (err) {
        // L'utente ha chiuso il pannello senza scegliere: non e' un errore,
        // e non va segnalato come tale.
        if ((err as { name?: string })?.name === 'AbortError') return
        // Qualsiasi altro problema: si prosegue con la copia negli appunti.
      }
    }

    // 2. Copia negli appunti (computer)
    try {
      await navigator.clipboard.writeText(url)
      setCopiato(true)
      toast.success('Link copiato! Ora puoi incollarlo dove vuoi.')
      setTimeout(() => setCopiato(false), 2000)
      return
    } catch {
      // 3. Ultimo rimedio: mostrarlo, cosi' almeno si copia a mano.
      window.prompt('Copia il link da condividere:', url)
    }
  }

  if (aspetto === 'icona') {
    return (
      <button
        onClick={condividi}
        title="Condividi"
        aria-label={`Condividi ${titolo}`}
        className={`w-9 h-9 flex items-center justify-center bg-white/90 text-stone-600 rounded-full shadow-sm hover:text-rose-600 hover:scale-110 transition-all ${className}`}
      >
        {copiato ? <Check size={15} className="text-emerald-600" /> : <Share2 size={15} />}
      </button>
    )
  }

  return (
    <button
      onClick={condividi}
      aria-label={`Condividi ${titolo}`}
      className={`flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-colors ${className}`}
    >
      {copiato ? <Check size={16} /> : <Share2 size={16} />}
      {copiato ? 'Link copiato' : 'Condividi'}
    </button>
  )
}
