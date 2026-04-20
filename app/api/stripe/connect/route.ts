// File: app/api/stripe/connect/route.ts
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-03-25.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "User ID mancante" }, { status: 400 });
    }

    // Crea un account Stripe Express per il venditore
    const account = await stripe.accounts.create({
      type: 'express',
      metadata: { supabase_user_id: userId }
    });

    // Salva l'ID dell'account Stripe nel database Supabase
    await supabase.from('profiles').update({ stripe_account_id: account.id }).eq('id', userId);

    // Crea il link per l'onboarding (dove l'utente inserisce l'IBAN)
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get('origin')}/profile?stripe=refresh`,
      return_url: `${req.headers.get('origin')}/profile?stripe=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("Stripe Connect Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
