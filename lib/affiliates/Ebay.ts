// lib/affiliates/ebay.ts
//
// Integrazione con eBay Browse API + eBay Partner Network (ePN) per il
// tracking delle commissioni. Usa OAuth 2.0 Client Credentials - non serve
// che nessun utente faccia login su eBay, è un'autenticazione a livello di
// applicazione.

import type { AffiliateProduct } from './types'

const CLIENT_ID = process.env.EBAY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || ''
// ID campagna eBay Partner Network - senza questo i prodotti si trovano
// comunque, ma il link non genera nessuna commissione.
const CAMPAIGN_ID = process.env.EBAY_CAMPAIGN_ID || ''
const MARKETPLACE_ID = process.env.EBAY_MARKETPLACE_ID || 'EBAY_IT'

// Il token OAuth dura tipicamente ~2 ore: lo teniamo in cache in memoria tra
// una richiesta e l'altra invece di richiederne uno nuovo ad ogni ricerca.
let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.warn('[eBay] Credenziali mancanti (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET) - salto la ricerca.')
    return null
  }

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

  try {
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    })

    if (!res.ok) {
      console.error('[eBay] Errore ottenimento token:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    // Rinnoviamo 2 minuti prima della scadenza reale, per margine di sicurezza
    cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 120) * 1000 }
    return cachedToken.value
  } catch (err) {
    console.error('[eBay] Richiesta token fallita:', err)
    return null
  }
}

export async function searchEbay(query: string): Promise<AffiliateProduct[]> {
  const token = await getAccessToken()
  if (!token) return []

  try {
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(query)}&limit=6`

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_ID,
    }

    // Senza questo header, eBay restituisce comunque i prodotti ma NON il
    // campo itemAffiliateWebUrl - niente commissione sulle vendite generate.
    if (CAMPAIGN_ID) {
      headers['X-EBAY-C-ENDUSERCTX'] = `affiliateCampaignId=${CAMPAIGN_ID}`
    }

    const res = await fetch(url, { headers })

    if (!res.ok) {
      console.error('[eBay] Errore ricerca:', res.status, await res.text())
      return []
    }

    const data = await res.json()
    const items = data?.itemSummaries || []

    return items
      .map((item: any): AffiliateProduct => ({
        title: item.title || 'Prodotto eBay',
        price: item?.price?.value ? Number(item.price.value) : 0,
        currency: item?.price?.currency || 'EUR',
        imageUrl: item?.image?.imageUrl || item?.thumbnailImages?.[0]?.imageUrl || '',
        // Se manca l'affiliazione (niente CAMPAIGN_ID, o eBay non la restituisce
        // per questo prodotto), usiamo il link normale come fallback - meglio
        // un link funzionante senza commissione che nessun link.
        affiliateUrl: item.itemAffiliateWebUrl || item.itemWebUrl || '',
        platform: 'eBay',
      }))
      .filter((p: AffiliateProduct) => p.affiliateUrl)
  } catch (err) {
    console.error('[eBay] Richiesta fallita:', err)
    return []
  }
}