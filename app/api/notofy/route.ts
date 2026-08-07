import { NextResponse } from 'next/server';
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

const resend = getResendClient();

export async function POST(req: Request) {
  try {
    const { to, subject, htmlContent } = await req.json();

    if (!to || !subject || !htmlContent) {
      return NextResponse.json({ error: "Dati mancanti per l'invio dell'email" }, { status: 400 });
    }

    if (!resend) {
      return NextResponse.json({ error: "RESEND_API_KEY non configurata" }, { status: 500 });
    }

    const { data, error } = await resend.emails.send({
      from: 'Re-love Notifiche <onboarding@resend.dev>', // Email di test fornita da Resend
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h1 style="color: #f43f5e; font-style: italic; text-transform: uppercase;">Re-love</h1>
          <div style="margin-top: 20px; color: #374151; line-height: 1.6;">
            ${htmlContent}
          </div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://re-love-rouge.vercel.app'}" style="background-color: #1c1917; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
              Apri Re-love
            </a>
          </div>
          <p style="margin-top: 30px; font-size: 10px; color: #9ca3af; text-align: center;">
            Ricevi questa email perché sei registrato su Re-love.
          </p>
        </div>
      `
    });

    // FIX: Resend non lancia un'eccezione per un invio fallito (indirizzo non
    // valido, rate limit, dominio non verificato) - restituisce { data, error }.
    // Senza questo controllo, un invio fallito rispondeva comunque "success: true".
    if (error) {
      console.error("Errore Resend:", error);
      return NextResponse.json({ error: "Invio email fallito: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Errore Invio Email:", error);
    return NextResponse.json({ error: "Errore interno durante l'invio dell'email" }, { status: 500 });
  }
}