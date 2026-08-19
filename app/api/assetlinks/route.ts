// app/api/assetlinks/route.ts
//
// ============================================================================
// IL FILE CHE FA SPARIRE LA BARRA DELL'INDIRIZZO NELL'APP ANDROID.
//
// Un'app Android costruita come "Trusted Web Activity" (TWA) mostra il sito
// dentro una finestra Chrome senza nessuna decorazione: niente barra
// dell'indirizzo, niente pulsanti del browser, niente barra nera di
// WebIntoApp. Sembra e si comporta come un'app normale.
//
// Ma Chrome non nasconde la barra dell'indirizzo a chiunque: prima verifica
// che l'app che la sta chiedendo appartenga davvero al proprietario del sito.
// Lo fa scaricando questo file da:
//
//     https://<il-tuo-dominio>/.well-known/assetlinks.json
//
// e confrontando l'impronta digitale scritta qui dentro con quella della
// chiave usata per firmare l'app. Se non corrispondono, l'app funziona lo
// stesso ma con la barra dell'indirizzo in cima: esattamente il difetto che
// vogliamo evitare.
//
// PERCHÉ UNA ROUTE E NON UN FILE STATICO
// L'impronta esiste solo dopo che hai creato la chiave di firma, e cambia se
// pubblichi su Google Play (che rifirma l'app con una chiave sua). Servendola
// da qui, la si aggiorna cambiando una variabile d'ambiente su Vercel, senza
// toccare il codice e senza ripubblicare il sito a mano.
//
// COSA DEVI IMPOSTARE SU VERCEL
//   ANDROID_PACKAGE_NAME   es. com.relove.app   (il nome scelto per l'app)
//   ANDROID_CERT_SHA256    l'impronta SHA-256 della chiave, nella forma
//                          AA:BB:CC:...  (59 caratteri, maiuscole e due punti)
//
// Se ne servono due (la tua chiave locale E quella di Google Play), separale
// con una virgola: le mettiamo entrambe.
// ============================================================================

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NOME_PACCHETTO_PREDEFINITO = 'com.relove.app'

export async function GET() {
  const pacchetto = process.env.ANDROID_PACKAGE_NAME || NOME_PACCHETTO_PREDEFINITO
  const impronte = (process.env.ANDROID_CERT_SHA256 || '')
    .split(',')
    .map(v => v.trim().toUpperCase())
    .filter(Boolean)

  if (impronte.length === 0) {
    // Meglio dirlo chiaramente che servire un file vuoto: se manca l'impronta
    // la TWA mostra la barra dell'indirizzo, e senza questo messaggio si
    // passerebbe un pomeriggio a chiedersi perché.
    return NextResponse.json(
      {
        errore: 'ANDROID_CERT_SHA256 non è configurata.',
        comeSi: "Impostala fra le variabili d'ambiente del sito con l'impronta SHA-256 della chiave di firma dell'app, poi ripubblica.",
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const collegamenti = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: pacchetto,
        sha256_cert_fingerprints: impronte,
      },
    },
  ]

  return new NextResponse(JSON.stringify(collegamenti, null, 2), {
    status: 200,
    headers: {
      // Chrome pretende esattamente questo tipo: con "text/plain" la verifica
      // fallisce in silenzio e la barra dell'indirizzo resta.
      'Content-Type': 'application/json',
      // Un'ora: abbastanza da non pesare, poco da poter correggere in fretta
      // se l'impronta risultasse sbagliata al primo tentativo.
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
