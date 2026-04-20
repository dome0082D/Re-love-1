import Link from 'next/link'

export default function ProtezioneAcquistiPage() {
  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-10 font-sans text-stone-900 flex justify-center items-start pt-12">
      <div className="max-w-3xl w-full bg-white rounded-[2.5rem] p-6 md:p-12 border border-stone-200 shadow-xl text-center">
        <span className="text-6xl block mb-6">🛡️</span>
        <h1 className="text-3xl md:text-5xl font-black uppercase italic text-stone-900 mb-4">Protezione Acquisti</h1>
        <p className="text-xs text-stone-400 font-bold uppercase tracking-widest mb-12">Sicurezza garantita con Escrow & Stripe</p>
        
        <div className="space-y-8 text-left">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 bg-stone-50 rounded-3xl">
            <span className="bg-emerald-500 text-white w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg">1</span>
            <div>
              <h3 className="text-lg font-black uppercase italic text-stone-900">Pagamento Protetto</h3>
              <p className="text-xs text-stone-600 font-medium mt-1">I tuoi soldi non vanno subito al venditore. Restano "congelati" nel nostro conto di sicurezza (Escrow).</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 bg-stone-50 rounded-3xl">
            <span className="bg-emerald-500 text-white w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg">2</span>
            <div>
              <h3 className="text-lg font-black uppercase italic text-stone-900">Verifica Materiale</h3>
              <p className="text-xs text-stone-600 font-medium mt-1">Hai tutto il tempo di verificare che l'oggetto sia esattamente come descritto nell'annuncio.</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center p-4 bg-stone-50 rounded-3xl">
            <span className="bg-emerald-500 text-white w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-2xl font-black text-xl shadow-lg">3</span>
            <div>
              <h3 className="text-lg font-black uppercase italic text-stone-900">Sblocco dei Fondi</h3>
              <p className="text-xs text-stone-600 font-medium mt-1">Solo dopo la tua conferma di ricezione, il sistema trasferirà i fondi al venditore.</p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-stone-100">
          <Link href="/" className="inline-block bg-stone-900 text-white font-black uppercase tracking-widest text-[11px] px-8 py-4 rounded-2xl hover:bg-emerald-500 transition-all w-full md:w-auto">
            ← Torna alla Vetrina
          </Link>
        </div>
      </div>
    </div>
  )
}
