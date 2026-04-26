'use client'

import Link from 'next/link'

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-20 font-sans text-stone-900">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="text-center mb-16">
          <span className="bg-rose-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 inline-block shadow-lg shadow-rose-200">
            Re-love Manifesto
          </span>
          <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-none mb-6">
            Come <span className="text-rose-500 font-black">Funziona</span>
          </h1>
          <p className="text-sm md:text-base font-medium text-stone-500 italic max-w-2xl mx-auto leading-relaxed">
            Non è solo un marketplace, è un nuovo modo di vivere gli oggetti. 
            Su Re-love puoi vendere, regalare o scambiare ciò che ami con persone che lo ameranno quanto te.
          </p>
        </div>

        {/* LE 3 QUALITÀ CHIAVE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          
          {/* VENDI & REGALA */}
          <div className="bg-white p-8 rounded-[3rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all group">
            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform inline-block">✨</div>
            <h3 className="text-lg font-black uppercase italic mb-3">Second-hand Pro</h3>
            <p className="text-xs text-stone-500 font-medium leading-relaxed">
              Carica i tuoi capi d'abbigliamento, accessori o oggetti di design in meno di 60 secondi. Scegli se vendere al miglior prezzo o regalare per fare spazio al nuovo.
            </p>
          </div>

          {/* SCAMBIA / BARATTO */}
          <div className="bg-stone-900 p-8 rounded-[3rem] shadow-2xl text-white transform md:-translate-y-4">
            <div className="text-4xl mb-6 animate-pulse">🔄</div>
            <h3 className="text-lg font-black uppercase italic mb-3 text-rose-500">Baratto Etico</h3>
            <p className="text-xs text-stone-300 font-medium leading-relaxed">
              Il cuore di Re-love. Non serve denaro per avere stile: proponi uno scambio alla pari e trova tesori incredibili senza svuotare il portafoglio.
            </p>
          </div>

          {/* SICUREZZA */}
          <div className="bg-white p-8 rounded-[3rem] border border-stone-200 shadow-sm hover:shadow-xl transition-all group">
            <div className="text-4xl mb-6 group-hover:scale-110 transition-transform inline-block">🛡️</div>
            <h3 className="text-lg font-black uppercase italic mb-3">Zero Rischi</h3>
            <p className="text-xs text-stone-500 font-medium leading-relaxed">
              Pagamenti protetti con Stripe, chat criptata per gli accordi e spedizioni tracciabili. Su Re-love la tua fiducia è la nostra priorità numero uno.
            </p>
          </div>
        </div>

        {/* STEP-BY-STEP */}
        <div className="bg-white rounded-[4rem] p-10 md:p-16 border border-stone-100 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 text-8xl font-black italic">RE-LOVE</div>
          
          <h2 className="text-2xl font-black uppercase italic mb-10 border-b border-stone-100 pb-6">La tua guida rapida</h2>
          
          <div className="space-y-12">
            {[
              { n: "01", t: "Trova il colpo di fulmine", d: "Sfoglia la Home o usa i filtri per scovare oggetti unici e sostenibili." },
              { n: "02", t: "Chatta e Accordati", d: "Usa la nostra chat sicura per chiedere info o proporre uno scambio." },
              { n: "03", t: "Concludi l'affare", d: "Paga in sicurezza o conferma lo scambio. Al resto pensiamo noi." }
            ].map((step, i) => (
              <div key={i} className="flex gap-6 items-start">
                <span className="text-4xl font-black text-rose-500 italic opacity-40">{step.n}</span>
                <div>
                  <h4 className="text-base font-black uppercase italic">{step.t}</h4>
                  <p className="text-xs text-stone-500 font-medium mt-1">{step.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 flex flex-col md:flex-row gap-4">
            <Link href="/" className="flex-1 bg-stone-900 text-white text-center py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-500 transition-all shadow-xl">
              Torna alla Home
            </Link>
            <Link href="/upload" className="flex-1 border-2 border-stone-900 text-stone-900 text-center py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-stone-900 hover:text-white transition-all">
              Inizia a vendere
            </Link>
          </div>
        </div>

        {/* FOOTER MESSAGGIO */}
        <p className="text-center mt-12 text-[10px] font-black uppercase text-stone-400 tracking-[0.3em]">
          Re-love © 2024 • Sostenibilità con Stile
        </p>

      </div>
    </div>
  )
}