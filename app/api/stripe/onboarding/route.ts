export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as any,
});

// IL TRUCCO: Creiamo un client Admin (con la chiave di servizio) per bypassare il blocco di sicurezza (RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

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

    // 2. Salva l'ID su Supabase forzando la scrittura con supabaseAdmin
    const { error: dbError } = await supabaseAdmin
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