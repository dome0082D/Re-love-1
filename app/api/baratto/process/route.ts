import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Questa riga dice a Vercel di non processare questa pagina durante il caricamento
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Abbiamo spostato l'avvio QUI DENTRO!
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { 
      apiVersion: '2025-03-25.dahlia' 
    });
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // action può essere 'accept' o 'reject'
    const { baratto_id, action } = await req.json(); 

    // 1. Recupera i dati del baratto dal DB per avere l'ID del PaymentIntent dell'Utente A
    const { data: baratto, error: dbError } = await supabase
      .from('baratti')
      .select('*')
      .eq('id', baratto_id)
      .single();

    if (dbError || !baratto) throw new Error('Baratto non trovato nel database');

    const paymentIntentIdA = baratto.stripe_pi_user_a;

    if (action === 'accept') {
      // PUNTO 4: Catturiamo (Capture) definitivamente i 2.50€ congelati dell'Utente A
      await stripe.paymentIntents.capture(paymentIntentIdA);

      // Aggiorna il DB: Segna il baratto come completato e SBLOCCA LA CHAT
      await supabase.from('baratti')
        .update({ status: 'accepted_chat_unlocked' })
        .eq('id', baratto_id);

      return NextResponse.json({ 
        success: true, 
        message: 'Baratto accettato. Pagamenti completati e chat sbloccata.' 
      });

    } else if (action === 'reject') {
      // CANCELLIAMO la pre-autorizzazione dell'Utente A. I soldi si sbloccano subito.
      await stripe.paymentIntents.cancel(paymentIntentIdA);

      // Aggiorna il DB: Segna il baratto come rifiutato
      await supabase.from('baratti')
        .update({ status: 'rejected' })
        .eq('id', baratto_id);

      return NextResponse.json({ 
        success: true, 
        message: 'Baratto rifiutato. Fondi sbloccati per l\'Utente A.' 
      });
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}