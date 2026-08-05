import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Diciamo a Vercel di non processarlo in fase di caricamento
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Avvio spostato QUI DENTRO per non far crashare la Build di Vercel!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { 
      apiVersion: '2024-04-10' as any // Modifica la versione per evitare errori TypeScript con Vercel
    });
    
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string, 
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );

    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Firma o Secret mancante" }, { status: 400 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error("❌ Firma Webhook fallita:", err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // GESTIONE CHECKOUT COMPLETATO (NUOVO / USATO / REGALO / BARATTO)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const announcementId = session.metadata?.announcementId;
      const buyerId = session.metadata?.buyerId;
      const paymentIntentId = session.payment_intent as string;
      const checkoutType = session.metadata?.type; // Es: 'nuovo', 'regalo', 'baratto_accetta'

      // ==========================================
      // LOGICA 0-TER: VETRINA (tabella vetrina_items - NUOVA)
      // ==========================================
      // FIX IMPORTANTE: questo controllo va qui, PRIMA del cancello
      // "if (announcementId && buyerId)" più sotto - un pagamento Vetrina
      // ha nei suoi metadata solo "vetrina_item_id", non announcementId né
      // buyerId. Messo dentro quel blocco (come nella bozza data in
      // precedenza) non sarebbe MAI stato raggiunto: ogni pagamento Vetrina
      // sarebbe riuscito su Stripe ma non avrebbe mai attivato nulla, in
      // silenzio - lo stesso tipo di bug corretto altrove in questo
      // progetto (pagamenti "riusciti" che non sbloccano davvero niente).
      if (checkoutType === 'vetrina') {
        const vetrinaItemId = session.metadata?.vetrina_item_id;
        if (vetrinaItemId) {
          const { error: vetrinaError } = await supabaseAdmin
            .from('vetrina_items')
            .update({ is_active: true, stripe_session_id: session.id })
            .eq('id', vetrinaItemId);

          if (vetrinaError) {
            console.error('Errore attivazione voce vetrina:', vetrinaError);
            // Rispondiamo con errore (non 200) così Stripe ritenta
            // automaticamente la consegna di questo webhook più tardi,
            // invece di considerarlo "riuscito" mentre in realtà la voce
            // non è mai stata attivata.
            return NextResponse.json({ error: 'Errore attivazione vetrina' }, { status: 500 });
          }
        }
        return NextResponse.json({ received: true, vetrina: true });
      }

      if (announcementId && buyerId) {
        // ==========================================
        // LOGICA 0: SPONSORIZZAZIONE VETRINA (AGGIUNTA)
        // ==========================================
        // FIX: mancava del tutto questo ramo. Un pagamento da 2,99€ per
        // sponsorizzare un annuncio (metadata.type === 'sponsorship', creato
        // da stripe/sponsor/route.ts) finiva altrimenti nel ramo generico
        // qui sotto: veniva registrato come se il venditore avesse comprato
        // il proprio stesso annuncio, e - se Nuovo/Usato - la quantità
        // disponibile veniva scalata per un pagamento che non aveva
        // comprato nulla. L'annuncio inoltre non risultava mai sponsorizzato.
        if (checkoutType === 'sponsorship') {
          const days = 7;
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + days);

          const { error: sponsorError } = await supabaseAdmin
            .from('announcements')
            .update({ is_sponsored: true, sponsored_until: expiryDate.toISOString() })
            .eq('id', announcementId);

          if (sponsorError) {
            console.error('Errore attivazione sponsorizzazione:', sponsorError);
            return NextResponse.json({ error: 'Errore attivazione sponsorizzazione' }, { status: 500 });
          }

          return NextResponse.json({ received: true, sponsorship: true });
        }

        // ==========================================
        // LOGICA 0-BIS: SBLOCCO CHAT / "CAFFÈ" (AGGIUNTA)
        // ==========================================
        // FIX: stesso problema del ramo sopra, ma per i 2,50€ di
        // stripe/coffee/route.ts (metadata.type === 'chat_unlock'). Senza
        // questo ramo, anche questi pagamenti finivano trattati come un
        // "acquisto" fasullo dell'annuncio.
        if (checkoutType === 'chat_unlock') {
          const { error: unlockError } = await supabaseAdmin
            .from('unlocked_chats')
            .insert([{ 
              user_id: buyerId, 
              announcement_id: announcementId 
            }]);

          if (unlockError) {
            console.error('Errore sblocco chat:', unlockError);
            return NextResponse.json({ error: 'Errore sblocco chat' }, { status: 500 });
          }

          console.log(`🔓 Chat sbloccata per l'utente ${buyerId}`);
          return NextResponse.json({ received: true, chat_unlocked: true });
        }

        // 1. Cerchiamo chi è il venditore
        // FIX: prima non veniva controllato l'errore di questa lettura - se
        // falliva (es. un problema temporaneo di connessione al database
        // proprio nell'istante del pagamento), il codice sotto veniva
        // saltato in silenzio e rispondeva comunque "received: true" a
        // Stripe: Stripe pensa che sia andato tutto bene e NON ritenta più
        // la consegna, ma la transazione non è mai stata creata da
        // nessuna parte - il cliente ha pagato senza ricevere nulla.
        const { data: ann, error: annError } = await supabaseAdmin
          .from('announcements')
          .select('user_id, condition')
          .eq('id', announcementId)
          .single();

        if (annError || !ann) {
          console.error('Errore recupero annuncio nel webhook:', annError);
          return NextResponse.json({ error: 'Errore recupero annuncio' }, { status: 500 });
        }

        // ==========================================
        // LOGICA 1: BARATTO - L'UTENTE B ACCETTA (Il tuo codice integrato)
        // ==========================================
        if (checkoutType === 'baratto_accept') {
          const transactionId = session.metadata?.transactionId;

          if (transactionId) {
            const { data: tx, error: txError } = await supabaseAdmin
              .from('transactions')
              .select('*')
              .eq('id', transactionId)
              .single();

            if (txError || !tx) {
              console.error('Errore recupero transazione baratto:', txError);
              return NextResponse.json({ error: 'Errore recupero transazione' }, { status: 500 });
            }

            // Se l'utente A aveva già congelato i soldi (stripe_payment_intent_id)
            if (tx.stripe_payment_intent_id) {
              // 2. CATTURIAMO i soldi dell'Utente A!
              // FIX: prima, se questa cattura falliva, il codice proseguiva
              // comunque a segnare la transazione come "Pagato" subito
              // sotto - come se il denaro fosse stato davvero incassato,
              // quando in realtà la cattura non era riuscita. Ora, se
              // fallisce, ci fermiamo e rispondiamo con errore, così Stripe
              // ritenta l'evento più tardi invece di far proseguire un
              // baratto con i soldi dell'Utente A mai davvero catturati.
              try {
                await stripe.paymentIntents.capture(tx.stripe_payment_intent_id);
              } catch (captureErr) {
                console.error("Errore cattura Utente A:", captureErr);
                return NextResponse.json({ error: 'Errore cattura pagamento' }, { status: 500 });
              }

              // 3. Sblocchiamo la chat nel DB (status: Pagato per entrambi)
              const { error: updateTxError } = await supabaseAdmin.from('transactions')
                .update({ 
                  status: 'Pagato',
                  barter_confirmed_seller: true // Segniamo che il venditore ha pagato la commissione
                })
                .eq('id', transactionId);

              if (updateTxError) {
                console.error('Errore aggiornamento transazione baratto:', updateTxError);
                return NextResponse.json({ error: 'Errore aggiornamento transazione' }, { status: 500 });
              }
            }
          }
        } 
        // ==========================================
        // LOGICA 2: TUTTO IL RESTO (Nuovo, Usato, Regalo, o Utente A del Baratto)
        // ==========================================
        else {
          // FIX: prima l'esito di questo insert non veniva controllato -
          // se falliva, il pagamento risultava comunque riuscito su Stripe
          // (risposta 200 più sotto) ma nessuna transazione veniva mai
          // creata: il cliente pagava e non riceveva né l'oggetto né una
          // chat sbloccata né alcuna traccia dell'acquisto.
          const { error: insertError } = await supabaseAdmin.from('transactions').insert([{
            announcement_id: announcementId,
            buyer_id: buyerId,
            seller_id: ann.user_id,
            status: 'Pagato', // Questo status SBLOCCA LA CHAT
            stripe_payment_intent_id: paymentIntentId,
            // Se è l'utente A del baratto che paga, segniamolo!
            barter_confirmed_buyer: ann.condition === 'Baratto' ? true : false
          }]);

          if (insertError) {
            console.error('Errore creazione transazione:', insertError);
            return NextResponse.json({ error: 'Errore creazione transazione' }, { status: 500 });
          }

          // Scala la quantità se è un prodotto fisico venduto
          if (ann.condition === 'Nuovo' || ann.condition === 'Usato') {
            const { error: qtyError } = await supabaseAdmin.rpc('decrement_quantity', { row_id: announcementId });
            if (qtyError) {
              // Non blocchiamo la risposta per questo - la transazione e il
              // pagamento sono comunque validi e registrati; la quantità è
              // un dato secondario che nel peggiore dei casi va corretto a
              // mano, non vale la pena far ripetere a Stripe l'intero evento.
              console.error('Errore decremento quantità:', qtyError);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("ERRORE FATALE WEBHOOK:", err);
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}