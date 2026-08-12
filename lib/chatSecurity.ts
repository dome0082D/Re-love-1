// lib/chatSecurity.ts
// Regole condivise per riconoscere tentativi di scambiare link esterni,
// numeri di telefono, email, o accordarsi per pagare fuori dalla
// piattaforma (aggirando la commissione). Usata sia dalla chat privata
// (app/chat/page.tsx) sia dalla chat pubblica della Home (app/page.tsx),
// così la regola è identica ovunque nel sito invece di essere duplicata e
// rischiare di disallinearsi nel tempo.
//
// NOTA IMPORTANTE sui limiti di questo sistema: nessun controllo
// automatico di testo può impedire a due persone di accordarsi A VOCE
// quando si incontrano di persona - cosa che il sito stesso incoraggia
// per baratto, regalo e consegna a mano. Questo elenco intercetta solo i
// tentativi fatti PER ISCRITTO in chat, alzando l'asticella ma senza
// pretesa di bloccare ogni caso possibile.

export function containsForbiddenContact(text: string): boolean {
  const lower = text.toLowerCase()

  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4,}/
  const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(wa\.me\/\d+)|(t\.me\/[a-z0-9_]+)/i

  // NUOVO: un IBAN italiano/europeo tipico (2 lettere + 2 cifre + fino a
  // 30 caratteri alfanumerici) - segno quasi certo che si sta per
  // condividere un dato bancario per un pagamento diretto.
  const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/i

  const suspiciousWords = [
    // Contatti diretti - lista originale
    'numero', 'cell', 'cellulare', 'chiamami', 'scrivimi su', 'whatsapp', 'watsapp',
    'telegram', 'insta', 'instagram', 'mail', 'chiocciola',
    // NUOVO: tentativi di pagamento o accordo fuori dalla piattaforma
    'contanti', 'in nero', 'fuori dall\'app', 'fuori app', 'fuori dalla piattaforma',
    'fuori piattaforma', 'senza commissione', 'senza commissioni', 'saltiamo l\'app',
    'evitiamo relove', 'niente commissione', 'pagamento diretto', 'bonifico',
    'paypal', 'satispay', 'revolut', 'postepay', 'n26',
  ]

  const containsSuspiciousWord = suspiciousWords.some(word => lower.includes(word))

  return (
    phoneRegex.test(lower) ||
    emailRegex.test(lower) ||
    linkRegex.test(lower) ||
    ibanRegex.test(text) ||
    containsSuspiciousWord
  )
}

// Chiama l'endpoint sicuro che blocca entrambi gli utenti coinvolti e
// segnala il caso allo staff. Va chiamata SOLO dopo che
// containsForbiddenContact() ha già restituito true.
export async function reportChatViolation(senderId: string, receiverId: string, messageContent: string): Promise<void> {
  try {
    await fetch('/api/chat/report-violation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, receiverId, messageContent }),
    })
  } catch (err) {
    // Non blocchiamo l'esperienza dell'utente per un errore qui - il
    // messaggio è comunque già stato impedito lato client; se la
    // segnalazione al server fallisce, il peggio che succede è che quel
    // singolo episodio non viene registrato per lo staff.
    console.error('[ChatSecurity] Errore invio segnalazione:', err)
  }
}