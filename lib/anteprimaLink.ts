// lib/anteprimaLink.ts
//
// Lettura dei dati reali di una pagina prodotto esterna (Amazon, eBay,
// qualsiasi negozio): titolo, descrizione, immagine e PREZZO.
//
// Vive in lib/ e non dentro una singola route perché serve in due punti che
// devono per forza dare lo stesso risultato:
//   - app/api/vetrina/preview  -> mostra l'anteprima a chi sta pubblicando
//   - app/api/stripe/vetrina   -> ricontrolla il prezzo prima di salvarlo
// Se le due logiche fossero due copie, il secondo controllo perderebbe senso
// alla prima modifica fatta solo da una parte.

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Secondo tentativo con l'identità di un telefono: Amazon e molti altri
// negozi servono ai dispositivi mobili una pagina più leggera, che spesso
// contiene i dati strutturati con il prezzo anche quando la versione
// desktop risponde con una pagina anti-bot priva di tutto.
const USER_AGENT_MOBILE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

export interface Anteprima {
  title: string | null
  description: string | null
  image: string | null
  // NUOVO: il prezzo non viene più chiesto a mano a chi pubblica - va letto
  // dalla pagina del prodotto insieme a titolo, descrizione e immagine.
  price: number | null
  currency: string | null
  // NUOVO: anche le spese di spedizione vengono importate dal link.
  // - un numero  = costo letto dalla pagina (0 = spedizione gratuita)
  // - null       = la pagina non lo dichiara in modo leggibile
  shipping: number | null
}

// Frasi con cui i negozi dichiarano la spedizione gratuita. Riconoscerle
// vale quanto leggere un numero: "Consegna GRATIS" è un costo di 0, non un
// dato mancante.
const SEGNALI_SPEDIZIONE_GRATIS = [
  'consegna gratis',
  'consegna gratuita',
  'spedizione gratis',
  'spedizione gratuita',
  'free delivery',
  'free shipping',
  'livraison gratuite',
  'envío gratis',
  'kostenlose lieferung',
]

/**
 * Spese di spedizione dichiarate nei dati strutturati JSON-LD
 * (offers.shippingDetails.shippingRate.value secondo schema.org).
 */
function spedizioneDaJsonLd(html: string): number | null {
  const blocchi = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const blocco of blocchi) {
    let dati: unknown
    try {
      dati = JSON.parse(blocco[1].trim())
    } catch {
      continue
    }

    // La struttura è annidata e cambia da sito a sito: invece di inseguire
    // ogni variante, cerchiamo ricorsivamente la prima "shippingRate" con
    // un valore numerico.
    const cerca = (v: unknown, profondita = 0): number | null => {
      if (!v || typeof v !== 'object' || profondita > 8) return null
      if (Array.isArray(v)) {
        for (const el of v) {
          const trovato = cerca(el, profondita + 1)
          if (trovato !== null) return trovato
        }
        return null
      }
      const nodo = v as Record<string, unknown>
      const tariffa = nodo.shippingRate
      if (tariffa && typeof tariffa === 'object') {
        const t = tariffa as Record<string, unknown>
        const valore = t.value ?? t.minValue
        if (valore !== undefined && valore !== null) {
          const numero = typeof valore === 'number' ? valore : normalizzaPrezzo(String(valore))
          // Qui lo zero è un risultato valido (spedizione gratuita), quindi
          // non si può usare il solito "if (numero)" che scarterebbe 0.
          if (numero !== null && numero >= 0) return Math.round(numero * 100) / 100
          if (typeof valore === 'number' && valore === 0) return 0
        }
      }
      for (const chiave of Object.keys(nodo)) {
        const trovato = cerca(nodo[chiave], profondita + 1)
        if (trovato !== null) return trovato
      }
      return null
    }

    const trovato = cerca(dati)
    if (trovato !== null) return trovato
  }
  return null
}

/**
 * Spese di spedizione lette dal testo della pagina.
 *
 * Cerca solo dentro i blocchi che parlano di consegna: una ricerca libera
 * su tutta la pagina prenderebbe il primo importo che capita (lo stesso
 * errore che sul prezzo faceva pubblicare 8,99€ al posto di 11,98€).
 */
