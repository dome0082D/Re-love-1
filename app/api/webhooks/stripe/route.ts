import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2026-03-25.dahlia' });

// FIX: questo file scriveva usando il client con chiave ANONIMA (lo stesso
// che usa il browser) dentro un webhook - cioè una richiesta server-to-server
// da Stripe, senza alcuna sessione utente. Se le tabelle 'announcements',
// 'transactions' o 'unlocked_chats' hanno una Row Level Security tipica
// (che richiede un utente autenticato), questi scritti fallivano in
// silenzio: Stripe vedeva comunque "200 OK" e non ritentava mai, ma
// l'annuncio non risultava mai sponsorizzato, la chat mai sbloccata, la
// transazione mai salvata. Il client con chiave di servizio bypassa la RLS,
// com'è corretto per un webhook.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

export async function POST(req: Request) {
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature') as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET || '');
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    const announcementId = session.metadata?.announcementId || session.metadata?.productId;
    const buyerId = session.metadata?.buyerId;
    const sellerId = session.metadata?.sellerId;
    const checkoutType = session.metadata?.type;

    // NUOVO: dati del sistema "Curatore Locale", presenti solo se questo
    // acquisto riguarda un annuncio delegato (vedi app/api/stripe/checkout).
    const isDelegated = session.metadata?.isDelegated === 'true'
    const mandateId = session.metadata?.mandateId || null
    const curatorId = session.metadata?.curatorId || null
    const ownerPercentage = session.metadata?.ownerPercentage ? Number(session.metadata.ownerPercentage) : null
    const curatorPercentage = session.metadata?.curatorPercentage ? Number(session.metadata.curatorPercentage) : null

    // NUOVO: dati del sistema "Arena ReLove", presenti solo se questo
    // acquisto è avvenuto tramite il link tracciato di un promotore su un
    // oggetto in Arena (vedi app/api/stripe/checkout).
    const isArena = session.metadata?.isArena === 'true'
    const arenaPromoterId = session.metadata?.arenaPromoterId || null
    const arenaOwnerPercentage = session.metadata?.arenaOwnerPercentage ? Number(session.metadata.arenaOwnerPercentage) : null
    const arenaPromoterPercentage = session.metadata?.arenaPromoterPercentage ? Number(session.metadata.arenaPromoterPercentage) : null

    // ==========================================
    // LOGICA 1: SPONSORIZZAZIONE VETRINA
    // ==========================================
    if (checkoutType === 'sponsorship' && announcementId) {
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
    // LOGICA 2: SBLOCCO CHAT (CAFFÈ) - AGGIUNTA!
    // ==========================================
    if (checkoutType === 'chat_unlock' && announcementId && buyerId) {
      await supabaseAdmin
        .from('unlocked_chats')
        .insert([{ 
          user_id: buyerId, 
          announcement_id: announcementId 
        }]);

      console.log(`🔓 Chat sbloccata per l'utente ${buyerId}`);
      return NextResponse.json({ received: true, chat_unlocked: true });
    }

    // ==========================================
    // LOGICA 3: VENDITA OGGETTO (Modificata per non confondersi)
    // ==========================================
    if (announcementId && buyerId && checkoutType !== 'chat_unlock' && checkoutType !== 'sponsorship') {
       // Salva la transazione. NUOVO: se l'acquisto riguarda un annuncio
       // delegato (Curatore Locale) o un oggetto in Arena vinto da un
       // promotore, salviamo anche i dati e le percentuali concordate al
       // momento dell'acquisto ("fotografate" qui, così se le regole
       // generali cambiano più avanti, questo ordine già in corso non ne
       // risente). Per un acquisto normale questi campi restano tutti
       // null, esattamente come prima.
       await supabaseAdmin.from('transactions').insert([{
         announcement_id: announcementId,
         buyer_id: buyerId,
         seller_id: sellerId || null,
         stripe_payment_intent_id: session.payment_intent,
         amount: session.amount_total ? session.amount_total / 100 : 0,
         status: 'held',
         mandate_id: isDelegated ? mandateId : null,
         curator_id: isDelegated ? curatorId : null,
         owner_percentage_snapshot: isDelegated ? ownerPercentage : null,
         curator_percentage_snapshot: isDelegated ? curatorPercentage : null,
         arena_promoter_id: isArena ? arenaPromoterId : null,
         arena_owner_percentage_snapshot: isArena ? arenaOwnerPercentage : null,
         arena_promoter_percentage_snapshot: isArena ? arenaPromoterPercentage : null,
       }]);

       // Scala la quantità
       const { data: ann } = await supabaseAdmin
         .from('announcements')
         .select('quantity')
         .eq('id', announcementId)
         .single();

       if (ann) {
         const nuovaQuantita = Math.max(0, (ann.quantity || 1) - 1);
         await supabaseAdmin
           .from('announcements')
           .update({ quantity: nuovaQuantita })
           .eq('id', announcementId);
       }

       // NUOVO: se l'oggetto era in Arena, la vendita si è appena conclusa
       // per davvero - togliamo il blocco "in trattativa", non serve più
       // tenerlo (la quantità appena azzerata basta a far sparire
       // l'oggetto dagli elenchi, questo è solo per pulizia dei dati).
       // Per un annuncio normale questo campo è comunque già vuoto, quindi
       // l'aggiornamento non ha alcun effetto collaterale.
       await supabaseAdmin
         .from('announcements')
         .update({ arena_locked_until: null })
         .eq('id', announcementId)

       // NUOVO: se questa vendita riguarda un annuncio delegato (Curatore
       // Locale), avvisiamo il Proprietario che lo scambio e' partito -
       // "sellerId" nei metadata e' gia' il suo id per una vendita
       // delegata (vedi app/api/stripe/checkout), quindi basta notificare
       // quello. Per una vendita normale "sellerId" e' comunque chi ha
       // pubblicato l'annuncio, quindi non cambia nulla per lui.
       if (isDelegated && sellerId) {
         await supabaseAdmin.from('notifications').insert([{
           user_id: sellerId,
           message: `🛒 Il tuo oggetto e' stato acquistato tramite il Curatore! Lo scambio e' avviato.`,
           is_read: false,
         }])
       }

       // NUOVO: se la vendita e' avvenuta tramite un promotore Arena,
       // avvisiamo sia il Proprietario (che conoscera' il valore finale)
       // sia il Promotore vincitore, in trasparenza reciproca - stessa
       // logica di trasparenza gia' applicata al Curatore Locale.
       if (isArena && arenaPromoterId && sellerId) {
         await supabaseAdmin.from('notifications').insert([{
           user_id: sellerId,
           message: `🏆 Il tuo oggetto in Arena e' stato venduto tramite un promotore della community! Lo scambio e' avviato.`,
           is_read: false,
         }])
         await supabaseAdmin.from('notifications').insert([{
           user_id: arenaPromoterId,
           message: `🎉 Hai vinto l'Arena! Il tuo link ha portato alla vendita. Riceverai la tua quota a scambio confermato.`,
           is_read: false,
         }])
       }
    }
  }

  return NextResponse.json({ received: true });
}