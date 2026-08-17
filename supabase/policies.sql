-- ============================================================================
-- Re-love - POLICY DI SICUREZZA (Row Level Security)
--
-- COME SI USA
--   Supabase -> SQL Editor -> incolla tutto -> Run.
--   Si puo' rilanciare quante volte si vuole: ogni policy viene prima
--   eliminata e poi ricreata, quindi non da' mai errore "already exists".
--
-- ============================================================================
-- PERCHE' SERVE
--
-- Diverse tabelle hanno la RLS ATTIVA ma NESSUNA policy per certe operazioni.
-- In quel caso PostgREST non restituisce un errore: risponde 200 e tocca
-- ZERO righe. Tutto il sito interpretava quel 200 come "riuscito". Verificato
-- sul database di produzione, con un utente vero che agiva su roba SUA:
--
--     DELETE messages (proprio)       -> 200, righe toccate: 0
--     UPDATE notifications is_read    -> 200, righe toccate: 0
--     DELETE notifications (propria)  -> 200, righe toccate: 0
--     INSERT favorites                -> 403 (nessuna policy di INSERT)
--     INSERT bids                     -> 403 (nessuna policy di INSERT)
--
-- Conseguenze concrete: i messaggi cancellati ricomparivano al ricaricamento,
-- il pallino rosso delle notifiche non si azzerava mai, il cuoricino dei
-- preferiti non salvava nulla, e i rilanci d'asta non lasciavano traccia di
-- chi avesse rilanciato.
--
-- NOTA IMPORTANTE
-- L'app funziona GIA' senza questo file: le stesse operazioni passano da
-- route server (/api/notifications, /api/messages/delete, /api/favorites,
-- /api/bids) che usano la chiave di servizio dopo aver verificato l'identita'
-- dal token di sessione. Applicando queste policy quelle route continuano a
-- funzionare identiche - semplicemente il database smette di essere il collo
-- di bottiglia, e le stesse azioni tornano possibili anche direttamente dal
-- browser, piu' veloci e senza passare dal server.
-- ============================================================================


-- ---------------------------------------------------------------- NOTIFICHE
-- Ognuno vede, segna come lette ed elimina SOLO le proprie.
-- L'inserimento resta escluso di proposito: una notifica la crea il server
-- (route /api/notify, con chiave di servizio), altrimenti chiunque potrebbe
-- scrivere avvisi a nome del sito nella campanella di chiunque altro.
alter table public.notifications enable row level security;

drop policy if exists "notifiche: leggo le mie" on public.notifications;
create policy "notifiche: leggo le mie"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "notifiche: segno lette le mie" on public.notifications;
create policy "notifiche: segno lette le mie"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifiche: elimino le mie" on public.notifications;
create policy "notifiche: elimino le mie"
  on public.notifications for delete
  using (auth.uid() = user_id);


-- ---------------------------------------------------------------- MESSAGGI
-- Si leggono i messaggi di cui si e' mittente O destinatario.
-- Si scrive solo a proprio nome, e si cancella solo cio' che si e' scritto:
-- ricevere un messaggio non da' il diritto di cancellarlo anche all'altro.
alter table public.messages enable row level security;

drop policy if exists "messaggi: leggo i miei" on public.messages;
create policy "messaggi: leggo i miei"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messaggi: scrivo a mio nome" on public.messages;
create policy "messaggi: scrivo a mio nome"
  on public.messages for insert
  with check (auth.uid() = sender_id);

drop policy if exists "messaggi: segno letti quelli ricevuti" on public.messages;
create policy "messaggi: segno letti quelli ricevuti"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists "messaggi: elimino i miei" on public.messages;
create policy "messaggi: elimino i miei"
  on public.messages for delete
  using (auth.uid() = sender_id);


-- --------------------------------------------------------------- PREFERITI
-- Elenco privato: ognuno vede, aggiunge e toglie solo i propri.
alter table public.favorites enable row level security;

drop policy if exists "preferiti: leggo i miei" on public.favorites;
create policy "preferiti: leggo i miei"
  on public.favorites for select
  using (auth.uid() = user_id);

drop policy if exists "preferiti: aggiungo i miei" on public.favorites;
create policy "preferiti: aggiungo i miei"
  on public.favorites for insert
  with check (auth.uid() = user_id);

drop policy if exists "preferiti: tolgo i miei" on public.favorites;
create policy "preferiti: tolgo i miei"
  on public.favorites for delete
  using (auth.uid() = user_id);


