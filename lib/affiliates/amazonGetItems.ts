// lib/affiliates/amazonGetItems.ts
//
// ============================================================================
// PERCHÉ ESISTE — il prezzo dei link Amazon non è leggibile dal sito online.
//
// La Vetrina leggeva il prezzo scaricando la pagina del prodotto. In locale
// funziona; dal sito pubblicato NO, e la differenza non dipende dal codice:
// Amazon blocca sistematicamente le richieste che arrivano dagli indirizzi
// dei datacenter (Vercel), mentre da una normale connessione di casa serve
// la pagina vera. Misurato sullo stesso identico link:
//
//     in locale                -> prezzo 269,99  (4 prove su 4)
//     dal sito su Vercel       -> prezzo null    (5 prove su 5)
//
// Anche il ripiego su microlink, da server, torna a mani vuote: i selettori
// del riquadro d'acquisto restituiscono tutti null.
//
// Non è un problema che si risolva insistendo: è Amazon che non vuole essere
// letta così, e ha ragione. La via corretta - e quella pensata apposta per
// chi è affiliato, come questo sito (tag "relove00-21") - è l'API ufficiale
// Product Advertising: dà titolo, immagine, prezzo e disponibilità in modo
// affidabile, veloce e consentito dalle condizioni d'uso.
//
// Nel progetto c'era già la firma delle richieste PA-API (lib/affiliates/
// amazon.ts, usata per la ricerca). Qui viene aggiunta l'operazione che
// serve alla Vetrina: GetItems, cioè "dammi i dati di QUESTO prodotto",
// dato il suo codice ASIN.
//
// SE LE CHIAVI NON CI SONO, questa funzione restituisce null e il sistema
// continua con i metodi di prima: nessuna regressione, semplicemente il
// prezzo resterà spesso illeggibile dal sito pubblicato finché non vengono
// configurate.
// ============================================================================

import crypto from 'crypto'

const SERVICE = 'ProductAdvertisingAPI'

function firma(chiave: Buffer, messaggio: string) {
  return crypto.createHmac('sha256', chiave).update(messaggio, 'utf8').digest()
}

function chiaveDiFirma(secretKey: string, dataGiorno: string, regione: string) {
  const kDate = firma(Buffer.from('AWS4' + secretKey, 'utf8'), dataGiorno)
  const kRegion = firma(kDate, regione)
  const kService = firma(kRegion, SERVICE)
  return firma(kService, 'aws4_request')
}

export interface ProdottoAmazon {
  title: string | null
  image: string | null
  price: number | null
  currency: string | null
  /** true = spedizione gratuita dichiarata da Amazon. */
  spedizioneGratuita: boolean | null
  /** Indirizzo con il tag di affiliazione già applicato da Amazon. */
  url: string | null
}

/** Le credenziali ci sono tutte? */
export function credenzialiAmazonPresenti(): boolean {
  return !!(process.env.AMAZON_ACCESS_KEY && process.env.AMAZON_SECRET_KEY && process.env.AMAZON_PARTNER_TAG)
}

/**
 * Chiede ad Amazon i dati di un singolo prodotto, dato il suo ASIN.
 * Non lancia mai: in caso di problemi restituisce null e chi chiama
 * prosegue con gli altri metodi.
 */
export async function datiProdottoAmazon(asin: string, dominio?: string): Promise<ProdottoAmazon | null> {
  const accessKey = process.env.AMAZON_ACCESS_KEY
  const secretKey = process.env.AMAZON_SECRET_KEY
  const partnerTag = process.env.AMAZON_PARTNER_TAG

  if (!accessKey || !secretKey || !partnerTag) return null

  // Il marketplace deve corrispondere al paese del link: un ASIN letto su
  // amazon.it va chiesto all'endpoint italiano, altrimenti Amazon risponde
  // "prodotto non trovato" anche se esiste.
  const mercato = (dominio && dominio.includes('amazon.')) ? dominio.replace(/^www\./, '') : 'www.amazon.it'
  const host = process.env.AMAZON_HOST || 'webservices.amazon.it'
  const region = process.env.AMAZON_REGION || 'eu-west-1'

  const operazione = 'GetItems'
  const percorso = '/paapi5/getitems'
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operazione}`

  const payload = JSON.stringify({
    ItemIds: [asin],
    ItemIdType: 'ASIN',
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: mercato.startsWith('www.') ? mercato : `www.${mercato}`,
    Resources: [
      'ItemInfo.Title',
      'Images.Primary.Large',
      'Offers.Listings.Price',
      'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
      'Offers.Listings.Availability.Message',
    ],
  })

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dataGiorno = amzDate.slice(0, 8)

  const headerCanonici =
    `content-encoding:amz-1.0\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${target}\n`
  const headerFirmati = 'content-encoding;host;x-amz-date;x-amz-target'
  const hashPayload = crypto.createHash('sha256').update(payload).digest('hex')

  const richiestaCanonica = ['POST', percorso, '', headerCanonici, headerFirmati, hashPayload].join('\n')
  const ambito = `${dataGiorno}/${region}/${SERVICE}/aws4_request`
  const daFirmare = [
    'AWS4-HMAC-SHA256',
    amzDate,
    ambito,
    crypto.createHash('sha256').update(richiestaCanonica).digest('hex'),
  ].join('\n')

  const chiave = chiaveDiFirma(secretKey, dataGiorno, region)
  const firmaFinale = crypto.createHmac('sha256', chiave).update(daFirmare).digest('hex')

  const autorizzazione =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${ambito}, ` +
    `SignedHeaders=${headerFirmati}, Signature=${firmaFinale}`

  try {
    const res = await fetch(`https://${host}${percorso}`, {
      method: 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        host,
        'x-amz-date': amzDate,
        'x-amz-target': target,
        Authorization: autorizzazione,
      },
      body: payload,
      signal: AbortSignal.timeout(12000),
    })

    const dati = await res.json()

    if (!res.ok) {
      const messaggio = dati?.Errors?.[0]?.Message || dati?.__type || `HTTP ${res.status}`
      console.error('[Amazon/GetItems] Richiesta rifiutata:', messaggio)
      return null
    }

    const item = dati?.ItemsResult?.Items?.[0]
    if (!item) {
      console.warn('[Amazon/GetItems] Nessun prodotto per ASIN', asin)
      return null
    }

    const offerta = item?.Offers?.Listings?.[0]
    const prezzo = offerta?.Price

    return {
      title: item?.ItemInfo?.Title?.DisplayValue || null,
      image: item?.Images?.Primary?.Large?.URL || null,
      price: typeof prezzo?.Amount === 'number' ? Math.round(prezzo.Amount * 100) / 100 : null,
      currency: prezzo?.Currency || null,
      spedizioneGratuita:
        typeof offerta?.DeliveryInfo?.IsFreeShippingEligible === 'boolean'
          ? offerta.DeliveryInfo.IsFreeShippingEligible
          : null,
      url: item?.DetailPageURL || null,
    }
  } catch (err) {
    console.error('[Amazon/GetItems] Errore di connessione:', err)
    return null
  }
}
