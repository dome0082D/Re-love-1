// lib/affiliates/index.ts
import { searchAmazon } from './amazon'
import { searchEbay } from './ebay'
import { searchAliExpress } from './aliexpress'
import type { AffiliateProduct } from './types'

export type { AffiliateProduct }

// Esegue le tre ricerche in parallelo con Promise.allSettled: se una fonte
// fallisce (credenziali non ancora attive, API momentaneamente giù, timeout),
// le altre due continuano a restituire risultati regolarmente invece di
// bloccare l'intera ricerca.
export async function fetchAffiliateProducts(query: string): Promise<AffiliateProduct[]> {
  const results = await Promise.allSettled([
    searchAmazon(query),
    searchEbay(query),
    searchAliExpress(query),
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