function spedizioneDaHtml(html: string): number | null {
  const contenitori = [
    // Amazon: blocchi consegna del riquadro d'acquisto
    /id=["']deliveryBlockMessage["'][\s\S]{0,600}/i,
    /id=["']mir-layout-DELIVERY_BLOCK["'][\s\S]{0,900}/i,
    /id=["']price-shipping-message["'][\s\S]{0,400}/i,
    /id=["']desktop_qualifiedBuyBox["'][\s\S]{0,1500}/i,
    // Generici
    /class=["'][^"']*shipping[^"']*["'][\s\S]{0,400}/i,
    /class=["'][^"']*delivery[^"']*["'][\s\S]{0,400}/i,
  ]

  for (const pattern of contenitori) {
    const match = html.match(pattern)
    if (!match) continue

    const testo = match[0].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').toLowerCase()

    if (SEGNALI_SPEDIZIONE_GRATIS.some(s => testo.includes(s))) return 0

    // "Spedizione: 4,99 €" / "consegna a 3,50€"
    const importo = testo.match(/(?:spedizion\w*|consegn\w*|shipping|delivery)[^0-9€$£]{0,25}([0-9]+[.,][0-9]{2})\s*(?:€|eur|\$|£)?/)
    if (importo) {
      const numero = normalizzaPrezzo(importo[1])
      if (numero !== null && numero >= 0) return numero
    }
  }

  return null
}

function estraiSpedizione(html: string): number | null {
  const daJson = spedizioneDaJsonLd(html)
  if (daJson !== null) return daJson
  return spedizioneDaHtml(html)
}

// ---------------------------------------------------------------------------
// LETTURA DEL PREZZO
//
// I siti scrivono il prezzo in formati molto diversi ("€ 1.234,56",
// "$1,234.56", "29.99", "2999" nei dati strutturati...). Queste funzioni
// provano le fonti in ordine di affidabilità e normalizzano sempre il
// risultato in un numero con il punto come separatore decimale.
// ---------------------------------------------------------------------------

/**
 * Converte in numero un prezzo scritto in un formato qualsiasi.
 * La regola: se compaiono sia "." sia ",", quello PIÙ A DESTRA è il
 * separatore dei decimali (vale sia per "1.234,56" sia per "1,234.56").
 * Se ne compare uno solo, è decimale solo quando ha esattamente due cifre
 * dopo di sé - altrimenti è un separatore delle migliaia ("1.234" = 1234).
 */
function normalizzaPrezzo(grezzo: string): number | null {
  if (!grezzo) return null

  // Teniamo solo cifre e separatori: via simboli di valuta, spazi
  // indivisibili, testo tipo "a partire da".
  const pulito = grezzo.replace(/[^\d.,]/g, '')
  if (!pulito || !/\d/.test(pulito)) return null

  const ultimoPunto = pulito.lastIndexOf('.')
  const ultimaVirgola = pulito.lastIndexOf(',')

  let normalizzato: string
  if (ultimoPunto >= 0 && ultimaVirgola >= 0) {
    const decimale = ultimoPunto > ultimaVirgola ? '.' : ','
    const migliaia = decimale === '.' ? ',' : '.'
    normalizzato = pulito.split(migliaia).join('').replace(decimale, '.')
  } else if (ultimaVirgola >= 0) {
    normalizzato = /,\d{2}$/.test(pulito) ? pulito.replace(',', '.') : pulito.split(',').join('')
  } else if (ultimoPunto >= 0) {
    normalizzato = /\.\d{2}$/.test(pulito) ? pulito : pulito.split('.').join('')
  } else {
    normalizzato = pulito
  }

  const numero = Number(normalizzato)
  if (!isFinite(numero) || numero <= 0) return null
  // Un prezzo assurdo è quasi sempre il segno che abbiamo letto la cosa
  // sbagliata (un codice prodotto, un numero di recensioni): meglio non
  // proporlo affatto che proporne uno finto.
  if (numero > 1_000_000) return null
  return Math.round(numero * 100) / 100
}

/** Prezzo dai dati strutturati JSON-LD (schema.org/Offer): la fonte più
 *  affidabile, usata da Amazon, eBay e dalla gran parte degli e-commerce. */
function prezzoDaJsonLd(html: string): { price: number; currency: string | null } | null {
  const blocchi = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )

  for (const blocco of blocchi) {
    let dati: unknown
    try {
      dati = JSON.parse(blocco[1].trim())
    } catch {
      continue
    }

    // Un blocco può contenere un oggetto, un array o un "@graph".
    type NodoJsonLd = Record<string, unknown>
    const daEsaminare: NodoJsonLd[] = []
    const accoda = (v: unknown) => {
      if (!v) return
      if (Array.isArray(v)) v.forEach(accoda)
      else if (typeof v === 'object') {
        const nodo = v as NodoJsonLd
        daEsaminare.push(nodo)
        if (nodo['@graph']) accoda(nodo['@graph'])
      }
    }
    accoda(dati)

    for (const nodo of daEsaminare) {
      const offerte = nodo.offers || nodo.Offers
      const listaOfferte: unknown[] = Array.isArray(offerte) ? offerte : offerte ? [offerte] : []
      for (const voce of listaOfferte) {
        if (!voce || typeof voce !== 'object') continue
        const offerta = voce as Record<string, unknown>
        const grezzo = offerta.price ?? offerta.lowPrice ?? offerta.highPrice
        if (grezzo === undefined || grezzo === null) continue
        const numero = typeof grezzo === 'number' ? grezzo : normalizzaPrezzo(String(grezzo))
        if (numero && numero > 0) {
          const valuta = typeof offerta.priceCurrency === 'string' ? offerta.priceCurrency : null
          return { price: Math.round(numero * 100) / 100, currency: valuta }
        }
      }
    }
  }
  return null
}

/** Prezzo dai meta tag standard (Open Graph / schema.org microdata). */
function prezzoDaMetaTag(html: string): { price: number; currency: string | null } | null {
  const candidati = [
    estraiMetaTag(html, 'product:price:amount'),
    estraiMetaTag(html, 'og:price:amount'),
    html.match(/<meta[^>]+itemprop=["']price["'][^>]+content=["']([^"']+)["']/i)?.[1] || null,
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']price["']/i)?.[1] || null,
  ]

  for (const candidato of candidati) {
    if (!candidato) continue
    const numero = normalizzaPrezzo(candidato)
    if (numero) {
      const valuta =
        estraiMetaTag(html, 'product:price:currency') ||
        estraiMetaTag(html, 'og:price:currency') ||
        html.match(/<meta[^>]+itemprop=["']priceCurrency["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
        null
      return { price: numero, currency: valuta }
    }
  }
  return null
}

/** Ultimo tentativo: il prezzo scritto nella pagina di Amazon, che non
 *  sempre espone JSON-LD. "a-offscreen" è l'elemento nascosto che Amazon
 *  usa da anni per i lettori di schermo e contiene il prezzo completo. */
function prezzoDaHtmlAmazon(html: string): number | null {
  // ATTENZIONE: una pagina Amazon contiene DECINE di prezzi (accessori
  // consigliati, "altri venditori", caroselli, prezzo di listino barrato).
  // Prendere il primo "a-offscreen" che capita è sbagliato: in prova su un
  // articolo da 11,98€ restituiva 23,99€, il prezzo di un altro prodotto.
  // Cerchiamo quindi PRIMA dentro i contenitori del riquadro d'acquisto,
  // che contengono solo il prezzo dell'articolo richiesto.
  const contenitori = ['corePrice_feature_div', 'corePriceDisplay_desktop_feature_div', 'apex_desktop', 'buybox']

  for (const id of contenitori) {
    const inizio = html.search(new RegExp(`id=["']${id}["']`, 'i'))
    if (inizio < 0) continue
    // Una finestra generosa ma limitata: il prezzo sta sempre subito dentro
    // il contenitore, e così non sconfiniamo nella sezione successiva.
    const finestra = html.slice(inizio, inizio + 6000)
    const match = finestra.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<]+)<\/span>/i)
    if (match) {
      const numero = normalizzaPrezzo(match[1])
      if (numero) return numero
    }
  }

  // Schede vecchie: qui l'id identifica direttamente il prezzo giusto.
  const vecchio = html.match(/id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>\s*([^<]+)</i)
  if (vecchio) {
    const numero = normalizzaPrezzo(vecchio[1])
    if (numero) return numero
  }

  // Volutamente NON ripieghiamo sul primo "a-offscreen" della pagina: senza
  // il contesto del riquadro d'acquisto non c'è modo di sapere di quale
  // prodotto sia quel prezzo, e pubblicarne uno sbagliato è peggio che non
  // pubblicarne nessuno.
  return null
}

const SIMBOLI_VALUTA: Record<string, string> = {
  '€': 'EUR', '$': 'USD', '£': 'GBP', 'CHF': 'CHF',
}

/**
 * Ultimo tentativo generico, per i negozi che non pubblicano né JSON-LD né
 * meta tag (moltissimi siti piccoli, e alcuni grandi): cerca un elemento il
 * cui attributo class o itemprop contenga "price" e cha abbia dentro un
 * simbolo di valuta.
 *
 * Il simbolo di valuta è richiesto di proposito: senza, questa ricerca
 * finirebbe per raccogliere numeri di ogni genere (codici prodotto, numero
 * di recensioni, sconti percentuali) e mostrerebbe prezzi inventati - molto
 * peggio che non mostrarne nessuno.
 */
function prezzoDaHtmlGenerico(html: string): { price: number; currency: string | null } | null {
  const elementi = html.matchAll(
    /<(?:span|p|div|b|strong|ins|bdi)[^>]*(?:class|itemprop|id)=["'][^"']*[Pp]rice[^"']*["'][^>]*>([\s\S]{0,120}?)<\//g
  )

  for (const elemento of elementi) {
    // Via eventuali tag annidati (<span class="price"><sup>€</sup>19<sub>99</sub></span>)
    const testo = elemento[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    if (!testo) continue

    const simbolo = Object.keys(SIMBOLI_VALUTA).find(s => testo.includes(s))
    if (!simbolo) continue

    const numero = normalizzaPrezzo(testo)
    if (numero) return { price: numero, currency: SIMBOLI_VALUTA[simbolo] }
  }
  return null
}

// Siti che rispondono a una semplice richiesta HTTP con pagine parziali,
// anti-bot o "quasi giuste": l'HTML che ci mandano contiene prezzi di altri
// prodotti (accessori, caroselli, "altri venditori"), e leggerlo con regole
// generiche produce numeri plausibili ma sbagliati. In prova, sullo stesso
// articolo da 11,98€ uscivano 8,99€ e 23,99€ a seconda della risposta.
// Per questi, la lettura affidabile è quella di microlink, che apre la
// pagina con un browser vero e usa i selettori del riquadro d'acquisto.
const SITI_DIFFICILI = ['amazon.', 'amzn.', 'a.co', 'ebay.', 'aliexpress.', 'zalando.', 'temu.']

export function isSitoDifficile(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return SITI_DIFFICILI.some(s => h.includes(s))
}

function estraiPrezzo(html: string, hostname: string): { price: number | null; currency: string | null } {
  const daJson = prezzoDaJsonLd(html)
  if (daJson) return daJson

  const daMeta = prezzoDaMetaTag(html)
  if (daMeta) return daMeta

  const daAmazon = prezzoDaHtmlAmazon(html)
  if (daAmazon) return { price: daAmazon, currency: null }

  // La ricerca generica NON va usata sui siti difficili: lì un elemento con
  // "price" nella classe appartiene quasi sempre a un altro prodotto.
  if (!isSitoDifficile(hostname)) {
    const daGenerico = prezzoDaHtmlGenerico(html)
    if (daGenerico) return daGenerico
  }

  return { price: null, currency: null }
}

function estraiMetaTag(html: string, proprieta: string): string | null {
  const pattern1 = new RegExp(
    `<meta[^>]+property=["']${proprieta}["'][^>]+content=["']([^"']+)["']`,
    'i'
  )
  const pattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${proprieta}["']`,
    'i'
  )
  const match = html.match(pattern1) || html.match(pattern2)
  return match ? match[1] : null
}

/**
 * Immagine del prodotto per i siti che non pubblicano og:image - Amazon fra
 * questi, che mette la foto principale in un <img id="landingImage"> con
 * l'indirizzo ad alta risoluzione in "data-old-hires".
 */
/**
 * Scarta gli indirizzi che non sono vere foto di prodotto: pixel di
 * tracciamento (in prova, Amazon ha restituito un beacon "fls-eu.amazon.it/
 * 1/batch/..." che finiva in Vetrina come immagine dell'articolo),
 * segnaposto in base64, GIF trasparenti.
 */
function sembraUnaFotoVera(url: string): boolean {
  if (!url || url.startsWith('data:')) return false
  const minuscolo = url.toLowerCase()
  if (/\/(batch|beacon|pixel|track|1x1)\//.test(minuscolo)) return false
  if (minuscolo.endsWith('.gif')) return false
  return /\.(jpe?g|png|webp|avif)(\?|$)/.test(minuscolo) || /\/images?\//.test(minuscolo)
}

function estraiImmagineFallback(html: string): string | null {
  const pattern = [
    /<img[^>]+id=["']landingImage["'][^>]*data-old-hires=["']([^"']+)["']/i,
    /<img[^>]+id=["']landingImage["'][^>]*src=["']([^"']+)["']/i,
    // Amazon non pubblica og:image e mette la foto del prodotto solo dentro
    // un blocco JavaScript ("colorImages"): "hiRes" è la versione grande
    // della PRIMA foto, cioè quella principale della scheda.
    /"hiRes"\s*:\s*"(https:\/\/[^"]+\.(?:jpe?g|png|webp))"/i,
    /"large"\s*:\s*"(https:\/\/[^"]+\.(?:jpe?g|png|webp))"/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]
  for (const p of pattern) {
    const match = html.match(p)
    if (match && match[1] && sembraUnaFotoVera(match[1])) return match[1]
  }
  return null
}

/**
 * Descrizione per i siti che non pubblicano og:description. Amazon è fra
 * questi: il testo del prodotto sta nell'elenco puntato "feature-bullets",
 * non in un meta tag - senza questo ripiego il campo descrizione restava
 * sempre vuoto per ogni articolo Amazon.
 */
function estraiDescrizioneFallback(html: string): string | null {
  const blocco = html.match(/id=["']feature-bullets["']([\s\S]{0,4000})/i)
  if (blocco) {
    const punti = Array.from(blocco[1].matchAll(/<span[^>]*class=["'][^"']*a-list-item[^"']*["'][^>]*>([\s\S]{0,400}?)<\/span>/gi))
      .map(m => m[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(t => t.length > 15)
      .slice(0, 4)
    if (punti.length) return decodificaEntitaHtml(punti.join(' · ')).slice(0, 500)
  }

  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
  if (meta && meta[1].trim().length > 15) return decodificaEntitaHtml(meta[1].trim()).slice(0, 500)

  return null
}

function estraiTitoloFallback(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : null
}

function decodificaEntitaHtml(testo: string): string {
  return testo
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Se l'URL è un accorciatore Amazon (amzn.eu, amzn.to), lo risolve
 * seguendo i redirect fino all'indirizzo finale e completo. Per qualsiasi
 * altro sito restituisce l'URL originale invariato.
 */
/** Domini accorciati di Amazon, quelli generati dal tasto "Condividi". */
const ACCORCIATORI = ['amzn.to', 'amzn.eu', 'a.co', 'amzn.asia']

export function isAccorciatore(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return ACCORCIATORI.some(d => h === d || h.endsWith('.' + d))
}

/** Estrae il codice prodotto (ASIN) da un indirizzo Amazon, se c'è. */
function asinDaUrl(u: URL): string | null {
  const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i)
  return m ? m[1].toUpperCase() : null
}

/**
 * Trasforma un link accorciato (amzn.to/…, amzn.eu/…) nell'indirizzo vero e
 * pulito della pagina prodotto.
 *
 * ============================================================================
 * PERCHÉ ERA ROTTO PER I LINK DI AFFILIAZIONE
 *
 * La versione precedente faceva una GET con "redirect: follow" e prendeva
 * "res.url". Sembra ragionevole, ma su questi indirizzi non funziona:
 * seguendo i redirect si finisce a scaricare la PAGINA di destinazione, e
 * Amazon a quel punto risponde alle richieste dai datacenter con una pagina
 * vuota di blocco. Misurato:
 *
 *     GET https://amzn.to/…  (redirect: follow)
 *     -> 202, corpo di 0 byte, url finale "https://www.amazon.com/"
 *
 * Cioè: si perdeva del tutto il prodotto e si finiva sulla home di
 * amazon.com. Da lì nessun prezzo era leggibile, ed è esattamente l'errore
 * "Prezzo non leggibile da questo link".
 *
 * Ora i redirect si seguono UNO A UNO leggendo l'intestazione "Location",
 * senza mai scaricare la pagina: quella parte funziona anche quando il corpo
 * viene bloccato.
 *
 *     GET https://amzn.to/…  (redirect: manual)
 *     -> 302, Location: <indirizzo vero del prodotto>
 *
 * In più, una volta trovato il codice prodotto (ASIN), l'indirizzo viene
 * ricostruito pulito - senza i parametri di tracciamento dell'affiliazione,
 * che su Amazon possono far comparire varianti o pagine intermedie.
 * ============================================================================
 */
async function risolviLinkAccorciato(parsedUrl: URL): Promise<URL> {
  if (!isAccorciatore(parsedUrl.hostname)) return parsedUrl

  let corrente = parsedUrl

  try {
    // Al massimo 6 salti: se ce ne vogliono di più, qualcosa non va e
    // continuare significherebbe solo restare appesi.
    for (let salto = 0; salto < 6; salto++) {
      const res = await fetch(corrente.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'it-IT,it;q=0.9',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(12000),
      })

      const destinazione = res.headers.get('location')
      if (!destinazione) break

      corrente = new URL(destinazione, corrente)

      // Arrivati fuori dagli accorciatori: è l'indirizzo vero.
      if (!isAccorciatore(corrente.hostname)) break
    }
  } catch (err) {
    console.warn('[AnteprimaLink] Link accorciato non risolto, uso quello originale:', err)
    return parsedUrl
  }

  // Se siamo rimasti sull'accorciatore, non abbiamo risolto niente.
  if (isAccorciatore(corrente.hostname)) return parsedUrl

  // Indirizzo ripulito: solo dominio + /dp/<ASIN>, senza parametri di
  // tracciamento. Se l'ASIN non c'è (es. siamo finiti sulla home), teniamo
  // l'indirizzo così com'è.
  const asin = asinDaUrl(corrente)
  if (asin) {
    try {
      return new URL(`https://${corrente.hostname}/dp/${asin}`)
    } catch {
      return corrente
    }
  }

  return corrente
}

// Frasi che compaiono sulle pagine di blocco/errore dei grandi negozi.
// Se il titolo o l'inizio della pagina le contiene, non stiamo guardando la
// scheda di un prodotto.
const SEGNALI_PAGINA_BLOCCATA = [
  'inserisci i caratteri',
  'digitare i caratteri',
  'robot check',
  'sorry, we just need to make sure',
  'ci dispiace, dobbiamo solo assicurarci',
  'access denied',
  'accesso negato',
  'enable javascript',
  'attiva javascript',
  'pagina non trovata',
  'impossibile trovare la pagina',
  'page not found',
  'are you a human',
  'verifica di sicurezza',
]

/**
 * Riconosce le pagine che NON sono la scheda del prodotto richiesto:
 * schermate anti-bot, errori 404 travestiti da pagina normale, home page
 * servite al posto del prodotto.
 */
function paginaNonAffidabile(html: string, title: string | null, parsedUrl: URL): boolean {
  const titoloMinuscolo = (title || '').toLowerCase().trim()

  if (SEGNALI_PAGINA_BLOCCATA.some(s => titoloMinuscolo.includes(s))) return true

  // Titolo uguale al solo nome del sito ("Amazon.it", "eBay"): è la home o
  // una pagina di blocco, mai la scheda di un articolo.
  const dominio = parsedUrl.hostname.replace(/^www\./, '')
  const nomeSito = dominio.split('.')[0]
  if (
    titoloMinuscolo === dominio ||
    titoloMinuscolo === nomeSito ||
    titoloMinuscolo.length < 6
  ) {
    return true
  }

  // Alcune pagine di blocco non hanno un titolo sospetto ma sono minuscole.
  if (html.length < 2000) {
    const corpo = html.toLowerCase()
    if (SEGNALI_PAGINA_BLOCCATA.some(s => corpo.includes(s))) return true
  }

  return false
}

async function provaLetturaDiretta(parsedUrl: URL, userAgent: string = USER_AGENT): Promise<Anteprima | null> {
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

    if (!res.ok) return null

    const html = await res.text()
    const title = estraiMetaTag(html, 'og:title') || estraiTitoloFallback(html)
    const description = estraiMetaTag(html, 'og:description') || estraiDescrizioneFallback(html)
    let image = estraiMetaTag(html, 'og:image') || estraiImmagineFallback(html)

    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, parsedUrl.origin).toString()
      } catch {
        image = null
      }
    }

    // ========================================================================
    // Se la pagina che ci è arrivata NON è quella del prodotto, buttiamo via
    // tutto quello che ne abbiamo letto.
    //
    // Serve sul serio: Amazon risponde alle richieste che arrivano da un
    // datacenter con una pagina anti-bot o con la home. Quella pagina
    // contiene comunque dei prezzi (prodotti consigliati, banner), e senza
    // questo controllo finivano in Vetrina come prezzo dell'articolo: in
    // prova, un articolo da 11,98€ veniva pubblicato a 8,99€, preso da
    // tutt'altro prodotto. Un prezzo sbagliato è molto peggio di nessun
    // prezzo, perché nessuno si accorge che è sbagliato.
    //
    // Quando scartiamo, restituiamo null: il chiamante passa a microlink,
    // che apre la pagina con un browser vero e vede quella giusta.
    // ========================================================================
    if (paginaNonAffidabile(html, title, parsedUrl)) {
      console.warn('[AnteprimaLink] Pagina anti-bot o non di prodotto, scartata:', parsedUrl.hostname)
      return null
    }

    const { price, currency } = estraiPrezzo(html, parsedUrl.hostname)
    const shipping = estraiSpedizione(html)

    if (!title && !image && !description && price === null) return null

    return {
      title: title ? decodificaEntitaHtml(title) : null,
      description: description ? decodificaEntitaHtml(description) : null,
      image,
      price,
      currency,
      shipping,
    }
  } catch {
    return null
  }
}

// Selettori CSS del prezzo, dal più specifico al più generico. Vengono
// passati a microlink, che apre la pagina con un browser vero: è l'unico
// modo di leggere il prezzo da siti come Amazon, che a una semplice
// richiesta HTTP rispondono con una pagina anti-bot.
// ============================================================================
// SELETTORI DEL PREZZO — divisi in due gruppi, e non è un dettaglio.
//
// PROBLEMA TROVATO: sullo stesso identico link, il prezzo importato cambiava
// da una prova all'altra (11,98 € corretto, poi 62,89 € sbagliato). Il
// colpevole era il selettore generico ".a-price .a-offscreen" passato a
// microlink: su una pagina Amazon ci sono decine di elementi ".a-price"
// (prodotti sponsorizzati, accessori, "altri venditori", caroselli), e
// quello preso era semplicemente il primo che capitava nel DOM - quasi mai
// quello dell'articolo richiesto. Verificato con chiavi distinte:
//
//     #corePrice_feature_div .a-offscreen -> null
//     .a-price .a-offscreen              -> "€62.89"   <-- altro prodotto
//
// I selettori generici restano utili sui negozi piccoli, dove esiste un solo
// prezzo in pagina. Su Amazon, eBay e simili vanno esclusi: meglio nessun
// prezzo che il prezzo di un altro articolo.
// ============================================================================

/** Ancorati al riquadro d'acquisto: contengono SOLO il prezzo dell'articolo. */
const SELETTORI_PREZZO_SPECIFICI = [
  '#corePrice_feature_div .a-offscreen',              // Amazon
  '#corePriceDisplay_desktop_feature_div .a-offscreen',
  '#apex_desktop .a-offscreen',
  '#buybox .a-offscreen',
  '#priceblock_ourprice',                             // Amazon (schede vecchie)
  '.x-price-primary .ux-textspans',                   // eBay
]

/** Generici: buoni sui negozi con un solo prezzo in pagina, pessimi altrove. */
const SELETTORI_PREZZO_GENERICI = [
  '[itemprop="price"]',
  '.price_color',
  '.product-price',
  '.price',
]


async function provaViaMicrolink(parsedUrl: URL): Promise<Anteprima | null> {
  try {
    // FIX: qui veniva passato "&headers.userAgent=...". Quel parametro è
    // riservato al piano a pagamento di microlink: sul piano gratuito ogni
    // richiesta tornava {"status":"fail","code":"EHEADERS"}, quindi questa
    // funzione restituiva SEMPRE null. Il "ripiego su microlink" descritto
    // nei commenti non ha mai letto un solo dato da quando esiste: quando
    // la lettura diretta falliva (tipico di Amazon, che blocca le richieste
    // dai datacenter), l'anteprima risultava semplicemente vuota.
    // I selettori del prezzo si passano ripetendo la stessa chiave: microlink
    // li prova in ordine e tiene il primo che trova qualcosa.
    // Sui siti difficili niente selettori generici: vedi il commento sopra
    // l'elenco: e' proprio da li' che arrivava il prezzo di un altro prodotto.
    const selettoriUsati = isSitoDifficile(parsedUrl.hostname)
      ? SELETTORI_PREZZO_SPECIFICI
      : [...SELETTORI_PREZZO_SPECIFICI, ...SELETTORI_PREZZO_GENERICI]

    // Chiavi DISTINTE (p0, p1, ...) invece della stessa chiave ripetuta.
    // Ripetendola, microlink non prova i selettori nell'ordine dato - come
    // avevo assunto - e restituiva il risultato di uno qualsiasi di essi:
    // era questo a far comparire prezzi diversi a ogni tentativo sullo
    // stesso link. Con chiavi distinte l'ordine di priorita' lo decidiamo
    // qui sotto, leggendole nella sequenza giusta.
    const selettori = selettoriUsati
      .map((s, i) => `data.p${i}.selector=${encodeURIComponent(s)}`)
      .join('&')

    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(parsedUrl.toString())}&${selettori}`,
      { headers: { Accept: 'application/json' } }
    )

    if (!res.ok) return null

    const data = await res.json()
    if (data.status !== 'success' || !data.data) {
      console.warn('[AnteprimaLink] microlink non ha elaborato il link:', data?.code || data?.status)
      return null
    }

    const title: string | null = data.data.title || null

    // Anche microlink può ritrovarsi davanti a una pagina di errore o di
    // blocco (link scaduto, prodotto rimosso): il titolo "Impossibile
    // trovare la pagina" è comunque un titolo, e senza questo controllo
    // finiva in Vetrina come nome dell'articolo.
    if (title && SEGNALI_PAGINA_BLOCCATA.some(s => title.toLowerCase().includes(s))) {
      console.warn('[AnteprimaLink] microlink ha letto una pagina di errore, scartata:', title)
      return null
    }

    const description: string | null = data.data.description || null
    const immagineGrezza: string | null = data.data.image?.url || data.data.screenshot?.url || null
    const image = immagineGrezza && sembraUnaFotoVera(immagineGrezza) ? immagineGrezza : null

    // Leggiamo i selettori NELL'ORDINE in cui li abbiamo mandati: il primo
    // che ha trovato qualcosa vince. Cosi' un selettore ancorato al riquadro
    // d'acquisto batte sempre uno generico, indipendentemente da come
    // microlink ordina la risposta.
    let price: number | null = null
    let currency: string | null = null
    for (let i = 0; i < selettoriUsati.length; i++) {
      const grezzo = data.data[`p${i}`]
      if (grezzo === undefined || grezzo === null) continue

      if (typeof grezzo === 'object') {
        price = normalizzaPrezzo(String(grezzo.amount ?? grezzo.value ?? ''))
        currency = grezzo.currency || null
      } else {
        const testo = String(grezzo)
        price = normalizzaPrezzo(testo)
        const simbolo = Object.keys(SIMBOLI_VALUTA).find(s => testo.includes(s))
        if (simbolo) currency = SIMBOLI_VALUTA[simbolo]
      }
      if (price) break
    }

    // NOTA: il campo "price" che microlink ricava per conto suo NON viene
    // piu' usato. Su Amazon restituiva il prezzo di prodotti sponsorizzati
    // in pagina, ed era una delle vie da cui entrava il valore sbagliato.

    if (!title && !image && !description && price === null) return null
    // microlink non espone le spese di spedizione: restano da leggere dalla
    // pagina vera (provaLetturaDiretta).
    return { title, description, image, price, currency, shipping: null }
  } catch (err) {
    console.error('[Vetrina/Preview] Errore fallback microlink:', err)
    return null
  }
}


/** Prende, campo per campo, il primo valore utile fra i vari tentativi. */
function unisci(tentativi: (Anteprima | null)[]): Anteprima {
  const primo = <T,>(scegli: (a: Anteprima) => T | null | undefined): T | null => {
    for (const t of tentativi) {
      if (!t) continue
      const valore = scegli(t)
      if (valore !== null && valore !== undefined && valore !== '') return valore
    }
    return null
  }

  // NOTA: "primo" scarta null/undefined/'' ma NON lo zero - fondamentale per
  // le spese di spedizione, dove 0 significa "gratuita", cioe' un dato letto
  // davvero, non un dato mancante.
  return {
    title: primo(a => a.title),
    description: primo(a => a.description),
    image: primo(a => a.image),
    price: primo(a => a.price),
    currency: primo(a => a.currency),
    shipping: primo(a => a.shipping),
  }
}

/**
 * Controlla che l'indirizzo sia un http/https valido e lo restituisce
 * normalizzato. Null se non lo è.
 */
export function analizzaIndirizzo(url: unknown): URL | null {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Legge l'anteprima completa di una pagina prodotto, provando in ordine:
 * lettura diretta da desktop, lettura diretta da telefono, microlink.
 * I campi vengono uniti: ogni tentativo può contribuire quello che l'altro
 * non è riuscito a leggere.
 */
export async function leggiAnteprimaLink(parsedUrl: URL): Promise<Anteprima> {
  const urlRisolto = await risolviLinkAccorciato(parsedUrl)

  const tentativi: (Anteprima | null)[] = []

  const serveAncora = () => {
    const parziale = unisci(tentativi)
    return !parziale.title || !parziale.description || !parziale.image || parziale.price === null || parziale.shipping === null
  }

  // ORDINE DEI TENTATIVI. "unisci" tiene, campo per campo, il primo valore
  // trovato: chi prova per primo decide il risultato. La lettura diretta va
  // per prima perché, quando il sito risponde davvero, è la fonte più
  // precisa (legge il prezzo dentro il riquadro d'acquisto della scheda
  // richiesta) oltre che la più veloce e senza limiti d'uso.
  tentativi.push(await provaLetturaDiretta(urlRisolto))
  if (serveAncora()) tentativi.push(await provaLetturaDiretta(urlRisolto, USER_AGENT_MOBILE))

  // I siti che limitano gli scraper (Amazon in testa) alternano la pagina
  // vera e una pagina di blocco: misurato, la pagina buona arriva circa una
  // volta su due. Siccome per questi siti la lettura diretta è l'UNICA fonte
  // di cui ci si possa fidare per il prezzo (i selettori generici prendono
  // articoli sbagliati - vedi il commento sui selettori), insistere qualche
  // volta in più è la differenza fra "prezzo importato" e "riprova". Con
  // quattro tentativi la probabilità di restare a mani vuote scende sotto il
  // 10%. Ci si ferma appena il prezzo arriva.
  if (isSitoDifficile(urlRisolto.hostname)) {
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      if (unisci(tentativi).price !== null) break
      await new Promise(r => setTimeout(r, 900))
      tentativi.push(await provaLetturaDiretta(urlRisolto))
    }
  }

  if (serveAncora()) {
    const daMicrolink = await provaViaMicrolink(urlRisolto)

    // ========================================================================
    // SUI SITI DIFFICILI, DA MICROLINK NON SI PRENDE IL PREZZO.
    //
    // Microlink apre la pagina con un browser proprio e viene rimandato alla
    // versione internazionale (".../-/en/..."), che può mostrare una
    // variante diversa dell'articolo - altra taglia, altro colore, altro
    // venditore - e quindi un altro prezzo. Misurato sullo stesso zaino:
    //
    //     lettura diretta (5 prove) -> 16,99  16,99  16,99   (prezzo vero)
    //     via microlink             -> 13,93                 (altra variante)
    //
    // Titolo, descrizione e immagine restano utilissimi: quelli valgono
    // anche se arrivano dalla versione internazionale. Il prezzo no: è un
    // dato su cui la gente decide se comprare, e uno sbagliato è peggio di
    // uno mancante.
    // ========================================================================
    if (daMicrolink && isSitoDifficile(urlRisolto.hostname)) {
      tentativi.push({ ...daMicrolink, price: null, currency: null })
    } else {
      tentativi.push(daMicrolink)
    }
  }

  return unisci(tentativi)
}
