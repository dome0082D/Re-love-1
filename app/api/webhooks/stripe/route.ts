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

          await supabaseAdmin
            .from('announcements')
            .update({ is_sponsored: true, sponsored_until: expiryDate.toISOString() })
            .eq('id', announcementId);

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
          await supabaseAdmin
            .from('unlocked_chats')
            .insert([{ 
              user_id: buyerId, 
              announcement_id: announcementId 
            }]);

          console.log(`🔓 Chat sbloccata per l'utente ${buyerId}`);
          return NextResponse.json({ received: true, chat_unlocked: true });
        }

        // 1. Cerchiamo chi è il venditore
        const { data: ann } = await supabaseAdmin.from('announcements').select('user_id, condition').eq('id', announcementId).single();
        
        if (ann) {
          // ==========================================
          // LOGICA 1: BARATTO - L'UTENTE B ACCETTA (Il tuo codice integrato)
          // ==========================================
          if (checkoutType === 'baratto_accept') {
            const transactionId = session.metadata?.transactionId;

            if (transactionId) {
              const { data: tx } = await supabaseAdmin.from('transactions').select('*').eq('id', transactionId).single();

              // Se l'utente A aveva già congelato i soldi (stripe_payment_intent_id)
              if (tx && tx.stripe_payment_intent_id) {
                // 2. CATTURIAMO i soldi dell'Utente A!
                try {
                  await stripe.paymentIntents.capture(tx.stripe_payment_intent_id);
                } catch (captureErr) {
                  console.error("Errore cattura Utente A:", captureErr);
                }

                // 3. Sblocchiamo la chat nel DB (status: Pagato per entrambi)
                await supabaseAdmin.from('transactions')
                  .update({ 
                    status: 'Pagato',
                    barter_confirmed_seller: true // Segniamo che il venditore ha pagato la commissione
                  })
                  .eq('id', transactionId);
              }
            }
          } 
          // ==========================================
          // LOGICA 2: TUTTO IL RESTO (Nuovo, Usato, Regalo, o Utente A del Baratto)
          // ==========================================
          else {
            await supabaseAdmin.from('transactions').insert([{
              announcement_id: announcementId,
              buyer_id: buyerId,
              seller_id: ann.user_id,
              status: 'Pagato', // Questo status SBLOCCA LA CHAT
              stripe_payment_intent_id: paymentIntentId,
              // Se è l'utente A del baratto che paga, segniamolo!
              barter_confirmed_buyer: ann.condition === 'Baratto' ? true : false
            }]);

            // Scala la quantità se è un prodotto fisico venduto
            if (ann.condition === 'Nuovo' || ann.condition === 'Usato') {
               await supabaseAdmin.rpc('decrement_quantity', { row_id: announcementId });
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