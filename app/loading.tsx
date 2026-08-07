// Next.js mostra automaticamente questo file durante il caricamento di una
// pagina, al posto della schermata bianca o dello spinner generico.
// Non serve importarlo da nessuna parte: basta che si chiami "loading.tsx"
// e stia dentro app/.
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#f5efdf]">
      <p
        className="text-6xl md:text-7xl text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-400 select-none animate-pulse"
        style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive", fontWeight: 700 }}
      >
        Re-love
      </p>
      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">
        Riusa · Scambia · Regala
      </p>
    </div>
  )
}
