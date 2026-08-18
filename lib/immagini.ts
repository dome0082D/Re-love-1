// lib/immagini.ts
//
// ============================================================================
// FOTO DELLA MISURA GIUSTA.
//
// Il problema, misurato sulle foto vere del sito: gli annunci hanno immagini
// come le scatta il telefono - fino a 3,6 MB, 3264x2448 pixel - mostrate
// dentro riquadri alti 160. Il browser scaricava tutti e 3,6 i MB, li
// decomprimeva in memoria (oltre 30 MB di pixel per foto) e poi li rimpiccioliva
// venti volte da solo. Con qualche annuncio in pagina, questo e' abbastanza
// per far scattare lo scorrimento su qualsiasi telefono.
//
// E il risultato era anche PIU' BRUTTO: rimpicciolire di venti volte in un
// colpo solo, come fa il browser, produce bordi seghettati e dettagli
// sgranati. Ridimensionare sul server, con un algoritmo fatto apposta, da'
// un'immagine piu' nitida.
//
// Supabase sa farlo (verificato su questo progetto: risponde 200 e restituisce
// WebP). Stessa foto: 3657 KB -> 217 KB alla misura giusta per uno schermo
// retina. Diciassette volte piu' leggera, e piu' definita.
//
// Le foto che NON stanno su Supabase (i link esterni della Vetrina, per
// esempio le immagini Amazon) tornano intatte: non sono roba nostra e non
// possiamo ridimensionarle.
// ============================================================================

const PERCORSO_ORIGINALE = '/storage/v1/object/public/'
const PERCORSO_TRASFORMATO = '/storage/v1/render/image/public/'

/** Larghezza massima accettata da Supabase per le trasformazioni. */
const LARGHEZZA_MASSIMA = 2500

export interface OpzioniFoto {
  /** 'cover' riempie il riquadro tagliando; 'contain' entra tutta. */
  taglio?: 'cover' | 'contain'
  /** 1-100. Sotto 70 si iniziano a vedere gli artefatti. */
  qualita?: number
}

/**
 * Indirizzo della foto alla larghezza richiesta.
 *
 * @param larghezza Larghezza in pixel CSS a cui la foto viene MOSTRATA. Il
 *                  raddoppio per gli schermi ad alta densità lo fa già
 *                  srcSetFoto(): qui si passa la misura reale del riquadro.
 */
export function srcFoto(
  url: string | null | undefined,
  larghezza: number,
  opzioni: OpzioniFoto = {}
): string {
  if (!url) return ''
  if (!url.includes(PERCORSO_ORIGINALE)) return url

  const { taglio = 'cover', qualita = 75 } = opzioni
  const w = Math.min(Math.round(larghezza), LARGHEZZA_MASSIMA)

  const base = url.replace(PERCORSO_ORIGINALE, PERCORSO_TRASFORMATO)
  // Un indirizzo di Supabase Storage non ha già parametri, ma se un domani
  // ne avesse (un token di firma) non li buttiamo via.
  const separatore = base.includes('?') ? '&' : '?'
  return `${base}${separatore}width=${w}&resize=${taglio}&quality=${qualita}`
}

/**
 * Elenco per l'attributo srcSet: la stessa foto a densità singola e doppia.
 * Il browser sceglie da solo quale scaricare in base allo schermo, così un
 * telefono retina ottiene una foto davvero nitida e un monitor normale non
 * scarica il doppio del necessario.
 */
export function srcSetFoto(
  url: string | null | undefined,
  larghezza: number,
  opzioni: OpzioniFoto = {}
): string | undefined {
  if (!url || !url.includes(PERCORSO_ORIGINALE)) return undefined
  return [
    `${srcFoto(url, larghezza, opzioni)} 1x`,
    `${srcFoto(url, larghezza * 2, opzioni)} 2x`,
  ].join(', ')
}

/**
 * Tutto quello che serve a un <img>, in un colpo solo:
 *
 *   <img {...propsFoto(url, 400)} className="..." alt="..." />
 *
 * Comprende il caricamento pigro e la decodifica fuori dal filo principale:
 * senza "decoding=async" il browser puo' bloccare il disegno della pagina
 * mentre decomprime una foto, ed e' un'altra causa di scatti.
 */
export function propsFoto(
  url: string | null | undefined,
  larghezza: number,
  opzioni: OpzioniFoto = {}
) {
  return {
    src: srcFoto(url, larghezza, opzioni),
    srcSet: srcSetFoto(url, larghezza, opzioni),
    loading: 'lazy' as const,
    decoding: 'async' as const,
  }
}
