-- ============================================================================
-- CANDIDATURE CURATORE
--
-- Sostituisce il vecchio meccanismo a QR (mandati di delega). Come funziona
-- adesso:
--
--   1. Il Proprietario pubblica il suo annuncio e spunta "cerco un curatore",
--      indicando quale percentuale della vendita e' disposto a cedergli.
--   2. Un altro utente apre l'annuncio e preme "Candidati come curatore".
--      La candidatura resta in attesa: da sola non autorizza nulla.
--   3. Il Proprietario la accetta o la rifiuta. Solo con l'accettazione il
--      curatore viene davvero autorizzato a vendere l'oggetto per lui, e la
--      divisione dell'incasso entra in vigore.
--   4. Il Proprietario puo' revocare in qualsiasi momento, se non c'e' una
--      vendita gia' pagata in corso.
--
-- Gli oggetti in Arena si candidano SOLO dalla pagina Arena: e' una regola di
-- prodotto, applicata anche qui sotto perche' il database non deve dipendere
-- dalla buona fede dell'interfaccia.
--
-- Da eseguire nell'editor SQL di Supabase. Si puo' rieseguire senza danni.
-- ============================================================================

-- ---------------------------------------------------------------- ANNUNCI
-- Due colonne nuove: se l'annuncio cerca un curatore, e quanto offre.
alter table public.announcements
  add column if not exists cerca_curatore boolean not null default false;

alter table public.announcements
  add column if not exists curator_percentage numeric;

-- La commissione Re-love e' fissa al 10%: al curatore si puo' cedere da 0 a
-- 90. Senza questo vincolo un errore di battitura ("200") produrrebbe una
-- vendita in cui al Proprietario resta un importo negativo.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'announcements_curator_percentage_valida'
  ) then
    alter table public.announcements
      add constraint announcements_curator_percentage_valida
      check (curator_percentage is null or (curator_percentage >= 0 and curator_percentage <= 90));
  end if;
end $$;

-- ------------------------------------------------------------ CANDIDATURE
create table if not exists public.curator_candidature (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  -- Chi si candida.
  curator_id uuid not null references auth.users(id) on delete cascade,
  -- Copiato dall'annuncio al momento della candidatura: serve per elencare in
  -- fretta "le candidature che aspettano una mia risposta" senza ogni volta
  -- passare dalla tabella degli annunci.
  owner_id uuid not null references auth.users(id) on delete cascade,
  stato text not null default 'in_attesa'
    check (stato in ('in_attesa', 'accettata', 'rifiutata', 'revocata')),
  -- Fotografia della percentuale offerta al momento dell'accettazione: se il
  -- Proprietario domani cambia l'offerta sull'annuncio, l'accordo gia' preso
  -- non deve cambiare sotto i piedi del curatore.
  curator_percentage numeric not null default 20
    check (curator_percentage >= 0 and curator_percentage <= 90),
  messaggio text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,

  -- ------------------------------------------------------------------------
  -- IL COMPENSO SI GUADAGNA, NON SI EREDITA.
  --
  -- Senza queste tre colonne bastava farsi accettare una volta per incassare
  -- su OGNI vendita di quell'oggetto, anche quando il compratore era arrivato
  -- da solo e il curatore non aveva fatto niente.
  --
  -- Adesso funziona come l'Arena: al momento dell'accettazione il curatore
  -- riceve un link personale. La sua percentuale scatta SOLO sulle vendite
  -- arrivate da quel link; se il compratore arriva per conto suo, l'incasso
  -- va tutto al proprietario. Vale identico per gli annunci normali e per
  -- quelli in Arena: una regola sola.
  --
  -- "scade_il" chiude gli incarichi rimasti fermi: se entro la scadenza il
  -- curatore non ha portato nessuna vendita, l'incarico decade da solo e
  -- l'oggetto torna libero per altre candidature.
  -- ------------------------------------------------------------------------
  tracking_code text unique,
  clicks integer not null default 0,
  scade_il timestamptz
);

-- Se la tabella esisteva gia' da una esecuzione precedente, "create table if
-- not exists" qui sopra non ha fatto niente e le colonne aggiunte dopo non ci
-- sono. Le aggiungiamo qui.
--
-- ATTENZIONE ALL'ORDINE: queste tre righe devono stare PRIMA degli indici,
-- perche' un indice su una colonna che non esiste ancora fa fallire tutto lo
-- script con "column tracking_code does not exist".
alter table public.curator_candidature add column if not exists tracking_code text;
alter table public.curator_candidature add column if not exists clicks integer not null default 0;
alter table public.curator_candidature add column if not exists scade_il timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'curator_candidature_tracking_code_key'
  ) then
    alter table public.curator_candidature
      add constraint curator_candidature_tracking_code_key unique (tracking_code);
  end if;
end $$;

-- Una sola candidatura in attesa per persona su ogni annuncio: senza questo,
-- premere due volte il pulsante lascia due richieste identiche da smaltire.
create unique index if not exists curator_candidature_una_in_attesa
  on public.curator_candidature (announcement_id, curator_id)
  where stato = 'in_attesa';

-- Un solo curatore accettato per annuncio.
create unique index if not exists curator_candidature_un_solo_accettato
  on public.curator_candidature (announcement_id)
  where stato = 'accettata';

create index if not exists curator_candidature_per_proprietario
  on public.curator_candidature (owner_id, stato);
create index if not exists curator_candidature_per_curatore
  on public.curator_candidature (curator_id, stato);

-- Chi apre un link personale non ha ancora fatto accesso: la ricerca per
-- codice deve essere immediata, e avviene a ogni apertura di annuncio.
create index if not exists curator_candidature_per_codice
  on public.curator_candidature (tracking_code);

-- Serve al lavoro notturno che chiude gli incarichi rimasti fermi.
create index if not exists curator_candidature_scadenze
  on public.curator_candidature (scade_il)
  where stato = 'accettata';

-- ------------------------------------------------------------------- RLS
-- Tutte le scritture passano dalle route server (che verificano il token di
-- sessione e usano la chiave di servizio). Qui apriamo la SOLA lettura, e
-- solo alle due persone coinvolte: una candidatura dice che Tizio si e'
-- offerto di vendere l'oggetto di Caio, e non riguarda nessun altro.
alter table public.curator_candidature enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'curator_candidature'
  loop
    execute format('drop policy if exists %I on public.curator_candidature', p.policyname);
  end loop;
end $$;

create policy "le mie candidature le vedo io"
  on public.curator_candidature for select
  to authenticated
  using (auth.uid() = curator_id or auth.uid() = owner_id);

-- Nessuna policy di insert/update/delete: dal browser non si scrive. Le route
-- server usano la chiave di servizio e scavalcano RLS, dopo aver verificato
-- chi sta chiedendo. E' la stessa scelta gia' fatta per notifiche, messaggi,
-- preferiti e rilanci, dopo aver visto che PostgREST risponde "200 con zero
-- righe" quando una policy manca: un fallimento che il codice scambia per
-- successo.
