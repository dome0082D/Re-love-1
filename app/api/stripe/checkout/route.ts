import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  try {
    const { announcementId, buyerId, sellerId, amount, title } = await req.json();

    // 1. Controlla se il venditore ha attivato Stripe
    const { data: seller } = await supabase.from('profiles').select('stripe_account_id').eq('id', sellerId).single();
    
    if (!seller || !seller.stripe_account_id) {
       return NextResponse.json({ error: "Il venditore non ha ancora attivato i pagamenti sicuri." }, { status: 400 });
    }

    // 2. Calcola la tua commissione (10%)
    const fee = Math.round(amount * 100 * 0.10);

    // 3. Crea la sessione Escrow
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { currency: 'eur', product_data: { name: title }, unit_amount: Math.round(amount * 100) },
        quantity: 1,
      }],
      mode: 'payment',
      payment_intent_data: {
        capture_method: 'manual', // I soldi vengono bloccati, NON incassati subito
        transfer_data: { destination: seller.stripe_account_id },
        application_fee_amount: fee,
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/announcement/${announcementId}?payment=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/announcement/${announcementId}`,
      metadata: { announcementId, buyerId, sellerId } // Dati passati al Webhook
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
