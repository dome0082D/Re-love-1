// lib/affiliates/aliexpress.ts
// Integrazione AliExpress Affiliate API (AliExpress Portals).
// Richiede le seguenti variabili d'ambiente su Vercel:
//   ALIEXPRESS_APP_KEY
//   ALIEXPRESS_APP_SECRET
//   ALIEXPRESS_TRACKING_ID

import crypto from 'crypto'
import type { AffiliateProduct } from './types'

const API_URL = 'https://api-sg.aliexpress.com/sync'

function signParams(params: Record<string, string>, appSecret: string): string {
  const sorted = Object.keys(params).sort()
  const base = sorted.map((key) => `${key}${params[key]}`).join('')
  return crypto
    .createHmac('sha256', appSecret)
    .update(base, 'utf8')
    .digest('hex')
    .toUpperCase()
}

export async function fetchAliexpressProducts(query: string): Promise<AffiliateProduct[]> {
  const appKey = process.env.ALIEXPRESS_APP_KEY
  const appSecret = process.env.ALIEXPRESS_APP_SECRET
  const trackingId = process.env.ALIEXPRESS_TRACKING_ID

  if (!appKey || !appSecret || !trackingId) {
    console.warn('[Affiliates/AliExpress] Credenziali mancanti, salto questa fonte')
    return []
  }

  const timestamp = Date.now().toString()

  const params: Record<string, string> = {
    app_key: appKey,
    method: 'aliexpress.affiliate.product.query',
    sign_method: 'hmac-sha256',
    timestamp,
    tracking_id: trackingId,
    keywords: query,
    page_size: '10',
    target_currency: 'EUR',
    target_language: 'IT',
  }

  params.sign = signParams(params, appSecret)

  try {
    const res = await fetch(`${API_URL}?${new URLSearchParams(params).toString()}`, {
      method: 'GET',
    })

    if (!res.ok) {
      console.error('[Affiliates/AliExpress] Risposta non ok:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items =
      data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products
        ?.product || []

    return items.map((item: any): AffiliateProduct => ({
      title: item?.product_title || 'Prodotto AliExpress',
      price: parseFloat(item?.target_sale_price ?? '0'),
      currency: item?.target_sale_price_currency || 'EUR',
      imageUrl: item?.product_main_image_url || '',
      affiliateUrl: item?.promotion_link || item?.product_detail_url || '',
      platform: 'AliExpress',
    }))
  } catch (err) {
    console.error('[Affiliates/AliExpress] Errore chiamata API:', err)
    return []
  }
}