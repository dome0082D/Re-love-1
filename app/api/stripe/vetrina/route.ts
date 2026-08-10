import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { aggiungiTagAffiliazioneAmazon } from '@/lib/affiliates/amazonTag'

// FIX: "@/lib/supabase-admin" non esiste in questo progetto (sotto lib/ ci
// sono solo mail.ts e supabase.ts) - era un'assunzione mia, segnalata come
// tale, che si è rivelata sbagliata e ha fatto fallire la build. Il resto
// del progetto (vedi app/api/webhooks/stripe/route.ts) crea il client con
// permessi di servizio così, direttamente nel file che ne ha bisogno,
// invece di importarlo da un modulo condiviso - ci allineiamo a quello.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
)

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const VETRINA_PRICE_CENTS = 299 // 2,99€ - stessa cifra della vecchia Sponsorizza

// NOTA: aggiungiTagAffiliazioneAmazon() ora vive in
// lib/affiliates/amazonTag.ts, condivisa con il resto del progetto (è la
// stessa che affilia anche i risultati della ricerca esterna). Rispetto
// alla vecchia versione locale, quella condivisa in più:
//   - riconosce anche i link accorciati Amazon (amzn.to, amzn.eu)
//   - NON sovrascrive un tag già presente nel link: se chi pubblica ha un
//     proprio account Amazon Associates e il link ha già il suo tag, resta
//     il suo - il nostro tag di default si applica solo quando il link non
//     ne ha già uno. Così, se in futuro sarete in più persone con account
//     affiliati diversi a pubblicare link, ognuno prende la commissione sui
//     link che pubblica lui.
// Il comportamento verso l'utente non cambia in nient'altro: se il link non
// è Amazon, o se AMAZON_PARTNER_TAG non è configurato, il link torna intatto.

// TODO: eBay e AliExpress hanno un meccanismo di affiliazione diverso da
// Amazon - non basta aggiungere un parametro all'indirizzo, serve generare
// il link tramite le loro API (le stesse già scritte tempo fa in
// lib/affiliates/ebay.ts e lib/affiliates/aliexpress.ts per la ricerca
// a vuoto). Per ora un link a quei siti viene salvato così com'è, senza
// affiliazione.

// ============================================================================
// VETRINA GRATUITA (momentaneamente, su richiesta)
//
// Con questo interruttore su "true" la pubblicazione in Vetrina NON passa da
// Stripe: la voce viene creata e attivata subito. Per tornare a farla pagare
// basta rimettere "false" - non serve toccare nient'altro, ne' qui ne' nella
// pagina, ne' nel webhook: tutta la logica di pagamento e' rimasta al suo
// posto, semplicemente scavalcata.
// ============================================================================
const VETRINA_GRATUITA = true

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, type, announcementId, externalUrl, title, description, imageUrl, price, shippingCost } = body

    if (!userId || !type) {
      return NextResponse.json({ error: 'Dati mancanti.' }, { status: 400 })
    }
    if (type !== 'interna' && type !== 'esterna') {
      return NextResponse.json({ error: 'Tipo vetrina non valido.' }, { status: 400 })
    }

    if (type === 'interna') {
      if (!announcementId) {
        return NextResponse.json({ error: 'Annuncio mancante per la vetrina interna.' }, { status: 400 })
      }
      // Verifica server-side che l'annuncio esista e appartenga davvero a
      // chi sta pagando - senza questo controllo chiunque potrebbe pagare
      // per promuovere l'annuncio di qualcun altro.
      const { data: ad, error: adError } = await supabaseAdmin
        .from('announcements')
        .select('id, user_id')
        .eq('id', announcementId)
        .single()
      if (adError || !ad || ad.user_id !== userId) {
        return NextResponse.json({ error: 'Annuncio non trovato o non di tua proprietà.' }, { status: 403 })
      }
    }

    if (type === 'esterna') {
      if (!externalUrl || !title || !price) {
        return NextResponse.json({ error: 'Compila link, titolo e prezzo per la vetrina esterna.' }, { status: 400 })
      }
      if (Number(price) <= 0 || isNaN(Number(price))) {
        return NextResponse.json({ error: 'Il prezzo deve essere maggiore di zero.' }, { status: 400 })
      }
      try {
        const parsed = new URL(externalUrl)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol')
      } catch {
        return NextResponse.json({ error: 'Il link esterno non è un indirizzo valido.' }, { status: 400 })
      }
    }

    // Creiamo subito la voce in vetrina_items, ma NON attiva - diventerà
    // visibile solo quando il webhook Stripe confermerà il pagamento
    // davvero riuscito. Non ci fidiamo mai di un ritorno lato client per
    // sbloccare qualcosa di pagato (lo stesso errore corretto poco fa in
    // dashboard/annunci/page.tsx, dove "?success=true" nell'indirizzo
    // veniva usato per sbloccare la sponsorizzazione senza verifica).
    const { data: item, error: insertError } = await supabaseAdmin
      .from('vetrina_items')
      .insert([{
        user_id: userId,
        type,
        announcement_id: type === 'interna' ? announcementId : null,
        external_url: type === 'esterna' ? aggiungiTagAffiliazioneAmazon(externalUrl) : null,
        title: type === 'esterna' ? title : null,
        description: type === 'esterna' ? (description || null) : null,
        image_url: type === 'esterna' ? (imageUrl || null) : null,
        price: type === 'esterna' ? Number(price) : null,
        shipping_cost: type === 'esterna' ? (Number(shippingCost) || 0) : null,
        // Quando la Vetrina e' gratuita la voce nasce gia' attiva; altrimenti
        // resta spenta finche' il webhook Stripe non conferma il pagamento.
        is_active: VETRINA_GRATUITA,
      }])
      .select()
      .single()

    if (insertError || !item) {
      console.error('Errore creazione voce vetrina:', insertError)
      return NextResponse.json({ error: 'Errore nella creazione della voce Vetrina.' }, { status: 500 })
    }

    // Vetrina gratuita: niente Stripe, la voce e' gia' attiva qui sopra.
    // Rispondiamo senza URL di pagamento e la pagina se ne accorge da sola.
    if (VETRINA_GRATUITA) {
      return NextResponse.json({ gratuita: true, itemId: item.id })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://re-love-rouge.vercel.app'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: type === 'interna'
              ? 'Vetrina Interna - Promozione annuncio Re-love'
              : 'Vetrina Esterna - Promozione link esterno',
          },
          unit_amount: VETRINA_PRICE_CENTS,
        },
        quantity: 1,
      }],
      metadata: {
        type: 'vetrina',
        vetrina_item_id: item.id,
      },
      success_url: `${siteUrl}/vetrina?success=true&item_id=${item.id}`,
      cancel_url: `${siteUrl}/vetrina?canceled=true`,
    })

    if (!session.url) {
      return NextResponse.json({ error: "Errore nell'avvio del pagamento." }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('Errore avvio pagamento vetrina:', err)
    return NextResponse.json({ error: "Errore nell'avvio del pagamento." }, { status: 500 })
  }
}