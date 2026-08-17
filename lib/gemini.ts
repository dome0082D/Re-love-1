// lib/gemini.ts
//
// ============================================================================
// PERCHÉ ESISTE
//
// Le due funzioni di intelligenza artificiale del sito (il "Valutatore" nella
// barra in alto e la generazione automatica delle descrizioni degli annunci)
// chiamavano il modello "gemini-1.5-flash", ognuna con la propria copia
// dell'indirizzo e delle impostazioni. Quel modello è stato ritirato da
// Google: con la chiave appena configurata, la risposta è
//
//     404 "models/gemini-1.5-flash is not found for API version v1beta"
//
// Quindi, anche dopo aver messo una chiave valida, entrambe le funzioni
// avrebbero continuato a non funzionare - e l'utente avrebbe letto un
// generico "il servizio non risponde".
//
// Qui il modello e le impostazioni stanno in UN SOLO posto: il giorno in cui
// Google ritira anche questo, si cambia una riga invece di cercare le copie
// sparse nel progetto.
// ============================================================================

/**
 * Modello usato dal sito. Scelto fra quelli davvero disponibili per questa
 * chiave (verificato interrogando l'elenco dei modelli):
 *   - "gemini-2.5-flash" NON è utilizzabile: "no longer available to new users"
 *   - "gemini-flash-latest" risponde correttamente ed è l'alias che Google
 *     tiene aggiornato al modello veloce del momento
 */
// Modelli in ordine di preferenza. Si prova il primo; se risponde "occupato"
// (429 troppe richieste, 503 modello sovraccarico) si passa al successivo.
//
// L'ordine non è arbitrario: misurato con questa chiave, 4 richieste
// consecutive per ciascun modello.
//     gemini-3-flash-preview     4/4 riuscite
//     gemini-flash-latest        1/4 (429: quota del piano gratuito)
//     gemini-flash-lite-latest   0/4 (400)
//     gemini-2.5-flash-lite      0/4 (404: non disponibile per questa chiave)
//
// Senza questa scala, il Valutatore falliva 2 volte su 3 con un generico
// "il servizio non risponde" pur essendo tutto configurato correttamente.
export const MODELLI_GEMINI = ['gemini-3-flash-preview', 'gemini-flash-latest'] as const

/** Modello preferito (il primo della scala). */
export const MODELLO_GEMINI = MODELLI_GEMINI[0]

export interface EsitoGemini {
  testo?: string
  errore?: string
  /** Codice HTTP di Google, utile nei log per capire cosa è andato storto. */
  stato?: number
}

/**
 * Manda un prompt a Gemini e restituisce il testo della risposta.
 * Non lancia mai: gli errori tornano come { errore }.
 */
export async function chiediAGemini(
  prompt: string,
  opzioni: { maxToken?: number; temperatura?: number } = {}
): Promise<EsitoGemini> {
  if (!process.env.GEMINI_API_KEY) {
    return { errore: 'Servizio non configurato.' }
  }

  /** Codici che significano "riprova": il modello è occupato, non è colpa nostra. */
  const daRiprovare = (stato: number) => stato === 429 || stato === 500 || stato === 503

  let ultimoStato = 0

  for (const modello of MODELLI_GEMINI) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: opzioni.temperatura ?? 0.4,
              maxOutputTokens: opzioni.maxToken ?? 300,
              // I modelli recenti consumano parte dei token consentiti per
              // "ragionare" prima di rispondere. Con il limite basso ereditato
              // dal vecchio codice (120 token) la risposta usciva troncata a
              // metà frase - in prova: "90€, sometimes". Per compiti brevi e
              // ben definiti come questi il ragionamento non serve, e
              // disattivarlo lascia tutti i token alla risposta vera.
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: AbortSignal.timeout(20000),
        }
      )

      ultimoStato = res.status
      const dati = await res.json()

      if (!res.ok) {
        console.error(`[Gemini] ${modello} ha risposto ${res.status}:`, dati?.error?.message)
        // Modello occupato o non disponibile: proviamo il prossimo della scala
        // invece di arrendersi subito.
        if (daRiprovare(res.status) || res.status === 404 || res.status === 400) continue
        return { errore: 'Il servizio non risponde. Riprova tra poco.', stato: res.status }
      }

      const testo = dati?.candidates?.[0]?.content?.parts?.[0]?.text
      if (!testo) {
        const motivo = dati?.promptFeedback?.blockReason || dati?.candidates?.[0]?.finishReason
        console.error(`[Gemini] ${modello}: nessun testo restituito (${motivo})`)
        // Un blocco di sicurezza vale per qualsiasi modello: inutile insistere.
        if (dati?.promptFeedback?.blockReason) {
          return { errore: 'Non sono riuscito a elaborare questa richiesta. Prova a descriverla in modo diverso.' }
        }
        continue
      }

      return { testo: String(testo).trim(), stato: res.status }
    } catch (err) {
      console.error(`[Gemini] ${modello}: errore di connessione`, err)
      // anche qui: proviamo il modello successivo
    }
  }

  return {
    errore: ultimoStato === 429
      ? 'Il servizio di intelligenza artificiale ha raggiunto il limite di richieste. Riprova fra qualche minuto.'
      : 'Il servizio non risponde. Riprova tra poco.',
    stato: ultimoStato,
  }
}
