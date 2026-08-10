// lib/affiliates/types.ts
// Tipo standard a cui vengono normalizzati i risultati di TUTTE le piattaforme
// (Amazon, eBay, AliExpress), così il frontend riceve sempre la stessa forma.

export interface AffiliateProduct {
  title: string
  price: number
  currency: string
  imageUrl: string
  affiliateUrl: string // link finale, già col tag/tracking di affiliazione
  platform: 'Amazon' | 'eBay' | 'AliExpress'
}