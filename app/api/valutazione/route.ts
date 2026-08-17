// app/api/valutazione/route.ts
//
// Stima reale del valore di un oggetto usato, usata dal pulsante
// "Valutatore" nella barra in alto.
//
// FIX: chiamava "gemini-1.5-flash", modello ritirato da Google: anche con la
// chiave configurata rispondeva 404, e l'utente vedeva "il servizio non
// risponde". Inoltre il limite di 120 token veniva consumato dal
// ragionamento interno dei modelli recenti, tagliando la risposta a metà
// (in prova: "90€, sometimes"). Entrambe le cose sono ora gestite in
// lib/gemini.ts, condiviso con la generazione delle descrizioni.

import { NextRequest, NextResponse } from 'next/server'
import { chiediAGemini } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { itemName, condition } = await req.json()

    if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
      return NextResponse.json({ error: 'Scrivi il nome di un oggetto da valutare.' }, { status: 400 })
    }

    const prompt = `Sei un esperto del mercato dell'usato in Italia (Subito.it, Vinted, Wallapop). Stima un prezzo di vendita REALISTICO in euro per questo oggetto usato.
Oggetto: "${itemName.trim()}"
Condizione: ${condition && String(condition).trim() ? String(condition).trim() : 'usato, buono stato generico'}

Rispondi SOLO in questo formato, senza markdown e senza altro testo:
€X - €Y | breve motivazione in massimo 15 parole`

    // 200 token non bastavano: in prova la risposta usciva tagliata a meta'
    // numero ("€100 - €13"). Il margine costa pochissimo e toglie il problema.
    const { testo, errore } = await chiediAGemini(prompt, { maxToken: 500, temperatura: 0.4 })

    if (errore || !testo) {
      return NextResponse.json(
        { error: errore || 'Non sono riuscito a valutare questo oggetto. Prova a descriverlo in modo diverso.' },
        { status: 502 }
      )
    }

    const [fasciaPrezzo, motivazione] = testo.split('|').map(s => s.trim())

    return NextResponse.json({
      priceRange: fasciaPrezzo || testo,
      reason: motivazione || '',
    })
  } catch (err) {
    console.error('Errore route valutazione:', err)
    return NextResponse.json({ error: 'Errore di connessione. Riprova.' }, { status: 500 })
  }
}
