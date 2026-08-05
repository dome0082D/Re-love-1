import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, type, announcementId, externalUrl, title, imageUrl, price } = body

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
        external_url: type === 'esterna' ? externalUrl : null,
        title: type === 'esterna' ? title : null,
        image_url: type === 'esterna' ? (imageUrl || null) : null,
        price: type === 'esterna' ? Number(price) : null,
        is_active: false,
      }])
      .select()
      .single()

    if (insertError || !item) {
      console.error('Errore creazione voce vetrina:', insertError)
      return NextResponse.json({ error: 'Errore nella creazione della voce Vetrina.' }, { status: 500 })
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