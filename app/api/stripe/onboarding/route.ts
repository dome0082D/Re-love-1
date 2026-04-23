export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as any,
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID mancante" }, { status: 400 });

    // 1. Crea account Express
    const account = await stripe.accounts.create({ 
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // 2. Salva l'ID su Supabase
    const { error: dbError } = await supabase
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', userId);

    if (dbError) throw new Error("Errore salvataggio database: " + dbError.message);

    // 3. Genera link (SCRIVIAMO L'URL DIRETTO PER EVITARE ERRORI HTTPS)
    const siteUrl = 'https://re-love-rouge.vercel.app';

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/profile`,
      return_url: `${siteUrl}/profile?onboarding=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    console.error("ERRORE ONBOARDING:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}