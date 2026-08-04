export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase'; 

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-03-25.dahlia" as any,
});

export async function POST(req: Request) {
  try {
    // Abbiamo aggiunto usePickup per sapere se c'è spedizione o ritiro a mano
    const { items, buyerId, usePickup } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Il carrello è vuoto" }, { status: 400 });
    }

    const firstItemId = items[0].id;
    const quantity = items[0].quantity || 1;
    const offerPrice = items[0].price; // Il prezzo (potrebbe essere scontato da un'offerta)
    
    // Recupero dell'annuncio dal DB per prendere costi di spedizione e sicurezza
    const { data: announcement } = await supabase
      .from('announcements')
      .select('user_id, price, shipping_cost, condition, quantity')
      .eq('id', firstItemId)
      .single();

    if (!announcement) {
      return NextResponse.json({ error: "Annuncio non trovato nel database" }, { status: 404 });
    }

    // FIX: la quantità arrivava solo dal client e non veniva mai confrontata
    // con la disponibilità reale in database - bastava modificare la
    // richiesta per "acquistare" più pezzi di quanti il venditore ne avesse.
    const availableQty = announcement.quantity ?? 1;
    if (quantity > availableQty) {
      return NextResponse.json({ error: `Disponibili solo ${availableQty} pezzi.` }, { status: 400 });
    }

    // 🛑 SICUREZZA: Blocchiamo chi cerca di pagare per Baratto o Regalo (sono gratis!)
    if (announcement.condition === 'Regalo' || announcement.condition === 'Baratto') {
      return NextResponse.json({ error: "Gli articoli in Regalo o Baratto sono gratuiti e non richiedono checkout." }, { status: 400 });
    }

    // Verifichiamo che il venditore possa ricevere soldi (abbia configurato Stripe)
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', announcement.user_id)
      .single();

    const destinationAccountId = sellerProfile?.stripe_account_id;

    if (!destinationAccountId) {
      return NextResponse.json({ error: "Il venditore non ha ancora abilitato la ricezione dei pagamenti." }, { status: 400 });
    }

    // 🧮 MATEMATICA E COMMISSIONI
    const finalItemPrice = Math.min(offerPrice, announcement.price); // Previene truffe sul prezzo
    const finalShippingCost = usePickup ? 0 : (announcement.shipping_cost || 0);
    
    // Totale in centesimi per Stripe
    const totaleCent = Math.round(((finalItemPrice * quantity) + finalShippingCost) * 100);
    const commissioneCent = Math.round(totaleCent * 0.10); // Il tuo 10% sul TOTALE!
    const sellerTransferCent = totaleCent - commissioneCent; // Il restante 90% al venditore

    // Creiamo le voci (prodotti) per la schermata di Stripe
    const line_items: any[] = [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: items[0].title,
            images: items[0].image_url ? [items[0].image_url] : [],
          },
          unit_amount: Math.round(finalItemPrice * 100),
        },
        quantity: quantity,
      }
    ];

    // Se c'è spedizione, aggiungiamo una riga apposita nello scontrino
    if (finalShippingCost > 0) {
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Spese di Spedizione',
          },
          unit_amount: Math.round(finalShippingCost * 100),
        },
        quantity: 1,
      });
    }

    // CREAZIONE SESSIONE (Modalità Cassaforte / Congelamento Fondi)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      payment_intent_data: {
        // "Etichettiamo" questo pagamento per poter sbloccare i fondi in futuro
        transfer_group: firstItemId, 
      },
      // Passiamo tutti i dati utili al Webhook: così sa esattamente quanto darti!
      metadata: {
        type: 'purchase',
        buyerId: buyerId,
        sellerId: announcement.user_id,
        announcementId: firstItemId,
        totalePagato: (totaleCent / 100).toString(),
        commissioneReLove: (commissioneCent / 100).toString(),
        daTrasferireAlVenditore: (sellerTransferCent / 100).toString(),
      },
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore Stripe Checkout:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}