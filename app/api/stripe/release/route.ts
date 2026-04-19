import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

export async function POST(req: Request) {
  try {
    const { transactionId, buyerId } = await req.json();

    // 1. Recupera la transazione e l'account Stripe del venditore
    const { data: trx, error } = await supabase
      .from('transactions')
      .select('*, announcements(user_id)')
      .eq('id', transactionId)
      .eq('buyer_id', buyerId)
      .eq('status', 'held')
      .single();

    if (error || !trx) return NextResponse.json({ error: "Transazione non trovata o già completata" }, { status: 400 });

    const { data: seller } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', trx.announcements.user_id)
      .single();

    if (!seller?.stripe_account_id) return NextResponse.json({ error: "Il venditore non ha un account Stripe collegato" }, { status: 400 });

    // 2. Calcola l'importo netto (Prezzo totale - 10% commissione)
    const totalAmountCent = Math.round(trx.amount * 100);
    const sellerAmountCent = Math.round(totalAmountCent * 0.90);

    // 3. Esegui il trasferimento verso l'account Express del venditore
    const transfer = await stripe.transfers.create({
      amount: sellerAmountCent,
      currency: 'eur',
      destination: seller.stripe_account_id,
      source_transaction: trx.stripe_payment_intent_id, // Collega il trasferimento al pagamento originale
      description: `Sblocco fondi per ordine ${trx.id}`,
    });

    // 4. Aggiorna il DB
    await supabase
      .from('transactions')
      .update({ 
        status: 'completato',
        stripe_transfer_id: transfer.id 
      })
      .eq('id', transactionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
