import { NextResponse } from "next/server";
import Stripe from "stripe";

// Inizializza Stripe con la tua chiave segreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16", // Usa la tua versione di Stripe
});

export async function POST(req: Request) {
  try {
    // 1. Riceve i dati dal tuo sito (dal tasto "Acquista in sicurezza")
    const body = await req.json();
    
    // Assicurati che i nomi di queste variabili corrispondano a quelli che invii dal frontend!
    const { 
      title, 
      price, 
      sellerStripeId, // L'ID acct_... del venditore
      buyerId, // L'ID Supabase di chi compra (serve per "I miei acquisti")
      productId // L'ID del prodotto (serve per "I miei acquisti")
    } = body;

    // 2. Stripe lavora in centesimi. Convertiamo il prezzo (es. 1.20€ -> 120)
    const unitAmount = Math.round(price * 100);

    // 3. Calcolo della TUA commissione (es. 10%)
    // Se l'acqua costa 120 centesimi, il 10% è 12 centesimi.
    const platformFee = Math.round(unitAmount * 0.10); 

    // 4. Creazione della sessione di pagamento Stripe Connect
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: title || "Acqua",
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      // QUI È DOVE TRATTENI LA COMMISSIONE E PAGHI IL VENDITORE
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: sellerStripeId,
        },
      },
      // I metadati servono al "Postino" (Webhook) per aggiornare il database
      metadata: {
        buyerId: buyerId,
        productId: productId,
      },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
    });

    // 5. Restituisce l'URL della pagina di pagamento
    return NextResponse.json({ url: session.url });

  } catch (error: any) {
    console.error("Errore durante il checkout:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
