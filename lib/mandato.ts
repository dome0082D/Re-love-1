// lib/mandato.ts
//
// ============================================================================
// IL CODICE DI UNA DELEGA, IN TUTTE LE FORME IN CUI PUÒ ARRIVARE.
//
// Prima esisteva una sola forma valida: il token nudo. Il QR conteneva
// "RELOVE_MANDATE:<token>", che NON è un indirizzo web: inquadrandolo con la
// fotocamera normale del telefono non si apriva niente, e non c'era nessun
// link da mandare al Proprietario via messaggio. Chi provava a incollare il
// contenuto del QR, o un link, nel campo "codice" della pagina di
// approvazione si vedeva rispondere "Codice QR non riconosciuto" - il
// problema segnalato.
//
// Adesso il QR contiene un vero link (apribile da qualsiasi fotocamera, e
// inviabile su WhatsApp), e QUALSIASI forma viene riconosciuta:
//
//   1. link           https://re-love.../curatore/scansiona?codice=<token>
//   2. contenuto QR   RELOVE_MANDATE:<token>        (i QR già in giro)
//   3. codice nudo    9f1c...-...                   (digitato a mano)
//   4. testo incollato "Ciao, ecco il link: https://..."  (copia-incolla da chat)
//
// Il riconoscimento sta qui, in un punto solo, perché serve identico in tre
// posti: la pagina che legge il QR, la pagina che mostra il link al Curatore
// e - soprattutto - le route sul server, che normalizzano di nuovo per conto
// proprio invece di fidarsi di quello che manda il browser.
// ============================================================================

/** Prefisso dei QR della prima versione. Continuiamo a leggerlo: i mandati
 *  creati prima di questa modifica hanno ancora QR fatti così. */
export const PREFISSO_QR = 'RELOVE_MANDATE:'

/** Percorso della pagina dove il Proprietario approva. */
export const PERCORSO_APPROVAZIONE = '/curatore/scansiona'

/** Nome del parametro che porta il codice dentro il link. */
export const PARAMETRO_CODICE = 'codice'

/** I token sono UUID generati con crypto.randomUUID(). */
const FORMATO_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lo stesso, per pescarlo dentro un testo più lungo. */
const TOKEN_NEL_TESTO = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function valida(valore: string | null | undefined): string | null {
  if (!valore) return null
  let t = valore.trim()
  // Un codice copiato da una chat può arrivare con la punteggiatura attaccata.
  t = t.replace(/^[<"'(\[]+/, '').replace(/[>"')\].,;!?]+$/, '')
  try { t = decodeURIComponent(t) } catch { /* già in chiaro */ }
  t = t.trim()
  if (!t || t === 'undefined' || t === 'null') return null
  return FORMATO_TOKEN.test(t) ? t : null
}

/** Estrae il codice da un indirizzo web di approvazione. */
function dalLink(indirizzo: string): string | null {
  let u: URL
  try { u = new URL(indirizzo) } catch { return null }

  const daParametro = valida(
    u.searchParams.get(PARAMETRO_CODICE) ||
    u.searchParams.get('code') ||
    u.searchParams.get('token')
  )
  if (daParametro) return daParametro

  // Ripiego: link della forma .../delega/<token>
  const ultimoPezzo = u.pathname.split('/').filter(Boolean).pop()
  return valida(ultimoPezzo)
}

/**
 * Riconosce il codice di una delega in qualsiasi forma.
 *
 * @param permissivo  Se true (campo "incolla il codice"), cerca il codice
 *                    anche dentro un testo più lungo - tipicamente un
 *                    messaggio copiato per intero da una chat. Se false
 *                    (lettura dal vivo con la fotocamera), accetta solo un
 *                    contenuto che sia davvero un QR di Re-love: così
 *                    inquadrare per sbaglio un QR qualsiasi non interrompe
 *                    la scansione.
 */
export function estraiTokenMandato(contenuto: string, permissivo = false): string | null {
  const testo = (contenuto || '').trim()
  if (!testo) return null

  if (testo.startsWith(PREFISSO_QR)) return valida(testo.slice(PREFISSO_QR.length))

  if (/^https?:\/\//i.test(testo)) return dalLink(testo)

  const soloCodice = valida(testo)
  if (soloCodice) return soloCodice

  if (!permissivo) return null

  // Testo lungo: prima cerchiamo un link dentro, poi un codice sciolto.
  const link = testo.match(/https?:\/\/\S+/i)
  if (link) {
    const daDentro = dalLink(link[0].replace(/[>"')\].,;!?]+$/, ''))
    if (daDentro) return daDentro
  }
  const sparso = testo.match(TOKEN_NEL_TESTO)
  return sparso ? valida(sparso[0]) : null
}

/**
 * Costruisce il link di approvazione da mostrare al Curatore e da mettere
 * dentro il QR.
 *
 * @param origine  Base dell'indirizzo. Sul browser si passa
 *                 window.location.origin, sul server NEXT_PUBLIC_SITE_URL.
 */
export function linkApprovazione(token: string, origine: string): string {
  const base = (origine || '').replace(/\/+$/, '')
  return `${base}${PERCORSO_APPROVAZIONE}?${PARAMETRO_CODICE}=${encodeURIComponent(token)}`
}

/**
 * Impostazioni condivise da tutti i QR di delega del sito.
 *
 * Correzione d'errore alta e margine ampio perché questi codici vengono quasi
 * sempre inquadrati da un telefono sullo schermo di un altro: la condizione
 * peggiore possibile per una lettura (riflessi, moiré, luminosità bassa).
 */
export const OPZIONI_QR = {
  width: 420,
  margin: 4,
  errorCorrectionLevel: 'H' as const,
  color: { dark: '#000000', light: '#FFFFFF' },
}
