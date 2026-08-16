import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Avvio spostato dentro anche qui
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
      apiVersion: '2026-03-25.dahlia' 
    });
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { userA_id, userB_id, item_id } = await req.json();

    // FIX: stessa protezione di accept-payment - evita di creare un vero
    // PaymentIntent Stripe per una richiesta con dati mancanti.
    if (!userA_id || !userB_id || !item_id) {
      return NextResponse.json({ error: 'Dati mancanti (userA_id, userB_id o item_id)' }, { status: 400 });
    }

    // 1. Crea il PaymentIntent Manuale per Utente A
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 250, // 2.50€ in centesimi
      currency: 'eur',
      payment_method_types: ['card'],
      capture_method: 'manual', // FONDAMENTALE: Solo Pre-autorizzazione!
      metadata: { 
        type: 'baratto_auth',
        item_id: item_id, 
        user_a: userA_id 
      },
    });

    // 2. Salva la richiesta di baratto nel tuo Database Supabase
    const { error } = await supabase.from('baratti').insert({
      item_id: item_id,
      user_a_id: userA_id,
      user_b_id: userB_id,
      stripe_pi_user_a: paymentIntent.id, 
      status: 'pending_user_b' 
    });

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      clientSecret: paymentIntent.client_secret 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}