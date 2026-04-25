export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza Stripe con la tua chiave segreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25' as any,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { announcementId, userId } = body;

    if (!announcementId || !userId) {
      return new NextResponse("Dati mancanti", { status: 400 });
    }

    // Creiamo la sessione di pagamento su Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Sponsorizzazione Vetrina Top ✨',
              description: 'Il tuo annuncio sarà messo in prima fila per 7 giorni.',
            },
            unit_amount: 200, // 2.00 €
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // AGGIUNTA FONDAMENTALE: Diciamo a Stripe chi sta pagando e per cosa
      metadata: {
        type: 'sponsorship',
        announcementId: announcementId,
        userId: userId,
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/annunci?success=true&ad_id=${announcementId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/dashboard/annunci?canceled=true`,
    });

    // Rispondiamo al sito con il link alla pagina di pagamento sicura di Stripe
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Errore Stripe Sponsor:", error);
    return new NextResponse("Errore interno", { status: 500 });
  }
}