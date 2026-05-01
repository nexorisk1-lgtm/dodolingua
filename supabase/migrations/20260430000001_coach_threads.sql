-- =============================================================
--  v3.5 — Persistance des fils de conversation coach par user/mode
-- =============================================================
-- Permet de retrouver l'historique entre sessions / refreshes.
-- 1 ligne par couple (user_id, mode). Le tableau de messages est en JSONB.
-- =============================================================

create table if not exists public.coach_threads (
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('ami','auto','tuteur','speaking_pur','pro_grc')),
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, mode)
);

create index if not exists idx_coach_threads_updated_at
  on public.coach_threads (user_id, updated_at desc);

-- Auto-update updated_at à chaque write
create or replace function public.touch_coach_threads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_coach_threads_touch on public.coach_threads;
create trigger trg_coach_threads_touch
  before insert or update on public.coach_threads
  for each row execute function public.touch_coach_threads_updated_at();

-- RLS : chaque user CRUD uniquement ses propres threads
alter table public.coach_threads enable row level security;

create policy "Users CRUD own coach_threads"
  on public.coach_threads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.coach_threads is
  'v3.5 — Fils de conversation coach persistés par user et par mode. messages = JSONB array de {role, text, wordScores?, hasTarget?}.';
