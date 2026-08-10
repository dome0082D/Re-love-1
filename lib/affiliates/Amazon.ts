// lib/affiliates/amazon.ts
// Integrazione Amazon Product Advertising API (PA-API 5.0).
// Richiede le seguenti variabili d'ambiente su Vercel:
//   AMAZON_ACCESS_KEY
//   AMAZON_SECRET_KEY
//   AMAZON_PARTNER_TAG
//   AMAZON_HOST (es. "webservices.amazon.it")
//   AMAZON_REGION (es. "eu-west-1")

import crypto from 'crypto'
import type { AffiliateProduct } from './types'

const SERVICE = 'ProductAdvertisingAPI'

function sign(key: Buffer, msg: string) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest()
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string) {
  const kDate = sign(Buffer.from('AWS4' + secretKey, 'utf8'), dateStamp)
  const kRegion = sign(kDate, region)
  const kService = sign(kRegion, SERVICE)
  return sign(kService, 'aws4_request')
}

export async function fetchAmazonProducts(query: string): Promise<AffiliateProduct[]> {
  const accessKey = process.env.AMAZON_ACCESS_KEY
  const secretKey = process.env.AMAZON_SECRET_KEY
  const partnerTag = process.env.AMAZON_PARTNER_TAG
  const host = process.env.AMAZON_HOST || 'webservices.amazon.it'
  const region = process.env.AMAZON_REGION || 'eu-west-1'

  // Se le credenziali non sono ancora configurate, non blocchiamo tutta la
  // ricerca: restituiamo semplicemente zero risultati da questa piattaforma.
  if (!accessKey || !secretKey || !partnerTag) {
    console.warn('[Affiliates/Amazon] Credenziali mancanti, salto questa fonte')
    return []
  }

  const endpoint = `https://${host}/paapi5/searchitems`
  const payload = JSON.stringify({
    Keywords: query,
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    Marketplace: 'www.amazon.it',
    Resources: [
      'Images.Primary.Large',
      'ItemInfo.Title',
      'Offers.Listings.Price',
    ],
  })

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const canonicalHeaders =
    `content-encoding:amz-1.0\n` +
    `host:${host}\n` +
    `x-amz-date:${amzDate}\n` +
    `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`
  const signedHeaders = 'content-encoding;host;x-amz-date;x-amz-target'
  const payloadHash = crypto.createHash('sha256').update(payload).digest('hex')

  const canonicalRequest = [
    'POST',
    '/paapi5/searchitems',
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${SERVICE}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n')

  const signingKey = getSignatureKey(secretKey, dateStamp, region)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-encoding': 'amz-1.0',
        'content-type': 'application/json; charset=utf-8',
        host,
        'x-amz-date': amzDate,
        'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
        Authorization: authorizationHeader,
      },
      body: payload,
    })

    if (!res.ok) {
      console.error('[Affiliates/Amazon] Risposta non ok:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items = data?.SearchResult?.Items || []

    return items.map((item: any): AffiliateProduct => ({
      title: item?.ItemInfo?.Title?.DisplayValue || 'Prodotto Amazon',
      price: item?.Offers?.Listings?.[0]?.Price?.Amount ?? 0,
      currency: item?.Offers?.Listings?.[0]?.Price?.Currency || 'EUR',
      imageUrl: item?.Images?.Primary?.Large?.URL || '',
      affiliateUrl: item?.DetailPageURL || '',
      platform: 'Amazon',
    }))
  } catch (err) {
    console.error('[Affiliates/Amazon] Errore chiamata API:', err)
    return []
  }
}