-- ============================================================================
-- SPOSTA I VINCOLI DALLA VECCHIA TABELLA DEI MANDATI ALLE CANDIDATURE.
--
-- Perche' serve: "announcements.mandate_id" e' la colonna che dice quale
-- accordo di curatela vale su quell'oggetto, e da cui il pagamento legge le
-- percentuali. Aveva un vincolo che la obbligava a puntare a
-- "curator_mandates", la tabella del vecchio sistema a QR. Ora deve puntare a
-- "curator_candidature", e senza questa modifica accettare una candidatura
-- falliva con:
--
--     violates foreign key constraint "announcements_mandate_id_fkey"
--     Key (mandate_id)=(...) is not present in table "curator_mandates"
--
-- Il nome del vincolo non viene indovinato: lo cerchiamo nel catalogo di
-- Postgres, cosi' funziona anche se nel tuo database si chiama diversamente.
--
-- Nessun annuncio punta piu' a un vecchio mandato (verificato: zero righe),
-- quindi lo spostamento e' sicuro.
--
-- Da eseguire nell'editor SQL di Supabase. Si puo' rieseguire senza danni.
-- ============================================================================

-- ------------------------------------------------------------- ANNUNCI
do $$
declare v record;
begin
  -- Via ogni vincolo di "announcements.mandate_id", chiunque sia il bersaglio.
  for v in
    select con.conname
    from pg_constraint con
    join pg_class tab on tab.oid = con.conrelid
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and tab.relname = 'announcements'
      and att.attname = 'mandate_id'
  loop
    execute format('alter table public.announcements drop constraint %I', v.conname);
  end loop;

  -- Ricreato verso la tabella giusta. "on delete set null": se una
  -- candidatura venisse cancellata, l'annuncio resta - torna solo senza
  -- curatore. Cancellare l'annuncio di qualcuno per via di una candidatura
  -- sarebbe un danno sproporzionato.
  alter table public.announcements
    add constraint announcements_mandate_id_fkey
    foreign key (mandate_id)
    references public.curator_candidature(id)
    on delete set null;
end $$;

-- ---------------------------------------------------------- TRANSAZIONI
-- Qui il vincolo lo togliamo e NON lo rimettiamo, di proposito: una
-- transazione e' un documento storico di una vendita avvenuta, e non deve
-- poter essere toccata da quello che succede dopo all'incarico che l'ha
-- generata. Le percentuali applicate sono comunque gia' fotografate nelle
-- colonne "owner_percentage_snapshot" e "curator_percentage_snapshot" della
-- transazione stessa, quindi non si perde nessuna informazione.
do $$
declare v record;
begin
  for v in
    select con.conname
    from pg_constraint con
    join pg_class tab on tab.oid = con.conrelid
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
    where con.contype = 'f'
      and tab.relname = 'transactions'
      and att.attname = 'mandate_id'
  loop
    execute format('alter table public.transactions drop constraint %I', v.conname);
  end loop;
end $$;

-- ------------------------------------------------------------ CONTROLLO
-- Cosa punta a cosa, dopo la modifica. Ci si aspetta una riga sola:
-- announcements.mandate_id -> curator_candidature.
select
  tab.relname   as tabella,
  att.attname   as colonna,
  rif.relname   as punta_a,
  con.conname   as nome_vincolo
from pg_constraint con
join pg_class tab on tab.oid = con.conrelid
join pg_class rif on rif.oid = con.confrelid
join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
where con.contype = 'f'
  and att.attname = 'mandate_id'
order by tab.relname;
