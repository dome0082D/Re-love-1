import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { notificaUtente } from '@/lib/pushServer';

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


    // ==========================================
    // LOGICA 0: BARATTO (due momenti di pagamento)
    // ==========================================
    // NUOVO: il sistema "Baratto" aveva le route server ma nessuna pagina che
    // le chiamasse e nessuna gestione qui: i pagamenti non sarebbero mai
    // stati riconosciuti. Sono due passaggi distinti:
    //
    //  baratto_auth   -> chi propone ha pre-autorizzato la sua quota. I soldi
    //                    sono congelati, NON prelevati. La proposta diventa
    //                    visibile al destinatario, che viene avvisato.
    //  baratto_accept -> il destinatario ha pagato la sua quota. Solo ORA
    //                    preleviamo davvero la quota congelata di chi ha
    //                    proposto, e lo scambio si apre per entrambi.
    if (checkoutType === 'baratto_auth' || checkoutType === 'baratto_accept') {
      const barattoId = session.metadata?.barattoId
      const userA = session.metadata?.userA
      const userB = session.metadata?.userB
      const itemId = session.metadata?.itemId

      if (!barattoId) return NextResponse.json({ received: true, baratto: 'metadati mancanti' })

      const { data: oggetto } = await supabaseAdmin
        .from('announcements')
        .select('title')
        .eq('id', itemId || '')
        .maybeSingle()
      const titolo = oggetto?.title || 'un oggetto'

      if (checkoutType === 'baratto_auth') {
        await supabaseAdmin
          .from('baratti')
          .update({
            // Serve conservarlo: e' questo l'identificativo da catturare (o
            // da annullare, in caso di rifiuto) piu' avanti.
            stripe_pi_user_a: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            status: 'pending_user_b',
          })
          .eq('id', barattoId)

        await notificaUtente(
          userB,
          `🤝 Hai ricevuto una proposta di baratto per "${titolo}". Accettala o rifiutala dalla pagina Baratti.`,
          'Proposta di baratto 🤝',
          '/baratti',
          true
        )

        return NextResponse.json({ received: true, baratto: 'proposta inviata' })
      }

      // baratto_accept: ora si preleva davvero la quota congelata di chi ha
      // proposto. Se questa cattura fallisce NON apriamo lo scambio: meglio
      // fermarsi che far pagare uno solo dei due.
      const { data: baratto } = await supabaseAdmin
        .from('baratti')
        .select('stripe_pi_user_a, status')
        .eq('id', barattoId)
        .maybeSingle()

      if (baratto?.stripe_pi_user_a) {
        try {
          await stripe.paymentIntents.capture(baratto.stripe_pi_user_a)
        } catch (errCattura) {
          console.error('[Webhook/Baratto] Cattura quota del proponente fallita:', errCattura)
          return NextResponse.json({ received: true, baratto: 'cattura fallita' })
        }
      }

      await supabaseAdmin.from('baratti').update({ status: 'accepted_chat_unlocked' }).eq('id', barattoId)

      // Sblocco della conversazione per entrambi: e' esattamente cio' per cui
      // hanno pagato la quota.
      if (itemId) {
        await supabaseAdmin.from('unlocked_chats').insert([
          { user_id: userA, announcement_id: itemId },
          { user_id: userB, announcement_id: itemId },
        ])
      }

      // Un primo messaggio di servizio, così la conversazione esiste davvero
      // e le due persone si trovano già in chat invece di dover ricominciare
      // da capo a cercarsi.
      if (userA && userB) {
        await supabaseAdmin.from('messages').insert([{
          sender_id: userA,
          receiver_id: userB,
          content: `🤝 Baratto attivato per "${titolo}". Mettetevi d'accordo qui su cosa scambiare e come consegnarvi gli oggetti.`,
        }])
      }

      const avviso = `🤝 Baratto attivato per "${titolo}"! Potete accordarvi in chat.`
      await notificaUtente(userA, avviso, 'Baratto attivato 🤝', '/chat', true)
      await notificaUtente(userB, avviso, 'Baratto attivato 🤝', '/chat', true)

      return NextResponse.json({ received: true, baratto: 'attivato' })
    }

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
       // delegato (Curatore Locale) o un
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

       // NUOVO: se questa vendita riguarda un annuncio delegato (Curatore
       // Locale), avvisiamo il Proprietario che lo scambio e' partito -
       // "sellerId" nei metadata e' gia' il suo id per una vendita
       // delegata (vedi app/api/stripe/checkout), quindi basta notificare
       // quello. Per una vendita normale "sellerId" e' comunque chi ha
       // pubblicato l'annuncio, quindi non cambia nulla per lui.
       // FIX: per una vendita NORMALE non veniva avvisato nessuno - ne'
       // il venditore che aveva appena venduto, ne' il compratore che
       // aveva appena pagato. Ora l'evento piu' importante del sito avvisa
       // sempre entrambe le parti, con notifica in-app e push.
       await notificaUtente(
         sellerId,
         isDelegated
           ? `🛒 Il tuo oggetto e' stato acquistato tramite il Curatore! Lo scambio e' avviato.`
           : `🛒 Hai venduto un oggetto! Prepara la spedizione: l'importo resta protetto fino alla consegna.`,
         'Oggetto venduto 🛒',
         '/orders',
         true // anche via email: e' l'evento piu' importante del sito
       )
       await notificaUtente(
         buyerId,
         `✅ Pagamento riuscito! Il venditore e' stato avvisato e prepara la spedizione.`,
         'Acquisto confermato ✅',
         '/dashboard/acquisti',
         true // anche via email: vale come ricevuta dell'acquisto
       )

    }
  }

  return NextResponse.json({ received: true });
}