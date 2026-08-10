'use client'

interface Props {
  url: string | null
  onClose: () => void
}

// Modale condivisa, usata sia da app/vetrina/page.tsx sia da
// components/VetrinaCarousel.tsx - un solo posto da mantenere invece di
// due copie della stessa cosa.
export default function ExternalLinkConfirmModal({ url, onClose }: Props) {
  if (!url) return null

  let dominio = url
  try {
    dominio = new URL(url).hostname.replace('www.', '')
  } catch {
    // URL non valido per qualche motivo - mostriamo il link intero invece
    // di far crashare la modale.
  }

  function handleContinua() {
    window.open(url as string, '_blank', 'noopener,noreferrer')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full p-8 text-center animate-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl mb-4">🔗</div>
        <h2 className="text-lg font-black uppercase italic text-stone-900 mb-2">Stai per lasciare Re-love</h2>
        <p className="text-xs font-bold text-stone-500 mb-1">Questo oggetto è ospitato su un sito esterno:</p>
        <p className="text-sm font-black text-blue-600 mb-6 break-all">{dominio}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={handleContinua}
            className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-600 transition-all"
          >
            Continua su {dominio}
          </button>
          <button
            onClick={onClose}
            className="w-full text-stone-400 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-stone-100 transition-all"
          >
            Resta su Re-love
          </button>
        </div>
      </div>
    </div>
  )
}
