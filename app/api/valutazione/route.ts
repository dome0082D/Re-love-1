import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Stima reale del valore di un oggetto usato, tramite Gemini - la stessa
// intelligenza artificiale già usata per generare le descrizioni degli
// annunci (stessa chiave GEMINI_API_KEY, già configurata sul progetto).
export async function POST(req: NextRequest) {
  try {
    const { itemName, condition } = await req.json()

    if (!itemName || typeof itemName !== 'string' || !itemName.trim()) {
      return NextResponse.json({ error: 'Scrivi il nome di un oggetto da valutare.' }, { status: 400 })
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('Valutazione: GEMINI_API_KEY non configurata.')
      return NextResponse.json({ error: 'Servizio di valutazione non configurato.' }, { status: 500 })
    }

    const prompt = `Sei un esperto del mercato dell'usato in Italia (Subito.it, Vinted, Wallapop). Stima un prezzo di vendita REALISTICO in euro per questo oggetto usato.
Oggetto: "${itemName.trim()}"
Condizione: ${condition && String(condition).trim() ? String(condition).trim() : 'usato, buono stato generico'}

Rispondi SOLO in questo formato, senza markdown e senza altro testo:
€X - €Y | breve motivazione in massimo 15 parole`

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!res.ok) {
      const corpo = await res.text()
      console.error('Errore Gemini (valutazione):', res.status, corpo)
      return NextResponse.json({ error: 'Il servizio di valutazione non risponde. Riprova tra poco.' }, { status: 502 })
    }

    const data = await res.json()
    // FIX (stesso già applicato in generate-description/route.ts): accesso
    // protetto con "?." - se Gemini blocca la richiesta per motivi di
    // sicurezza non restituisce "candidates", e senza questa protezione la
    // route andrebbe in errore invece di spiegare cosa è successo davvero.
    const testo = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!testo) {
      const motivoBlocco = data?.promptFeedback?.blockReason || data?.candidates?.[0]?.finishReason
      console.error('Gemini non ha restituito testo (valutazione):', motivoBlocco)
      return NextResponse.json(
        { error: 'Non sono riuscito a valutare questo oggetto. Prova a descriverlo in modo diverso.' },
        { status: 502 }
      )
    }

    const [fasciaPrezzo, motivazione] = testo.trim().split('|').map((s: string) => s.trim())

    return NextResponse.json({
      priceRange: fasciaPrezzo || testo.trim(),
      reason: motivazione || '',
    })
  } catch (err: any) {
    console.error('Errore route valutazione:', err)
    return NextResponse.json({ error: 'Errore di connessione. Riprova.' }, { status: 500 })
  }
}