import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Diciamo a Vercel di non processarlo in fase di caricamento
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // Avvio spostato QUI DENTRO!
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-03-25.dahlia' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Se il pagamento dell'Utente B è andato a buon fine...
  if (event.type === 'payment_intent.succeeded') {
    const session = event.data.object as Stripe.PaymentIntent;

    if (session.metadata.type === 'baratto_accept') {
      const barattoId = session.metadata.baratto_id;

      // 1. Recuperiamo l'ID del pagamento dell'Utente A dal DB
      const { data: baratto } = await supabase.from('baratti').select('*').eq('id', barattoId).single();

      if (baratto && baratto.stripe_pi_user_a) {
        // 2. CATTURIAMO i soldi dell'Utente A!
        await stripe.paymentIntents.capture(baratto.stripe_pi_user_a);

        // 3. Sblocchiamo la chat nel DB
        await supabase.from('baratti').update({ status: 'accepted_chat_unlocked' }).eq('id', barattoId);
      }
    }
  }

  return NextResponse.json({ received: true });
}