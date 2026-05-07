-- v3.23.3 — Table des diplômes obtenus.
-- Insertion automatique depuis /api/quiz/finish quand passed=true.

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  mention text not null check (mention in ('Passable','Bien','Très Bien','Excellent')),
  score numeric not null,
  issued_at timestamptz not null default now(),
  serial text not null unique,
  unique (user_id, level)
);

create index if not exists idx_certificates_user on public.certificates(user_id, issued_at desc);

alter table public.certificates enable row level security;

drop policy if exists "certificates_select_own" on public.certificates;
create policy "certificates_select_own"
  on public.certificates for select
  using (auth.uid() = user_id);

drop policy if exists "certificates_insert_own" on public.certificates;
create policy "certificates_insert_own"
  on public.certificates for insert
  with check (auth.uid() = user_id);
