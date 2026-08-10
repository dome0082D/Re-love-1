// lib/affiliates/types.ts
export interface AffiliateProduct {
  title: string
  price: number
  currency: string
  imageUrl: string
  affiliateUrl: string // Link pronto per generare la commissione
  platform: 'Amazon' | 'eBay' | 'AliExpress'
}