export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Assicurati di avere STRIPE_SECRET_KEY nel tuo file .env.local
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-03-25.dahlia', 
});

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID mancante" }, { status: 400 });

    // FIX: prima si usava il client con chiave anonima per salvare
    // stripe_account_id sul profilo da una route server-side, senza
    // controllare l'esito. Se la tabella "profiles" ha una policy RLS che
    // richiede l'utente autenticato (tipico), il salvataggio falliva senza
    // che nessuno se ne accorgesse: il venditore completava l'onboarding su
    // Stripe credendo di aver collegato l'account, ma il profilo restava
    // senza stripe_account_id. La chiave di servizio bypassa la RLS ed è
    // corretta per un'operazione server-to-server come questa.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    // 1. Crea account venditore su Stripe
    const account = await stripe.accounts.create({ type: 'express' });

    // 2. Salva l'ID su Supabase
    const { error: dbError } = await supabaseAdmin.from('profiles').update({ stripe_account_id: account.id }).eq('id', userId);
    if (dbError) throw new Error("Errore salvataggio account Stripe: " + dbError.message);

    // 3. Genera il link sicuro in HTTPS
    // Usiamo direttamente il tuo dominio Vercel per garantire a Stripe la massima sicurezza
    // FIX: URL fisso sostituito con la stessa variabile d'ambiente già usata
    // per metadataBase in layout.tsx (NEXT_PUBLIC_SITE_URL) - un solo posto
    // da aggiornare se il dominio cambia, invece di doverlo cercare a mano
    // in ogni file che ne aveva una copia scritta a dito.
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love-rouge.vercel.app';

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${siteUrl}/profile`,
      return_url: `${siteUrl}/profile?success=true`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}