import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2026-03-25.dahlia' });

export async function GET(req: Request) {
  // Sicurezza: verifica il segreto CRON di Vercel
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const quindiciGiorniFa = new Date();
    quindiciGiorniFa.setDate(quindiciGiorniFa.getDate() - 15);

    // Trova ordini vecchi di 15 giorni non ancora completati
    const { data: oldTrx } = await supabase
      .from('transactions')
      .select('*, announcements(user_id)')
      .eq('status', 'held')
      .lt('created_at', quindiciGiorniFa.toISOString());

    if (!oldTrx || oldTrx.length === 0) return NextResponse.json({ message: "Nessun ordine da sbloccare." });

    // FIX: ogni trasferimento è ora isolato nel proprio try/catch. Prima, se
    // UN SOLO trasferimento falliva (es. account Stripe del venditore
    // disconnesso, saldo piattaforma insufficiente), l'eccezione interrompeva
    // l'intero ciclo: tutte le transazioni rimaste nel batch - scollegate dal
    // problema che aveva causato il fallimento - restavano bloccate fino
    // alla prossima esecuzione del cron, invece di essere sbloccate regolarmente.
    let processed = 0;
    const failed: string[] = [];

    for (const trx of oldTrx) {
      try {
        const { data: seller } = await supabase.from('profiles').select('stripe_account_id').eq('id', trx.announcements.user_id).single();
        
        if (seller?.stripe_account_id) {
          const amountCents = Math.round(trx.amount * 100 * 0.90);
          
          const transfer = await stripe.transfers.create({
            amount: amountCents,
            currency: 'eur',
            destination: seller.stripe_account_id,
            source_transaction: trx.stripe_payment_intent_id,
          });

          await supabase.from('transactions').update({ status: 'completato', stripe_transfer_id: transfer.id }).eq('id', trx.id);
          processed++;
        }
      } catch (transferErr: any) {
        console.error(`Errore sblocco fondi per transazione ${trx.id}:`, transferErr);
        failed.push(trx.id);
      }
    }

    return NextResponse.json({ success: true, processed, failed });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}