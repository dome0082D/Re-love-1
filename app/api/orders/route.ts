// app/api/orders/action/route.ts
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export async function POST(req: Request) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-04-10" as any });
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const { transactionId, action, userId, userRole } = await req.json();

    // Recuperiamo la transazione
    const { data: tx } = await supabaseAdmin.from('transactions').select('*, announcements(*)').eq('id', transactionId).single();
    if (!tx) return NextResponse.json({ error: "Transazione non trovata" }, { status: 404 });

    // 👕 1. NUOVO E USATO: "Pacco Ricevuto"
    if (action === 'confirm_receipt' && (tx.announcements.condition === 'Nuovo' || tx.announcements.condition === 'Usato')) {
      if (tx.buyer_id !== userId) throw new Error("Solo il compratore può confermare.");
      
      // ⚠️ ATTENZIONE - NON RISOLTO: qui sotto NON avviene nessun trasferimento
      // Stripe reale verso il venditore (il commento originale lo descriveva
      // ma il codice non lo eseguiva mai). Se questo file è quello davvero
      // collegato al pulsante "Conferma Ricezione", il venditore non riceve
      // MAI i soldi nonostante l'app dica "Pagamento sbloccato al venditore!"
      // - viene aggiornata solo l'etichetta di stato nel database.
      // Confronta con orders/action/route.ts, che esegue davvero
      // stripe.transfers.create(...) in questo punto.
      
      await supabaseAdmin.from('transactions').update({ status: 'Ricevuto' }).eq('id', transactionId);
      return NextResponse.json({ success: true, message: "Pagamento sbloccato al venditore!" });
    }

    // ❌ 2. NUOVO E USATO: "Richiedi Rimborso"
    if (action === 'request_refund') {
      if (tx.buyer_id !== userId) throw new Error("Solo il compratore può rimborsare.");
      
      // ⚠️ ATTENZIONE - NON RISOLTO: stesso problema del blocco sopra. Il
      // rimborso Stripe vero e proprio (stripe.refunds.create(...), citato
      // nel commento originale) non viene mai chiamato. L'app risponde
      // "Rimborso elaborato" ma nessun soldo torna sulla carta del compratore.
      
      await supabaseAdmin.from('transactions').update({ status: 'Rimborsato' }).eq('id', transactionId);
      return NextResponse.json({ success: true, message: "Rimborso elaborato." });
    }

    // 🔄 3. BARATTO: "Conferma Scambio"
    if (action === 'confirm_barter') {
      const updateData: any = {};
      if (userRole === 'buyer') updateData.barter_confirmed_buyer = true;
      if (userRole === 'seller') updateData.barter_confirmed_seller = true;

      await supabaseAdmin.from('transactions').update(updateData).eq('id', transactionId);

      // Verifichiamo se ora ENTRAMBI hanno confermato
      const { data: checkTx } = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();
      
      // FIX: stesso controllo di sicurezza applicato in orders/action/route.ts
      if (checkTx?.barter_confirmed_buyer && checkTx?.barter_confirmed_seller) {
        // ENTRAMBI CONFERMANO: Il sito incassa definitivamente.
        await supabaseAdmin.from('transactions').update({ status: 'Concluso' }).eq('id', transactionId);
        return NextResponse.json({ success: true, message: "Scambio confermato da entrambi! Chat sbloccata." });
      }

      return NextResponse.json({ success: true, message: "Attesa conferma dall'altro utente..." });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}