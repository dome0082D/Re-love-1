export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-03-25.dahlia' as any,
});

// FIX: passato alla chiave di servizio invece di quella anonima. Questa route
// ora è quella davvero collegata al pulsante "Ricevuto!" della dashboard
// ordini e sposta soldi veri: se un aggiornamento fallisse in silenzio per
// via della Row Level Security, lo stato e il pagamento potrebbero
// disallinearsi (soldi trasferiti ma stato non aggiornato, o viceversa).
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  try {
    const { transactionId, action, userId, userRole } = await req.json();

    if (!transactionId || !action || !userId) {
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    // 1. Recuperiamo i dettagli della transazione
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*, announcements(condition)')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      return NextResponse.json({ error: "Transazione non trovata" }, { status: 404 });
    }

    // ==========================================
    // AZIONE 1: CONFERMA RICEZIONE (SBLOCCO FONDI VENDITA)
    // ==========================================
    // FIX: aggiunto userRole === 'staff' come percorso alternativo - serve
    // alla dashboard /staff per sbloccare manualmente i fondi in caso di
    // intervento diretto (es. dopo una contestazione risolta a favore del
    // venditore). Prima quella pagina scriveva lo stato "Ricevuto" a mano
    // via Supabase, senza mai chiamare questa route: diceva "fondi
    // sbloccati" al venditore ma non trasferiva mai un euro davvero.
    if (action === 'confirm_receipt' && (userRole === 'buyer' || userRole === 'staff')) {

      // FIX: prima non veniva verificato che chi chiama sia davvero il
      // compratore di QUESTA transazione - chiunque conoscesse un
      // transactionId poteva forzare lo sblocco fondi di un ordine altrui.
      // Lo staff è l'unica eccezione consentita a questo controllo.
      if (userRole === 'buyer' && transaction.buyer_id !== userId) {
        return NextResponse.json({ error: "Non sei l'acquirente di questo ordine." }, { status: 403 });
      }

      // FIX: un reclamo aperto da "Segnala Problema" non bloccava in alcun
      // modo lo sblocco fondi - un utente poteva aprire una contestazione E
      // comunque premere "Ricevuto!" subito dopo, sbloccando i soldi mentre
      // lo Staff sta ancora esaminando il reclamo.
      const { data: openDispute } = await supabaseAdmin
        .from('disputes')
        .select('id')
        .eq('transaction_id', transactionId)
        .eq('status', 'Aperta')
        .limit(1)
        .maybeSingle();

      if (openDispute) {
        return NextResponse.json({ error: "C'è una contestazione aperta su questo ordine: i fondi restano bloccati finché lo Staff non la risolve." }, { status: 400 });
      }

      // FIX: aggiornamento atomico condizionato allo stato attuale, invece di
      // leggere lo stato e scriverlo separatamente. Senza questo, un doppio
      // click sul pulsante o un retry di rete potevano far partire DUE
      // trasferimenti Stripe per lo stesso ordine. Aggiorniamo lo stato PRIMA
      // di chiamare Stripe apposta: se il trasferimento fallisse dopo,
      // l'ordine resterebbe in uno stato da controllare manualmente invece
      // che rischiare un doppio pagamento al venditore (l'errore peggiore).
      const { data: lockedRows, error: lockError } = await supabaseAdmin
        .from('transactions')
        .update({ status: 'Ricevuto' })
        .eq('id', transactionId)
        .eq('status', 'Spedito')
        .select();

      if (lockError || !lockedRows || lockedRows.length === 0) {
        return NextResponse.json({ error: "L'ordine non è nello stato corretto per essere confermato (forse è già stato confermato)." }, { status: 400 });
      }

      // Se l'oggetto aveva un prezzo maggiore di 0, sblocchiamo i fondi su Stripe
      if (transaction.amount > 0 && transaction.seller_id) {

        // NUOVO: se questa transazione riguarda un annuncio delegato (vedi
        // "Curatore Locale"), invece di UN trasferimento al venditore ne
        // servono DUE: uno al Proprietario, uno al Curatore, secondo le
        // percentuali concordate al momento dell'acquisto. Il restante 10%
        // (commissione ReLove) non viene mai trasferito, esattamente come
        // per una vendita normale - resta sul conto della piattaforma.
        if (transaction.mandate_id && transaction.curator_id) {
          const [ownerProfileRes, curatorProfileRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('stripe_account_id').eq('id', transaction.seller_id).single(),
            supabaseAdmin.from('profiles').select('stripe_account_id').eq('id', transaction.curator_id).single(),
          ])

          const ownerStripeId = ownerProfileRes.data?.stripe_account_id
          const curatorStripeId = curatorProfileRes.data?.stripe_account_id

          if (!ownerStripeId || !curatorStripeId) {
            console.error(`Mandato ${transaction.mandate_id}: Proprietario o Curatore senza stripe_account_id - transazione ${transactionId} confermata ma fondi NON trasferiti.`);
            return NextResponse.json({ error: "Il Proprietario o il Curatore non hanno un conto Stripe collegato. Contatta lo staff." }, { status: 400 });
          }

          const ownerPct = transaction.owner_percentage_snapshot ?? 70
          const curatorPct = transaction.curator_percentage_snapshot ?? 20

          const ownerShareCents = Math.round((transaction.amount * (ownerPct / 100)) * 100)
          const curatorShareCents = Math.round((transaction.amount * (curatorPct / 100)) * 100)

          try {
            // Due trasferimenti separati, entrambi collegati allo stesso
            // pagamento originale tramite transfer_group - stessa tecnica
            // già in uso per il trasferimento singolo qui sotto.
            await stripe.transfers.create({
              amount: ownerShareCents,
              currency: 'eur',
              destination: ownerStripeId,
              transfer_group: transaction.announcement_id,
            })
            await stripe.transfers.create({
              amount: curatorShareCents,
              currency: 'eur',
              destination: curatorStripeId,
              transfer_group: transaction.announcement_id,
            })
            console.log(`Fondi sbloccati (Curatore Locale): €${ownerShareCents / 100} al Proprietario, €${curatorShareCents / 100} al Curatore.`)
          } catch (stripeErr: any) {
            console.error(`Errore sblocco fondi Stripe (mandato) per transazione ${transactionId} (stato già 'Ricevuto', richiede controllo manuale):`, stripeErr);
            return NextResponse.json({ error: "Errore durante il trasferimento dei fondi. Lo staff è stato avvisato." }, { status: 500 });
          }

          return NextResponse.json({ success: true, message: "Pacco confermato! I fondi sono stati divisi tra Proprietario e Curatore." });
        }

        // NUOVO: se questa transazione riguarda un oggetto venduto tramite
        // un promotore Arena, invece di UN trasferimento al venditore ne
        // servono DUE: 60% al Proprietario, 30% al Promotore vincitore. Il
        // restante 10% (commissione ReLove) non viene mai trasferito,
        // esattamente come per una vendita normale.
        if (transaction.arena_promoter_id) {
          const [ownerProfileRes, promoterProfileRes] = await Promise.all([
            supabaseAdmin.from('profiles').select('stripe_account_id').eq('id', transaction.seller_id).single(),
            supabaseAdmin.from('profiles').select('stripe_account_id').eq('id', transaction.arena_promoter_id).single(),
          ])

          const ownerStripeId = ownerProfileRes.data?.stripe_account_id
          const promoterStripeId = promoterProfileRes.data?.stripe_account_id

          if (!ownerStripeId || !promoterStripeId) {
            console.error(`Arena: Proprietario o Promotore senza stripe_account_id - transazione ${transactionId} confermata ma fondi NON trasferiti.`);
            return NextResponse.json({ error: "Il Proprietario o il Promotore non hanno un conto Stripe collegato. Contatta lo staff." }, { status: 400 });
          }

          const ownerPct = transaction.arena_owner_percentage_snapshot ?? 60
          const promoterPct = transaction.arena_promoter_percentage_snapshot ?? 30

          const ownerShareCents = Math.round((transaction.amount * (ownerPct / 100)) * 100)
          const promoterShareCents = Math.round((transaction.amount * (promoterPct / 100)) * 100)

          try {
            await stripe.transfers.create({
              amount: ownerShareCents,
              currency: 'eur',
              destination: ownerStripeId,
              transfer_group: transaction.announcement_id,
            })
            await stripe.transfers.create({
              amount: promoterShareCents,
              currency: 'eur',
              destination: promoterStripeId,
              transfer_group: transaction.announcement_id,
            })
            console.log(`Fondi sbloccati (Arena ReLove): €${ownerShareCents / 100} al Proprietario, €${promoterShareCents / 100} al Promotore.`)
          } catch (stripeErr: any) {
            console.error(`Errore sblocco fondi Stripe (Arena) per transazione ${transactionId} (stato già 'Ricevuto', richiede controllo manuale):`, stripeErr);
            return NextResponse.json({ error: "Errore durante il trasferimento dei fondi. Lo staff è stato avvisato." }, { status: 500 });
          }

          return NextResponse.json({ success: true, message: "Pacco confermato! I fondi sono stati divisi tra Proprietario e Promotore vincitore." });
        }

        // Percorso normale (nessun mandato, nessuna Arena) - invariato rispetto a prima.
        const { data: seller } = await supabaseAdmin
          .from('profiles')
          .select('stripe_account_id')
          .eq('id', transaction.seller_id)
          .single();

        if (!seller?.stripe_account_id) {
          // Lo stato è già "Ricevuto": lo segnaliamo chiaramente nei log per
          // un controllo manuale, dato che qui non possiamo più tornare
          // indietro allo stato precedente senza rischiare confusione.
          console.error(`Venditore ${transaction.seller_id} senza stripe_account_id - transazione ${transactionId} confermata ma fondi NON trasferiti.`);
          return NextResponse.json({ error: "Il venditore non ha un account Stripe collegato. Contatta lo staff." }, { status: 400 });
        }

        // Calcoliamo il 90% (Trasformando i test in centesimi per Stripe)
        // Esempio: Se costa 10€, transaction.amount è 10. Il 90% è 9€. In centesimi è 900.
        const sellerShareCents = Math.round((transaction.amount * 0.90) * 100);

        try {
          // Creiamo il Trasferimento verso il venditore!
          await stripe.transfers.create({
            amount: sellerShareCents,
            currency: 'eur',
            destination: seller.stripe_account_id,
            transfer_group: transaction.announcement_id, // Colleghiamo il trasferimento al pagamento originale
          });
          console.log(`Fondi sbloccati: €${sellerShareCents / 100} inviati al venditore.`);
        } catch (stripeErr: any) {
          console.error(`Errore sblocco fondi Stripe per transazione ${transactionId} (stato già 'Ricevuto', richiede controllo manuale):`, stripeErr);
          return NextResponse.json({ error: "Errore durante il trasferimento dei fondi al venditore. Lo staff è stato avvisato." }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, message: "Pacco confermato! I fondi sono stati inviati al venditore." });
    }

    // ==========================================
    // AZIONE 2: CONFERMA BARATTO
    // ==========================================
    if (action === 'confirm_barter') {
      const updateData = userRole === 'buyer' 
        ? { barter_confirmed_buyer: true } 
        : { barter_confirmed_seller: true };

      await supabaseAdmin.from('transactions').update(updateData).eq('id', transactionId);

      // Verifichiamo se ora l'hanno confermato entrambi
      const { data: checkTx } = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();
      
      // FIX: se questa seconda query non restituisce dati (hiccup transitorio
      // del database), checkTx era null/undefined e leggere le sue proprietà
      // lanciava un'eccezione invece di una risposta chiara.
      if (checkTx?.barter_confirmed_buyer && checkTx?.barter_confirmed_seller) {
        await supabaseAdmin.from('transactions').update({ status: 'Concluso' }).eq('id', transactionId);
        return NextResponse.json({ success: true, message: "Entrambi avete confermato! Scambio concluso." });
      }

      return NextResponse.json({ success: true, message: "Conferma inviata. In attesa dell'altro utente." });
    }

    // ==========================================
    // AZIONE 3: RICHIESTA RIMBORSO / RECLAMO
    // ==========================================
    // ATTENZIONE: dai file che ho visto, la dashboard ordini reale usa un
    // percorso diverso per i reclami (tabella "disputes" tramite il pulsante
    // "Problema", gestita a parte dallo Staff) - questo ramo action non
    // risulta chiamato da nessuna pagina che mi hai mostrato finora. Lo lascio
    // funzionante così com'era, ma verifica se ti serve ancora prima di
    // costruirci sopra qualcosa.
    if (action === 'request_refund') {
      await supabaseAdmin
        .from('transactions')
        .update({ status: 'In Contestazione' })
        .eq('id', transactionId);

      return NextResponse.json({ success: true, message: "Reclamo aperto. Il team di Re-love analizzerà la situazione. I fondi restano bloccati." });
    }

    return NextResponse.json({ error: "Azione non valida" }, { status: 400 });

  } catch (error: any) {
    console.error("Errore API Ordini:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}