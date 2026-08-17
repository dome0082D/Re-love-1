// lib/baratto.ts
// Valori condivisi del sistema "Baratto", usati sia dalla route che avvia la
// proposta sia da quella che la accetta: tenerli in un solo posto evita che
// le due quote possano divergere per una modifica fatta solo da una parte.

/** Quota di attivazione del baratto, per ciascuna delle due parti. In centesimi. */
export const QUOTA_BARATTO_CENT = 250

/** Stati possibili di una richiesta di baratto. */
export const STATI_BARATTO = {
  attesaPagamentoA: 'in_attesa_pagamento_a',
  attesaRispostaB: 'pending_user_b',
  attivo: 'accepted_chat_unlocked',
  rifiutato: 'rejected',
} as const
