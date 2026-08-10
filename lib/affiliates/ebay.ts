// lib/affiliates/ebay.ts
// Integrazione eBay Browse API + eBay Partner Network (per il tracking commissioni).
// Richiede le seguenti variabili d'ambiente su Vercel:
//   EBAY_CLIENT_ID
//   EBAY_CLIENT_SECRET
//   EBAY_CAMPAIGN_ID   (il tuo Campaign ID di eBay Partner Network)

import type { AffiliateProduct } from './types'

let cachedToken: { value: string; expiresAt: number } | null = null

async function getEbayAccessToken(): Promise<string | null> {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('[Affiliates/eBay] Credenziali mancanti, salto questa fonte')
    return null
  }

  // Riusiamo il token finché non sta per scadere, invece di richiederne uno
  // nuovo ad ogni ricerca.
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  try {
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    })

    if (!res.ok) {
      console.error('[Affiliates/eBay] Errore ottenimento token:', res.status)
      return null
    }

    const data = await res.json()
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    }
    return cachedToken.value
  } catch (err) {
    console.error('[Affiliates/eBay] Errore rete durante ottenimento token:', err)
    return null
  }
}

function applyCampaignId(url: string, campaignId: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('campid', campaignId)
    return u.toString()
  } catch {
    return url
  }
}

export async function fetchEbayProducts(query: string): Promise<AffiliateProduct[]> {
  const campaignId = process.env.EBAY_CAMPAIGN_ID
  const token = await getEbayAccessToken()

  if (!token || !campaignId) {
    return []
  }

  try {
    const res = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_IT',
        },
      }
    )

    if (!res.ok) {
      console.error('[Affiliates/eBay] Risposta non ok:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items = data?.itemSummaries || []

    return items.map((item: any): AffiliateProduct => ({
      title: item?.title || 'Prodotto eBay',
      price: parseFloat(item?.price?.value ?? '0'),
      currency: item?.price?.currency || 'EUR',
      imageUrl: item?.image?.imageUrl || '',
      affiliateUrl: applyCampaignId(item?.itemWebUrl || '', campaignId),
      platform: 'eBay',
    }))
  } catch (err) {
    console.error('[Affiliates/eBay] Errore chiamata API:', err)
    return []
  }
}