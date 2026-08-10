// lib/affiliates/index.ts
// Funzione "manager": interroga le tre piattaforme IN PARALLELO e unisce i
// risultati in un unico array. Usa Promise.allSettled così, se una fonte va
// in errore o le credenziali non sono configurate, le altre due continuano
// a funzionare normalmente.

import { fetchAmazonProducts } from './amazon'
import { fetchEbayProducts } from './ebay'
import { fetchAliexpressProducts } from './aliexpress'
import type { AffiliateProduct } from './types'

export type { AffiliateProduct }

export async function fetchAffiliateProducts(query: string): Promise<AffiliateProduct[]> {
  const results = await Promise.allSettled([
    fetchAmazonProducts(query),
    fetchEbayProducts(query),
    fetchAliexpressProducts(query),
  ])

  const products: AffiliateProduct[] = []

  for (const result of results) {
    if (result.status === 'fulfilled') {
      products.push(...result.value)
    } else {
      console.error('[Affiliates] Una fonte ha fallito:', result.reason)
    }
  }

  return products
}