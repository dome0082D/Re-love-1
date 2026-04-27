export const dynamic = 'force-dynamic'; // CORRETTO: e minuscola!
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { 
  apiVersion: '2023-10-16' as any 
});

export async function POST(req: Request) {
  try {
    // RECUPERO I DATI MANDATI DAL FRONTEND
    const { announcementId, buyerId } = await req.json();

    if (!announcementId || !buyerId) {
      return NextResponse.json({ error: "Dati annuncio o utente mancanti" }, { status: 400 });
    }

    // Usiamo l'origin direttamente dalla richiesta così è sempre valido al 100% (localhost o Vercel)
    const origin = req.headers.get('origin') || 'https://re-love-rouge.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { 
              name: 'Sblocco Chat Re-love', 
              description: 'Accesso illimitato alla chat per questo annuncio' 
            },
            unit_amount: 250, // 2.50€
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // AGGIUNTO METADATA: Senza questi il Webhook non sblocca nulla!
      metadata: {
        type: 'chat_unlock',
        announcementId: announcementId,
        buyerId: buyerId,
      },
      // CORREZIONE URL: Usiamo origin
      success_url: `${origin}/announcement/${announcementId}?unlocked=true`,
      cancel_url: `${origin}/announcement/${announcementId}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Errore Stripe Sblocco Chat:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}