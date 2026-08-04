// app/api/generate-description/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { title, condition, category } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Il titolo è obbligatorio' }, { status: 400 });
    }

    // Usiamo la chiave API segreta dal tuo file .env.local
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'Manca la chiave API di Gemini nel file .env.local' }, { status: 500 });
    }

    // Chiamata REALE ai server di Google Gemini 1.5 Flash
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Sei un esperto di copywriting per marketplace (tipo Vinted o Subito). 
            Scrivi una descrizione accattivante, onesta e persuasiva per questo oggetto in vendita:
            Titolo annuncio: ${title}
            Condizione: ${condition}
            Categoria: ${category}
            
            Regole: Usa un tono amichevole. Non superare le 4-5 righe. Non inventare prezzi. Usa 2-3 emoji adatte.`
          }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    // FIX: Gemini può rispondere con zero candidates (es. prompt bloccato dai
    // filtri di sicurezza su un titolo particolare) invece che con un errore
    // esplicito. Senza questo controllo, l'indicizzazione diretta lanciava
    // un'eccezione generica che finiva nel messaggio d'errore fisso qui sotto,
    // nascondendo la vera causa nei log e dando all'utente un "riprova" senza
    // che riprovare cambiasse nulla.
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      const blockReason = data.promptFeedback?.blockReason;
      console.error('Gemini: nessun testo generato', { blockReason, data });
      return NextResponse.json(
        { error: blockReason ? 'Descrizione non generabile per questo annuncio, prova a riformulare il titolo.' : 'Errore durante la generazione della descrizione.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ description: generatedText });

  } catch (error: any) {
    console.error("Errore IA:", error);
    return NextResponse.json({ error: 'Errore durante la generazione della descrizione.' }, { status: 500 });
  }
}