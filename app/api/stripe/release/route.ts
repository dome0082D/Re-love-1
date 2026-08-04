import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2023-10-16' as any });

// FIX: passato alla chiave di servizio, stesso motivo di tutti gli altri
// file di questa revisione che scrivono su transactions/profiles da una
// route server-side.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const { transactionId, buyerId } = await req.json();

    if (!transactionId || !buyerId) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    // FIX: aggiornamento atomico condizionato allo stato attuale (stesso
    // pattern usato in orders/action/route.ts), invece di leggere lo stato
    // e scriverlo separatamente in due passaggi distinti. Senza questo, un
    // doppio invio o un retry di rete potevano far partire due trasferimenti
    // Stripe per lo stesso ordine.
    const { data: lockedRows, error: lockError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'in_elaborazione' })
      .eq('id', transactionId)
      .eq('buyer_id', buyerId)
      .eq('status', 'held')
      .select('*, announcements(user_id)');

    if (lockError || !lockedRows || lockedRows.length === 0) {
      return NextResponse.json({ error: "Transazione non trovata, già completata, o non di questo acquirente" }, { status: 400 });
    }

    const trx = lockedRows[0];

    const { data: seller } = await supabaseAdmin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', trx.announcements.user_id)
      .single();

    if (!seller?.stripe_account_id) {
      // Lo stato è già passato a 'in_elaborazione': lo riportiamo indietro a
      // 'held' perché qui, a differenza di un fallimento Stripe, sappiamo
      // per certo che nessun trasferimento è stato tentato.
      await supabaseAdmin.from('transactions').update({ status: 'held' }).eq('id', transactionId);
      return NextResponse.json({ error: "Il venditore non ha un account Stripe collegato" }, { status: 400 });
    }

    // 2. Calcola l'importo netto (Prezzo totale - 10% commissione)
    const totalAmountCent = Math.round(trx.amount * 100);
    const sellerAmountCent = Math.round(totalAmountCent * 0.90);

    try {
      // 3. Esegui il trasferimento verso l'account Express del venditore
      const transfer = await stripe.transfers.create({
        amount: sellerAmountCent,
        currency: 'eur',
        destination: seller.stripe_account_id,
        source_transaction: trx.stripe_payment_intent_id, // Collega il trasferimento al pagamento originale
        description: `Sblocco fondi per ordine ${trx.id}`,
      });

      // 4. Aggiorna il DB
      await supabaseAdmin
        .from('transactions')
        .update({ 
          status: 'completato',
          stripe_transfer_id: transfer.id 
        })
        .eq('id', transactionId);

      return NextResponse.json({ success: true });
    } catch (stripeErr: any) {
      // Il trasferimento è fallito DOPO aver già bloccato lo stato: lo
      // segnaliamo chiaramente nei log per un controllo manuale, invece di
      // farlo silenziosamente sparire in 'in_elaborazione' per sempre.
      console.error(`Errore trasferimento Stripe per transazione ${transactionId}:`, stripeErr);
      return NextResponse.json({ error: "Errore durante il trasferimento dei fondi. Lo staff è stato avvisato." }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}