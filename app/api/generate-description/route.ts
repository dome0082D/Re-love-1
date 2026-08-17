// app/api/generate-description/route.ts
//
// FIX: questa route chiamava "gemini-1.5-flash", modello che Google ha
// ritirato. Anche con una chiave valida rispondeva 404 ("is not found for
// API version v1beta"), e l'utente leggeva soltanto "Errore durante la
// generazione della descrizione". La chiamata a Gemini vive ora in
// lib/gemini.ts, in un solo posto, insieme al nome del modello.

import { NextResponse } from 'next/server'
import { chiediAGemini } from '@/lib/gemini'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { title, condition, category } = await req.json()

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'Il titolo è obbligatorio' }, { status: 400 })
    }

    const prompt = `Sei un esperto di copywriting per marketplace (tipo Vinted o Subito).
Scrivi una descrizione accattivante, onesta e persuasiva per questo oggetto in vendita:
Titolo annuncio: ${String(title).trim()}
Condizione: ${condition || 'non specificata'}
Categoria: ${category || 'non specificata'}

Regole: Usa un tono amichevole. Non superare le 4-5 righe. Non inventare prezzi. Usa 2-3 emoji adatte.`

    const { testo, errore } = await chiediAGemini(prompt, { maxToken: 400, temperatura: 0.7 })

    if (errore || !testo) {
      return NextResponse.json(
        { error: errore || 'Errore durante la generazione della descrizione.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ description: testo })
  } catch (error) {
    console.error('Errore IA:', error)
    return NextResponse.json({ error: 'Errore durante la generazione della descrizione.' }, { status: 500 })
  }
}
