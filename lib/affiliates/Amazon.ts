// lib/affiliates/amazon.ts
//
// Integrazione con Amazon Product Advertising API (PA-API) 5.0.
// PA-API richiede la firma delle richieste con AWS Signature Version 4 -
// non esiste altra forma di autenticazione accettata. Non serve nessuna
// libreria esterna: la firma si calcola con il modulo "crypto" nativo di Node.
//
// NOTA IMPORTANTE PRIMA DI USARLA:
// L'accesso a PA-API non è immediato alla registrazione ad Amazon Associates -
// Amazon richiede che il tuo account generi almeno 3 vendite qualificanti nei
// primi 180 giorni per attivare (e poi mantenere) l'accesso alle API. Finché
// non hai quell'accesso, questa funzione riceverà un errore di autorizzazione
// da Amazon - il codice è corretto, è una condizione del programma Amazon
// stesso, non un bug.

import crypto from 'crypto'
import type { AffiliateProduct } from './types'

const ACCESS_KEY = process.env.AMAZON_PAAPI_ACCESS_KEY || ''
const SECRET_KEY = process.env.AMAZON_PAAPI_SECRET_KEY || ''
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || ''
// Valori di default per il marketplace italiano - cambia queste tre variabili
// (o i default qui sotto) se ti serve un altro paese Amazon.
const HOST = process.env.AMAZON_PAAPI_HOST || 'webservices.amazon.it'
const REGION = process.env.AMAZON_PAAPI_REGION || 'eu-west-1'
const MARKETPLACE = process.env.AMAZON_MARKETPLACE || 'www.amazon.it'

const SERVICE = 'ProductAdvertisingAPI'
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
const PATH = '/paapi5/searchitems'

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex')
}

function signRequest(payload: string, amzDate: string, dateStamp: string): string {
  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `content-type:application/json; charset=utf-8\n` +
    `host:${HOST}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:${TARGET}\n`
  const signedHeaders = 'content-encoding;content-type;host;x-amz-date;x-amz-target'

  const canonicalRequest = `POST\n${PATH}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(payload)}`

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`

  const kDate = hmac(`AWS4${SECRET_KEY}`, dateStamp)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, SERVICE)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

export async function searchAmazon(query: string): Promise<AffiliateProduct[]> {
  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    console.warn('[Amazon] Credenziali PA-API mancanti (AMAZON_PAAPI_ACCESS_KEY / AMAZON_PAAPI_SECRET_KEY / AMAZON_PARTNER_TAG) - salto la ricerca.')
    return []
  }

  const now = new Date()
  // Formato richiesto da AWS: YYYYMMDDTHHMMSSZ (niente trattini, due punti, millisecondi)
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const payload = JSON.stringify({
    Keywords: query,
    Resources: ['Images.Primary.Medium', 'ItemInfo.Title', 'Offers.Listings.Price'],
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Marketplace: MARKETPLACE,
    ItemCount: 6,
  })

  const authorizationHeader = signRequest(payload, amzDate, dateStamp)

  try {
    const res = await fetch(`https://${HOST}${PATH}`, {
      method: 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        'host': HOST,
        'x-amz-date': amzDate,
        'x-amz-target': TARGET,
        'Authorization': authorizationHeader,
      },
      body: payload,
    })

    if (!res.ok) {
      console.error('[Amazon] Errore PA-API:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items = data?.SearchResult?.Items || []

    return items
      .map((item: any): AffiliateProduct => ({
        title: item?.ItemInfo?.Title?.DisplayValue || 'Prodotto Amazon',
        price: item?.Offers?.Listings?.[0]?.Price?.Amount ?? 0,
        currency: item?.Offers?.Listings?.[0]?.Price?.Currency || 'EUR',
        imageUrl: item?.Images?.Primary?.Medium?.URL || '',
        // DetailPageURL restituito da Amazon include già il Partner Tag - non
        // serve costruire il link a mano.
        affiliateUrl: item?.DetailPageURL || '',
        platform: 'Amazon',
      }))
      .filter((p: AffiliateProduct) => p.affiliateUrl)
  } catch (err) {
    console.error('[Amazon] Richiesta fallita:', err)
    return []
  }
}