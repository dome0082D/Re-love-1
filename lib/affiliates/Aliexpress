// lib/affiliates/aliexpress.ts
//
// Integrazione con l'AliExpress Affiliate API (metodo aliexpress.affiliate.product.query),
// esposta tramite il gateway "Taobao Open Platform" che AliExpress condivide
// con Alibaba/Taobao. La firma non è OAuth2 né AWS SigV4, ma uno schema
// proprietario MD5: si ordinano i parametri alfabeticamente, si concatenano
// come chiave+valore senza separatori, si racchiude il risultato tra due
// copie dell'App Secret, e si fa l'hash MD5 in maiuscolo.

import crypto from 'crypto'
import type { AffiliateProduct } from './types'

const APP_KEY = process.env.ALIEXPRESS_APP_KEY || ''
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET || ''
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID || ''
const API_URL = 'https://api-sg.aliexpress.com/sync'

function signParams(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort()
  const concatenated = sortedKeys.reduce((acc, key) => `${acc}${key}${params[key]}`, '')
  const wrapped = `${APP_SECRET}${concatenated}${APP_SECRET}`
  return crypto.createHash('md5').update(wrapped, 'utf8').digest('hex').toUpperCase()
}

export async function searchAliExpress(query: string): Promise<AffiliateProduct[]> {
  if (!APP_KEY || !APP_SECRET || !TRACKING_ID) {
    console.warn('[AliExpress] Credenziali mancanti (ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / ALIEXPRESS_TRACKING_ID) - salto la ricerca.')
    return []
  }

  const params: Record<string, string> = {
    method: 'aliexpress.affiliate.product.query',
    app_key: APP_KEY,
    sign_method: 'md5',
    timestamp: String(Date.now()),
    v: '2.0',
    format: 'json',
    keywords: query,
    tracking_id: TRACKING_ID,
    target_currency: 'EUR',
    target_language: 'IT',
    page_size: '6',
  }

  const sign = signParams(params)
  const body = new URLSearchParams({ ...params, sign })

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    })

    if (!res.ok) {
      console.error('[AliExpress] Errore HTTP:', res.status, await res.text())
      return []
    }

    const data = await res.json()

    // Il gateway TOP risponde comunque con status HTTP 200 anche in caso di
    // errore applicativo (chiave sbagliata, firma non valida, ecc.) - il
    // vero esito va controllato nel campo "error_response" del corpo.
    if (data?.error_response) {
      console.error('[AliExpress] Errore API:', data.error_response)
      return []
    }

    const items =
      data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product || []

    return items
      .map((item: any): AffiliateProduct => ({
        title: item.product_title || 'Prodotto AliExpress',
        price: parseFloat(item.target_sale_price || item.sale_price || '0'),
        currency: item.target_sale_price_currency || item.sale_price_currency || 'EUR',
        imageUrl: item.product_main_image_url || '',
        affiliateUrl: item.promotion_link || item.product_detail_url || '',
        platform: 'AliExpress',
      }))
      .filter((p: AffiliateProduct) => p.affiliateUrl)
  } catch (err) {
    console.error('[AliExpress] Richiesta fallita:', err)
    return []
  }
}