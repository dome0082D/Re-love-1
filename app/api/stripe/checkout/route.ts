export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';
import { statoContoStripe } from '@/lib/stripeAccount';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2026-03-25.dahlia',
});

export async function POST(req: Request) {
  try {
    // Abbiamo aggiunto usePickup per sapere se c'è spedizione o ritiro a mano.
    // NUOVO: "arenaCode" è il codice del link di promozione (?arena=XXXX)
    // con cui l'acquirente ha aperto l'annuncio, se questo è un oggetto in
    // Arena e ha cliccato tramite un link di un promotore - per un
    // acquisto normale (o un Arena senza promotore tracciato) è assente.
    const { items, buyerId, usePickup, arenaCode } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Il carrello è vuoto" }, { status: 400 });
    }

    const firstItemId = items[0].id;
    const quantity = items[0].quantity || 1;
    const offerPrice = items[0].price; // Il prezzo (potrebbe essere scontato da un'offerta)
    
    // NUOVO: aggiunti curator_id, owner_id, mandate_id (Curatore Locale) e
    // is_arena, arena_locked_until (Arena ReLove) alla select. Per un
    // annuncio normale, tutti questi campi sono null/false e tutto il
    // resto del flusso resta identico a prima.
    const { data: announcement } = await supabase
      .from('announcements')
      .select('user_id, price, shipping_cost, condition, quantity, curator_id, owner_id, mandate_id, is_arena, arena_locked_until')
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

    // NUOVO: gestione ARENA RELOVE. Un annuncio può essere sia Curatore
    // Locale sia Arena? Nel dubbio li teniamo separati - se un domani
    // servisse farli convivere, questa è la porta d'ingresso giusta dove
    // aggiungerlo, ma per ora un annuncio in Arena non è mai delegato.
    let isArenaSale = false
    let arenaPromoterId: string | null = null
    let arenaPromoterStripeId: string | null = null

    if (announcement.is_arena) {
      // BLOCCO ANTI-SOVRAPPOSIZIONE: se l'oggetto è già "in trattativa"
      // (qualcun altro ha appena avviato un pagamento), non permettiamo un
      // secondo checkout in parallelo sullo stesso oggetto unico.
      if (announcement.arena_locked_until && new Date(announcement.arena_locked_until) > new Date()) {
        return NextResponse.json({ error: "Questo oggetto è attualmente in trattativa con un altro acquirente. Riprova più tardi." }, { status: 400 })
      }

      // Se è stato usato un link di promozione, cerchiamo chi lo ha
      // generato - SOLO se il codice corrisponde davvero a questo
      // annuncio (non basta un codice valido qualsiasi, deve essere
      // specificamente per QUESTO oggetto).
      if (arenaCode) {
        const { data: promo } = await supabase
          .from('arena_promotions')
          .select('promoter_id')
          .eq('tracking_code', arenaCode)
          .eq('announcement_id', firstItemId)
          .maybeSingle()

        if (promo) {
          const { data: promoterProfile } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id', promo.promoter_id)
            .single()

          // Se per qualche motivo il promotore non ha più un conto valido
          // (lo ha rimosso dopo aver generato il link), la vendita prosegue
          // comunque come vendita normale (90% Proprietario, 10%
          // piattaforma) invece di bloccarsi - il promotore semplicemente
          // non incassa la sua quota in quel caso, ma l'acquirente non
          // deve pagarne le conseguenze.
          if (promoterProfile?.stripe_account_id) {
            isArenaSale = true
            arenaPromoterId = promo.promoter_id
            arenaPromoterStripeId = promoterProfile.stripe_account_id
          }
        }
      }

      // BLOCCO ATOMICO: aggiorniamo "arena_locked_until" SOLO se non
      // risultava già bloccato nel frattempo (stessa tecnica già usata per
      // evitare doppi trasferimenti in app/api/orders/action/route.ts) -
      // così due acquirenti che avviano il checkout nello stesso istante
      // non possono bloccare l'oggetto entrambi.
      const nuovaScadenza = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const oraAttuale = new Date().toISOString()

      const { data: lockedRows, error: lockError } = await supabase
        .from('announcements')
        .update({ arena_locked_until: nuovaScadenza })
        .eq('id', firstItemId)
        .or(`arena_locked_until.is.null,arena_locked_until.lt.${oraAttuale}`)
        .select()

      if (lockError || !lockedRows || lockedRows.length === 0) {
        return NextResponse.json({ error: "Questo oggetto è appena stato messo in trattativa da un altro acquirente. Riprova più tardi." }, { status: 400 })
      }
    }

    // Verifichiamo che chi deve ricevere soldi possa farlo (abbia
    // configurato Stripe). Per un annuncio normale (o Arena senza
    // promotore valido), è solo chi ha pubblicato l'annuncio (user_id).
    // Per un annuncio delegato, servono ENTRAMBI Proprietario e Curatore.
    if (isDelegated) {
      const [ownerProfileRes, curatorProfileRes] = await Promise.all([
        supabase.from('profiles').select('stripe_account_id').eq('id', announcement.owner_id).single(),
        supabase.from('profiles').select('stripe_account_id').eq('id', announcement.curator_id).single(),
      ])
      const ownerStripeId = ownerProfileRes.data?.stripe_account_id || null
      const curatorStripeId = curatorProfileRes.data?.stripe_account_id || null

      // FIX: la sola presenza di stripe_account_id non significa che quel
      // conto possa incassare - viene scritto sul profilo appena si preme
      // "Attiva ricezione pagamenti", prima ancora della configurazione su
      // Stripe. Senza questa verifica un acquirente pagava per un oggetto
      // il cui venditore non poteva ricevere un centesimo, e i soldi
      // restavano bloccati. Chiediamo a Stripe lo stato vero.
      const [statoOwner, statoCurator] = await Promise.all([
        statoContoStripe(ownerStripeId),
        statoContoStripe(curatorStripeId),
      ])

      if (!statoOwner.pronto || !statoCurator.pronto) {
        return NextResponse.json({ error: "Il Proprietario e il Curatore devono avere entrambi completato la configurazione del conto per ricevere pagamenti prima che questo oggetto possa essere venduto." }, { status: 400 })
      }
    } else {
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('stripe_account_id')
        .eq('id', announcement.user_id)
        .single();

      const statoVenditore = await statoContoStripe(sellerProfile?.stripe_account_id)
      if (!statoVenditore.pronto) {
        return NextResponse.json({ error: "Il venditore non ha ancora completato la configurazione per ricevere i pagamenti." }, { status: 400 });
      }
    }

    // 🧮 MATEMATICA E COMMISSIONI
    const finalItemPrice = Math.min(offerPrice, announcement.price); // Previene truffe sul prezzo
    const finalShippingCost = usePickup ? 0 : (announcement.shipping_cost || 0);
    
    // Totale in centesimi per Stripe
    const totaleCent = Math.round(((finalItemPrice * quantity) + finalShippingCost) * 100);
    const commissioneCent = Math.round(totaleCent * 0.10); // Il tuo 10% sul TOTALE!
    const sellerTransferCent = totaleCent - commissioneCent; // Il restante 90% al venditore (o diviso Proprietario/Curatore/Promotore)

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
    // continua a puntare alla persona giusta. Per l'Arena, invece, il
    // venditore resta sempre chi ha pubblicato l'annuncio (announcement.
    // user_id) - l'Arena non cambia CHI possiede l'oggetto, solo come si
    // divide l'incasso quando vince un promotore.
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

    if (isArenaSale && arenaPromoterId) {
      metadata.isArena = 'true'
      metadata.arenaPromoterId = arenaPromoterId
      metadata.arenaOwnerPercentage = '60'
      metadata.arenaPromoterPercentage = '30'
    }

    // CREAZIONE SESSIONE (Modalità Cassaforte / Congelamento Fondi).
    // NUOVO: per un oggetto in Arena, la sessione Stripe scade insieme al
    // nostro blocco "in trattativa" (30 minuti) - così se l'acquirente
    // abbandona il pagamento, sia Stripe che il nostro database tornano
    // liberi nello stesso momento, senza restare disallineati.
    const sessionConfig: any = {
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
    }

    if (announcement.is_arena) {
      sessionConfig.expires_at = Math.floor(Date.now() / 1000) + 30 * 60
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error("Errore Stripe Checkout:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}