// lib/mail.ts
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

const resend = getResendClient();

// ============================================================================
// ⚠️ ATTENZIONE - LEGGI PRIMA DI ANDARE IN PRODUZIONE
//
// L'indirizzo mittente "onboarding@resend.dev" è il dominio di PROVA di
// Resend, e per loro regola documentata può inviare SOLO all'indirizzo email
// con cui hai registrato l'account Resend. Qualsiasi email diretta a un
// utente diverso da te viene RIFIUTATA dal server con errore 403.
//
// Combinato con il difetto corretto qui sotto (gli errori venivano
// ingoiati in silenzio), il risultato era: nessuna email arrivava mai a
// nessun utente reale, e nei log non compariva niente.
//
// PER RISOLVERE DAVVERO: verifica un tuo dominio su resend.com/domains e
// sostituisci l'indirizzo qui sotto con uno di quel dominio
// (es. "Re-love <info@re-love.it>"). Finché non lo fai, le email
// funzioneranno solo verso il tuo indirizzo personale.
// ============================================================================
const FROM_ADDRESS = 'Re-love <onboarding@resend.dev>';

// Protegge da contenuti che finiscono dentro l'HTML dell'email. Titoli
// di annunci, nomi utente, descrizioni di controversie: sono tutti testi
// scritti dagli utenti, e senza questa protezione un utente malintenzionato
// potrebbe inserire tag HTML (o link travestiti) nelle email che il sito
// invia ad ALTRI utenti a nome di Re-love.
function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Nel corpo del messaggio conserviamo gli a capo (che altrimenti nell'HTML
// sparirebbero) convertendoli in <br> DOPO aver messo in sicurezza il testo.
function escapeBody(text: string): string {
  return escapeHtml(text).replace(/\r?\n/g, '<br>');
}

export const sendReLoveEmail = async (
  to: string,
  subject: string,
  title: string,
  body: string,
  buttonText?: string,
  buttonUrl?: string
): Promise<{ ok: boolean; error?: string }> => {
  // FIX: senza chiave configurata, la libreria fallisce in modo poco chiaro.
  // Meglio dirlo subito ed esplicitamente.
  if (!resend) {
    console.error('Errore invio email: RESEND_API_KEY non configurata.');
    return { ok: false, error: 'RESEND_API_KEY non configurata' };
  }

  // Un URL controllato dall'utente dentro href="..." potrebbe uscire
  // dall'attributo e iniettare altro codice: consentiamo solo http/https.
  let safeButtonUrl: string | null = null;
  if (buttonUrl) {
    try {
      const parsed = new URL(buttonUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        safeButtonUrl = parsed.toString();
      }
    } catch {
      safeButtonUrl = null;
    }
  }

  try {
    // FIX IMPORTANTE: il client Resend NON lancia eccezioni per gli errori
    // dell'API (destinatario rifiutato, dominio non verificato, limite di
    // invii superato): restituisce { data, error }. Il try/catch da solo
    // intercettava quindi solo i guasti di rete, e ogni errore vero passava
    // inosservato - questa funzione riportava "tutto ok" anche quando
    // l'email non era mai partita. È lo stesso identico difetto già
    // corretto in app/api/notofy/route.ts.
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 24px; overflow: hidden;">
          <div style="background: linear-gradient(to right, #f43f5e, #fb923c); padding: 40px 20px; text-align: center;">
            <h1 style="color: white; text-transform: uppercase; font-style: italic; margin: 0; letter-spacing: -1px;">Re-love</h1>
          </div>
          <div style="padding: 40px; background-color: white;">
            <h2 style="color: #1c1917; text-transform: uppercase; font-style: italic; font-size: 20px;">${escapeHtml(title)}</h2>
            <p style="color: #78716c; line-height: 1.6; font-size: 14px;">${escapeBody(body)}</p>
            ${buttonText && safeButtonUrl ? `
              <div style="margin-top: 30px; text-align: center;">
                <a href="${escapeHtml(safeButtonUrl)}" style="background-color: #1c1917; color: white; padding: 16px 32px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">${escapeHtml(buttonText)}</a>
              </div>
            ` : ''}
          </div>
          <div style="background-color: #fafaf9; padding: 20px; text-align: center; border-top: 1px solid #f5f5f4;">
            <p style="color: #a8a29e; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 0;">
              Re-love: Riusa, Scambia, Regala.
            </p>
          </div>
        </div>
      `
    });

    if (error) {
      console.error('Errore invio email (Resend):', error);
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: unknown }).message
        : undefined;
      return { ok: false, error: typeof message === 'string' ? message : 'Errore invio email' };
    }

    return { ok: true };
  } catch (error: unknown) {
    console.error('Errore invio email (connessione):', error);
    const message = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: unknown }).message
      : undefined;
    return { ok: false, error: typeof message === 'string' ? message : 'Errore di connessione' };
  }
};