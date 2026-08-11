// lib/chatSecurity.ts
// Regole condivise per riconoscere tentativi di scambiare link esterni,
// numeri di telefono o email in chat. Usata sia dalla chat privata
// (app/chat/page.tsx) sia dalla chat pubblica della Home (app/page.tsx),
// così la regola è identica ovunque nel sito invece di essere duplicata e
// rischiare di disallinearsi nel tempo.

export function containsForbiddenContact(text: string): boolean {
  const lower = text.toLowerCase()

  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4,}/
  const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(wa\.me\/\d+)|(t\.me\/[a-z0-9_]+)/i
  const suspiciousWords = ['numero', 'cell', 'cellulare', 'chiamami', 'scrivimi su', 'whatsapp', 'watsapp', 'telegram', 'insta', 'instagram', 'mail', 'chiocciola']

  const containsSuspiciousWord = suspiciousWords.some(word => lower.includes(word))

  return phoneRegex.test(lower) || emailRegex.test(lower) || linkRegex.test(lower) || containsSuspiciousWord
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