// app/api/stripe/webhook/route.ts
//
// FIX: esistevano DUE endpoint webhook Stripe attivi contemporaneamente,
// /api/stripe/webhook (questo) e /api/webhooks/stripe. Erano nati come
// copie dello stesso file, ma solo il secondo è stato aggiornato con la
// logica dei sistemi "Curatore Locale" e "Arena ReLove": percentuali
// concordate salvate sulla transazione, sblocco di arena_locked_until,
// notifiche a Proprietario e Promotore.
//
// Il risultato era che, a seconda di quale dei due indirizzi fosse
// configurato nella dashboard Stripe, metà delle funzionalità poteva
// semplicemente non accadere mai - senza alcun errore visibile, perché
// entrambi rispondevano regolarmente "200 OK" a Stripe.
//
// Questo file non contiene più una seconda copia della logica (che
// tornerebbe a divergere alla prossima modifica): inoltra al gestore
// unico. Entrambi gli indirizzi restano quindi validi e si comportano in
// modo identico, qualunque sia quello registrato su Stripe.

export { POST } from '../../webhooks/stripe/route';
