import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// Assicurati di avere STRIPE_SECRET_KEY nel tuo file .env.local
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as any, // Usa la versione stabile recente
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID mancante" }, { status: 400 });

    // 1. Crea account venditore su Stripe
    const account = await stripe.accounts.create({ type: 'express' });

    // 2. Salva l'ID su Supabase
    await supabase.from('profiles').update({ stripe_account_id: account.id }).eq('id', userId);

    // 3. Genera il link per far inserire l'IBAN al venditore
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get('origin')}/profile`,
      return_url: `${req.headers.get('origin')}/profile?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