-- ------------------------------------------------------------ RILANCI ASTA
-- Lo storico dei rilanci e' pubblico (serve a mostrare la gara), ma si
-- rilancia solo a proprio nome. Niente UPDATE ne' DELETE: un'offerta gia'
-- fatta non si modifica e non si cancella, altrimenti sparirebbe la prova di
-- chi ha vinto l'asta.
alter table public.bids enable row level security;

drop policy if exists "rilanci: sono pubblici" on public.bids;
create policy "rilanci: sono pubblici"
  on public.bids for select
  using (true);

drop policy if exists "rilanci: rilancio a mio nome" on public.bids;
create policy "rilanci: rilancio a mio nome"
  on public.bids for insert
  with check (auth.uid() = bidder_id);


-- ------------------------------------------------------------- RECENSIONI
-- Pubbliche in lettura (servono a costruire la reputazione di un venditore).
-- Si scrive solo a proprio nome e non si puo' recensire se stessi.
alter table public.reviews enable row level security;

drop policy if exists "recensioni: sono pubbliche" on public.reviews;
create policy "recensioni: sono pubbliche"
  on public.reviews for select
  using (true);

drop policy if exists "recensioni: scrivo a mio nome" on public.reviews;
create policy "recensioni: scrivo a mio nome"
  on public.reviews for insert
  with check (auth.uid() = reviewer_id and auth.uid() <> reviewed_id);

drop policy if exists "recensioni: correggo le mie" on public.reviews;
create policy "recensioni: correggo le mie"
  on public.reviews for update
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);

drop policy if exists "recensioni: elimino le mie" on public.reviews;
create policy "recensioni: elimino le mie"
  on public.reviews for delete
  using (auth.uid() = reviewer_id);


-- ------------------------------------------- CONVERSAZIONI NASCOSTE
-- Preferenza privata di visualizzazione: riguarda solo chi la imposta.
alter table public.hidden_conversations enable row level security;

drop policy if exists "nascoste: leggo le mie" on public.hidden_conversations;
create policy "nascoste: leggo le mie"
  on public.hidden_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "nascoste: nascondo per me" on public.hidden_conversations;
create policy "nascoste: nascondo per me"
  on public.hidden_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "nascoste: le riporto a galla" on public.hidden_conversations;
create policy "nascoste: le riporto a galla"
  on public.hidden_conversations for delete
  using (auth.uid() = user_id);


-- ----------------------------------------------------- VOCI DELLA VETRINA
-- Le voci attive sono visibili a tutti (e' una vetrina), ma ognuno modifica
-- e cancella solo le proprie. La cancellazione da parte dello staff continua
-- a passare dalla route server con chiave di servizio: non serve una policy
-- che dia a un utente qualsiasi il potere di toccare le voci altrui.
alter table public.vetrina_items enable row level security;

drop policy if exists "vetrina: le voci attive sono pubbliche" on public.vetrina_items;
create policy "vetrina: le voci attive sono pubbliche"
  on public.vetrina_items for select
  using (is_active = true or auth.uid() = user_id);

drop policy if exists "vetrina: modifico le mie" on public.vetrina_items;
create policy "vetrina: modifico le mie"
  on public.vetrina_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "vetrina: elimino le mie" on public.vetrina_items;
create policy "vetrina: elimino le mie"
  on public.vetrina_items for delete
  using (auth.uid() = user_id);


-- --------------------------------------------------------------- CATEGORIE
-- L'elenco delle categorie e' un dato pubblico del sito (serve nel menu
-- laterale). Senza una policy di lettura la tabella rispondeva 200 con un
-- elenco VUOTO anche a chi era autenticato, e la sezione "Categorie" del
-- menu restava sempre vuota senza che nulla segnalasse un errore.
alter table public.categories enable row level security;

drop policy if exists "categorie: sono pubbliche" on public.categories;
create policy "categorie: sono pubbliche"
  on public.categories for select
  using (true);


-- ------------------------------------------------------------------ BARATTI
-- Riguarda solo le due persone coinvolte nello scambio.
alter table public.baratti enable row level security;

drop policy if exists "baratti: leggo i miei" on public.baratti;
create policy "baratti: leggo i miei"
  on public.baratti for select
  using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- Creazione e cambi di stato passano dalle route server (/api/baratto/*),
-- che verificano l'identita' e gestiscono i pagamenti: nessuna policy di
-- INSERT/UPDATE per il browser, di proposito.


-- ============================================================================
-- CONTROLLO FINALE
-- Elenca le policy attive sulle tabelle toccate qui sopra. Se una riga manca,
-- quella specifica operazione continuera' a "riuscire" senza toccare nulla.
-- ============================================================================
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'notifications','messages','favorites','bids','reviews',
    'hidden_conversations','vetrina_items','baratti','categories'
  )
order by tablename, cmd, policyname;
