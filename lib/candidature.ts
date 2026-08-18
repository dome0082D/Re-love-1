// lib/candidature.ts
//
// ============================================================================
// REGOLE CONDIVISE DELLE CANDIDATURE CURATORE
//
// Stanno qui, in un punto solo, perché servono identiche al browser (per
// mostrare o nascondere il pulsante) e al server (per decidere davvero). Se
// vivessero solo nell'interfaccia, una richiesta costruita a mano le
// scavalcherebbe; se vivessero solo nel server, l'utente scoprirebbe di non
// poter fare una cosa solo dopo averci provato.
// ============================================================================

export const STATI_CANDIDATURA = {
  inAttesa: 'in_attesa',
  accettata: 'accettata',
  rifiutata: 'rifiutata',
  revocata: 'revocata',
} as const

export type StatoCandidatura = (typeof STATI_CANDIDATURA)[keyof typeof STATI_CANDIDATURA]

/** Commissione Re-love, fissa. Il resto si divide fra Proprietario e Curatore. */
export const PERCENTUALE_RELOVE = 10

/** Quanto si può cedere al curatore, al massimo. */
export const MASSIMO_AL_CURATORE = 100 - PERCENTUALE_RELOVE

export const PERCENTUALE_CURATORE_PREDEFINITA = 20

export const ETICHETTE_STATO: Record<StatoCandidatura, { testo: string; colore: string }> = {
  in_attesa: { testo: 'In attesa di risposta', colore: 'bg-orange-100 text-orange-600' },
  accettata: { testo: 'Accettata', colore: 'bg-emerald-100 text-emerald-600' },
  rifiutata: { testo: 'Rifiutata', colore: 'bg-stone-200 text-stone-500' },
  revocata: { testo: 'Revocata', colore: 'bg-rose-100 text-rose-600' },
}

/** Quota che resta al Proprietario, dato quanto cede al Curatore. */
export function quotaProprietario(percentualeCuratore: number): number {
  return MASSIMO_AL_CURATORE - percentualeCuratore
}

export function percentualeValida(valore: unknown): boolean {
  const n = Number(valore)
  return Number.isFinite(n) && n >= 0 && n <= MASSIMO_AL_CURATORE
}

/** Dati minimi di un annuncio che servono per decidere sulle candidature. */
export interface AnnuncioPerCandidatura {
  user_id: string
  cerca_curatore?: boolean | null
  curator_id?: string | null
  is_arena?: boolean | null
}

/** Da dove è partita la candidatura: le due pagine che possono ospitarla. */
export type ContestoCandidatura = 'arena' | 'annuncio'

/**
 * Perché questo utente NON può candidarsi su questo annuncio. null = può.
 *
 * La regola sull'Arena viene dalla richiesta: un oggetto in Arena si candida
 * solo dalla pagina Arena, dove sono spiegate le sue condizioni (la gara di
 * promozione, il blocco temporale), e non dalla scheda normale dove non se ne
 * vede traccia.
 */
export function motivoNonCandidabile(
  annuncio: AnnuncioPerCandidatura,
  utenteId: string | null,
  contesto: ContestoCandidatura
): string | null {
  if (!utenteId) return 'Accedi per candidarti come curatore.'
  if (annuncio.user_id === utenteId) return 'Questo oggetto è già tuo: non puoi candidarti a venderlo per conto tuo.'
  if (annuncio.curator_id) {
    return annuncio.curator_id === utenteId
      ? 'Sei già il curatore di questo oggetto.'
      : 'Questo oggetto ha già un curatore.'
  }
  if (!annuncio.cerca_curatore) return 'Il proprietario di questo oggetto non sta cercando un curatore.'

  const inArena = !!annuncio.is_arena
  if (inArena && contesto !== 'arena') {
    return 'Questo oggetto è in Arena: puoi candidarti solo dalla pagina Arena.'
  }
  if (!inArena && contesto !== 'annuncio') {
    return "Questo oggetto non è in Arena: puoi candidarti solo dalla sua scheda."
  }
  return null
}
