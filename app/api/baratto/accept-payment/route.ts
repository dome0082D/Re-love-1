create table baratti (
  id uuid default uuid_generate_v4() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  item_id uuid references announcements(id),
  user_a_id uuid references auth.users(id),
  user_b_id uuid references auth.users(id),
  stripe_pi_user_a text, -- Qui salviamo l'ID del pagamento congelato dell'Utente A
  status text default 'pending_user_b' -- Stato iniziale
);

-- Abilita l'accesso alla tabella
alter table baratti enable row level security;
create policy "Tutti possono vedere i baratti" on baratti for select using (true);
create policy "Utenti possono inserire baratti" on baratti for insert with check (auth.uid() = user_a_id);