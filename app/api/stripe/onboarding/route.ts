export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    // 1. SPOSTATO QUI DENTRO: Inizializziamo Stripe e Supabase solo quando serve.
    // Così evitiamo che Vercel vada in crash durante la fase di Build!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-03-25.dahlia',
    });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID mancante" }, { status: 400 });

    // 2. Crea account Express
    const account = await stripe.accounts.create({ 
      type: 'express',
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // 3. Salva l'ID su Supabase forzando la scrittura con supabaseAdmin
    const { error: dbError } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_account_id: account.id })
      .eq('id', userId);

    if (dbError) throw new Error("Errore salvataggio database: " + dbError.message);

    // 4. Genera link (SCRIVIAMO L'URL DIRETTO PER EVITARE ERRORI HTTPS)
    // FIX: stessa correzione di stripe/connect/route.ts - URL fisso
    // sostituito dalla variabile d'ambiente condivisa.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love-rouge.vercel.app';

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