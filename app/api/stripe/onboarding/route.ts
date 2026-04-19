import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase'; // Assicurati di avere un client Supabase admin se RLS blocca

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  try {
    const { userId, email } = await req.json();

    // 1. Crea account Stripe Express per il venditore
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'IT',
      email: email,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    });

    // 2. Genera link di Onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile`,
      return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/profile?onboarding=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url, accountId: account.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
