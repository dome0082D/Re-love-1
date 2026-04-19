import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

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

    for (const trx of oldTrx) {
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
      }
    }

    return NextResponse.json({ success: true, processed: oldTrx.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
