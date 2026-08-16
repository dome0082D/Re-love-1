import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
      apiVersion: '2026-03-25.dahlia' 
    });

    const { baratto_id, user_b_id } = await req.json();

    // FIX: prima si creava un vero PaymentIntent su Stripe anche con questi
    // dati mancanti - un addebito reale (seppur destinato a fallire dopo)
    // per una richiesta che non aveva senso fin dall'inizio.
    if (!baratto_id || !user_b_id) {
      return NextResponse.json({ error: 'Dati mancanti (baratto_id o user_b_id)' }, { status: 400 });
    }

    // Crea un pagamento NORMALE per l'Utente B
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 250,
      currency: 'eur',
      metadata: { 
        type: 'baratto_accept',
        baratto_id: baratto_id, // Fondamentale per il Webhook
        user_b: user_b_id 
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}