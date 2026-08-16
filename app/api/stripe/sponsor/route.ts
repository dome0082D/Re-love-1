export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Inizializza Stripe con la tua chiave segreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-03-25.dahlia', // Modificato per sicurezza con i nuovi standard Stripe
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { announcementId, userId } = body;

    if (!announcementId || !userId) {
      // ⚠️ RISPOSTA IN JSON COSÌ IL FRONTEND NON CRASHA!
      return NextResponse.json({ error: "Dati mancanti" }, { status: 400 });
    }

    // FIX: prima l'URL di ritorno dipendeva da NEXT_PUBLIC_BASE_URL - una
    // variabile diversa da quella impostata per il resto del sito
    // (NEXT_PUBLIC_SITE_URL). Se non configurata su Vercel, il fallback era
    // "http://localhost:3000": dopo un pagamento riuscito l'utente veniva
    // rimandato a un indirizzo che sul suo telefono semplicemente non esiste.
    // Usiamo l'origin della richiesta stessa (stesso approccio già corretto
    // in stripe/coffee/route.ts): funziona sempre, senza dipendere da
    // nessuna variabile d'ambiente.
    const origin = req.headers.get('origin') || 'https://re-love-rouge.vercel.app';

    // Creiamo la sessione di pagamento su Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Sponsorizzazione Vetrina Top ✨',
              description: 'Il tuo annuncio sarà messo in prima fila.',
            },
            unit_amount: 299, // 299 centesimi = 2.99 € (allineato al bottone)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      // Diciamo a Stripe chi sta pagando e per cosa
      metadata: {
        type: 'sponsorship', // Il webhook leggerà questo!
        announcementId: announcementId,
        userId: userId,
      },
      // Se il pagamento va a buon fine, torna alla bacheca
      success_url: `${origin}/dashboard/annunci?success=true&ad_id=${announcementId}`,
      cancel_url: `${origin}/dashboard/annunci?canceled=true`,
    });

    // Rispondiamo al sito con il link alla pagina di pagamento sicura di Stripe in formato JSON
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Errore Stripe Sponsor:", error);
    // ⚠️ RISPOSTA IN JSON IN CASO DI ERRORE
    return NextResponse.json({ error: error.message || "Errore interno server" }, { status: 500 });
  }
}