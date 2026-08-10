// lib/affiliates/amazonTag.ts
// Logica di affiliazione Amazon:
//   - Se il link Amazon incollato NON ha già un tag di affiliazione,
//     viene aggiunto il TUO tag di default (AMAZON_PARTNER_TAG).
//   - Se il link ha GIÀ un tag (perché chi pubblica è a sua volta un
//     affiliato Amazon con un proprio account), quel tag viene
//     rispettato e lasciato invariato - non viene sovrascritto.
//     In questo modo ogni link genera la commissione per chi lo ha
//     davvero pubblicato: il tuo tag di default, o il tag proprio
//     dell'utente se lo ha già inserito.
//
// Richiede la variabile d'ambiente su Vercel:
//   AMAZON_PARTNER_TAG   (il TUO tag, es. "relove-21")

/**
 * Riconosce se un URL è un dominio Amazon (incluse le versioni locali:
 * amazon.it, amazon.com, amazon.de, ecc. e i link accorciati amzn.to).
 */
export function isAmazonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes('amazon.') || host.includes('amzn.to') || host.includes('amzn.eu')
  } catch {
    return false
  }
}

/**
 * Aggiunge il TUO tag di affiliazione Amazon di default a un URL, ma solo
 * se quell'URL non ha già un tag di affiliazione proprio (nel qual caso lo
 * lascia invariato, rispettando l'affiliazione di chi ha pubblicato il
 * link). Se l'URL non è di Amazon, o se AMAZON_PARTNER_TAG non è
 * configurato, restituisce il link intatto.
 */
export function aggiungiTagAffiliazioneAmazon(url: string): string {
  const partnerTag = process.env.AMAZON_PARTNER_TAG

  if (!partnerTag) {
    console.warn('[Affiliates] AMAZON_PARTNER_TAG non configurato, link lasciato invariato')
    return url
  }

  if (!isAmazonUrl(url)) {
    return url
  }

  try {
    const u = new URL(url)

    // Se il link ha già un tag (chi pubblica ha un proprio account
    // affiliato Amazon), lo rispettiamo e non lo tocchiamo: la
    // commissione va a lui.
    const tagEsistente = u.searchParams.get('tag')
    if (tagEsistente && tagEsistente.trim() !== '') {
      return url
    }

    // Nessun tag presente: applichiamo il nostro di default.
    u.searchParams.set('tag', partnerTag)
    return u.toString()
  } catch {
    // Se per qualche motivo l'URL non è valido, meglio restituire
    // l'originale piuttosto che rompere il link.
    return url
  }
}