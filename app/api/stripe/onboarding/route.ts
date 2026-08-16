export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe, statoContoStripe, invalidaCacheConto } from '@/lib/stripeAccount';

// FIX 1: questa route creava un account Stripe NUOVO a ogni singolo clic su
// "Attiva ricezione pagamenti". Chi interrompeva la procedura e ci
// riprovava si lasciava dietro account Express orfani, e l'id salvato sul
// profilo era ogni volta un altro: eventuali verifiche già fatte da Stripe
// sull'account precedente andavano perse. Ora, se il profilo ha già un
// account collegato, si riusa quello e si genera solo un nuovo link per
// riprendere la configurazione da dove era rimasta.
//
// FIX 2: "stripe_account_id" veniva scritto sul profilo subito dopo la
// creazione dell'account, cioè prima ancora che l'utente vedesse la prima
// schermata di Stripe. Siccome tutto il sito usava la presenza di quel
// campo come sinonimo di "può incassare", bastava aprire e chiudere Stripe
// per risultare abilitato a vendere. Il campo continua a essere salvato
// (serve per riprendere la procedura), ma non è più quello che decide se
// l'utente è pronto: quella risposta la dà lib/stripeAccount.ts leggendo
// charges_enabled e payouts_enabled da Stripe.

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ error: "User ID mancante" }, { status: 400 });

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle();

    let accountId: string | null = profile?.stripe_account_id || null;

    // Se l'account risulta collegato ma non esiste più su Stripe (cancellato
    // a mano, o creato con chiavi di test e ora siamo in live), ripartiamo
    // da zero invece di generare un link verso un account inesistente.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch {
        console.warn(`[Stripe/Onboarding] Account ${accountId} non più valido: ne creo uno nuovo.`);
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      const { error: dbError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', userId);

      if (dbError) throw new Error("Errore salvataggio database: " + dbError.message);
    }

    // Se ha già finito davvero, non c'è nulla da riprendere: lo diciamo
    // invece di rimandarlo su Stripe a rifare una procedura già completata.
    invalidaCacheConto(accountId);
    const stato = await statoContoStripe(accountId);
    if (stato.pronto) {
      return NextResponse.json({ giaPronto: true });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love-rouge.vercel.app';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
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
