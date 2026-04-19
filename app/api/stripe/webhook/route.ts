import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event;
  try {
    // In produzione aggiungerai STRIPE_WEBHOOK_SECRET nel file .env.local
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Se il pagamento è andato a buon fine
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { announcementId, buyerId, sellerId } = session.metadata || {};

    if (announcementId && buyerId && sellerId) {
       // Salva la transazione nel DB con stato "held" (Fondi Trattenuti/Escrow)
       await supabase.from('transactions').insert([{
         announcement_id: announcementId,
         buyer_id: buyerId,
         seller_id: sellerId,
         stripe_payment_intent_id: session.payment_intent,
         amount: session.amount_total ? session.amount_total / 100 : 0,
         status: 'held' 
       }]);
    }
  }

  return NextResponse.json({ received: true });
}
