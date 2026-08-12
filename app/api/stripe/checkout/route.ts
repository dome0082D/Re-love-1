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
    
    // NUOVO: aggiunti curator_id, owner_id, mandate_id alla select - servono
    // per capire se questo è un annuncio del sistema "Curatore Locale". Per
    // un annuncio normale sono tutti null e tutto il resto del flusso resta
    // identico a prima.
    const { data: announcement } = await supabase
      .from('announcements')
      .select('user_id, price, shipping_cost, condition, quantity, curator_id, owner_id, mandate_id')
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

    // NUOVO: se l'annuncio ha un mandato attivo (Curatore Locale), la
    // "vendita" coinvolge tre incassi (Proprietario, Curatore, piattaforma)
    // invece di uno solo. Recuperiamo qui il mandato per conoscere le
    // percentuali concordate, e più sotto verifichiamo che ENTRAMBI
    // Proprietario e Curatore abbiano un conto Stripe pronto - non basta
    // più che lo abbia solo chi ha pubblicato l'annuncio.
    const isDelegated = !!announcement.mandate_id
    let mandate: { owner_percentage: number; curator_percentage: number } | null = null

    if (isDelegated) {
      const { data: mandateData } = await supabase
        .from('curator_mandates')
        .select('owner_percentage, curator_percentage, status')
        .eq('id', announcement.mandate_id)
        .single()

      if (!mandateData || mandateData.status !== 'attivo') {
        return NextResponse.json({ error: "Questo mandato di delega non è più attivo." }, { status: 400 })
      }
      mandate = mandateData
    }

    // Verifichiamo che chi deve ricevere soldi possa farlo (abbia
    // configurato Stripe). Per un annuncio normale, è solo chi ha
    // pubblicato l'annuncio (user_id). Per un annuncio delegato, servono
    // ENTRAMBI Proprietario e Curatore, perché entrambi riceveranno una
    // parte dell'incasso allo sblocco fondi.
    let ownerStripeId: string | null = null
    let curatorStripeId: string | null = null

    if (isDelegated) {
      const [ownerProfileRes, curatorProfileRes] = await Promise.all([
        supabase.from('profiles').select('stripe_account_id').eq('id', announcement.owner_id).single(),
        supabase.from('profiles').select('stripe_account_id').eq('id', announcement.curator_id).single(),
      ])
      ownerStripeId = ownerProfileRes.data?.stripe_account_id || null
      curatorStripeId = curatorProfileRes.data?.stripe_account_id || null

      if (!ownerStripeId || !curatorStripeId) {
        return NextResponse.json({ error: "Il Proprietario e il Curatore devono avere entrambi un conto configurato per ricevere pagamenti prima che questo oggetto possa essere venduto." }, { status: 400 })
      }
    } else {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', announcement.user_id)
        .single();

      if (!sellerProfile?.stripe_account_id) {
        return NextResponse.json({ error: "Il venditore non ha ancora abilitato la ricezione dei pagamenti." }, { status: 400 });
      }
    }

    // 🧮 MATEMATICA E COMMISSIONI
    const finalItemPrice = Math.min(offerPrice, announcement.price); // Previene truffe sul prezzo
    const finalShippingCost = usePickup ? 0 : (announcement.shipping_cost || 0);
    
    // Totale in centesimi per Stripe
    const totaleCent = Math.round(((finalItemPrice * quantity) + finalShippingCost) * 100);
    const commissioneCent = Math.round(totaleCent * 0.10); // Il tuo 10% sul TOTALE!
    const sellerTransferCent = totaleCent - commissioneCent; // Il restante 90% al venditore (o diviso Proprietario/Curatore)

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

    // NUOVO: per un annuncio delegato, "sellerId" nei metadata resta il
    // VERO venditore legale, cioè il Proprietario (non il Curatore) - così
    // tutto il codice esistente che legge "sellerId" (dispute, dashboard)
    // continua a puntare alla persona giusta. Aggiungiamo in più
    // curatorId/mandateId/le percentuali, che il webhook userà per salvare
    // la transazione con i dati necessari alla divisione a 3.
    const metadata: Record<string, string> = {
      type: 'purchase',
      buyerId: buyerId,
      sellerId: isDelegated ? announcement.owner_id : announcement.user_id,
      announcementId: firstItemId,
      totalePagato: (totaleCent / 100).toString(),
      commissioneReLove: (commissioneCent / 100).toString(),
      daTrasferireAlVenditore: (sellerTransferCent / 100).toString(),
    }

    if (isDelegated && mandate) {
      metadata.isDelegated = 'true'
      metadata.mandateId = announcement.mandate_id
      metadata.curatorId = announcement.curator_id
      metadata.ownerPercentage = mandate.owner_percentage.toString()
      metadata.curatorPercentage = mandate.curator_percentage.toString()
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
      metadata,
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore Stripe Checkout:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}