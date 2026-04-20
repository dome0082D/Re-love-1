import Link from 'next/link'

export default function ProtezioneAcquistiPage() {
  return (
    <div className="min-h-screen bg-stone-50 p-6 font-sans text-stone-900 flex justify-center items-start pt-12 pb-20">
      <div className="max-w-3xl w-full bg-white rounded-3xl p-10 border border-stone-200 shadow-sm">
        
        <div className="text-center mb-10 border-b border-stone-100 pb-8">
          <span className="text-5xl block mb-4">🛡️</span>
          <h1 className="text-3xl font-black uppercase italic text-stone-900 mb-2">Protezione Acquisti</h1>
          <p className="text-sm text-stone-500 font-medium">I tuoi soldi sono al sicuro, dall'inizio alla fine.</p>
        </div>

        <div className="space-y-8">
          <div className="flex gap-4 items-start">
            <span className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl text-xl">1</span>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-stone-900 mb-1">Pagamento Sicuro</h3>
              <p className="text-sm text-stone-600 leading-relaxed">Quando acquisti un materiale, i tuoi soldi non vanno subito al venditore. Vengono trattenuti in un conto di sicurezza (Escrow) gestito da Stripe, leader mondiale per i pagamenti online.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <span className="bg-blue-100 text-blue-600 p-3 rounded-2xl text-xl">2</span>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-stone-900 mb-1">Consegna e Verifica</h3>
              <p className="text-sm text-stone-600 leading-relaxed">Hai tutto il tempo di incontrare il venditore, ritirare l'oggetto e verificare che sia esattamente come descritto nell'annuncio.</p>
            </div>
          </div>

          <div className="flex gap-4 items-start">
            <span className="bg-stone-100 text-stone-600 p-3 rounded-2xl text-xl">3</span>
            <div>
              <h3 className="text-lg font-black uppercase tracking-widest text-stone-900 mb-1">Sblocco dei Fondi</h3>
              <p className="text-sm text-stone-600 leading-relaxed">Solo quando tu, tramite la tua area personale, confermi di aver ricevuto l'oggetto e che è tutto ok, noi trasferiamo il denaro al venditore. Nessuna truffa, nessuna sorpresa.</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-stone-100 text-center">
          <Link href="/" className="inline-block bg-stone-900 text-white font-black uppercase tracking-widest text-[11px] px-8 py-4 rounded-xl hover:bg-stone-800 transition-colors shadow-sm">
            ← Torna alla Vetrina
          </Link>
        </div>

      </div>
    </div>
  )
}
