-- =============================================================
--  v3.6 — Captation des corrections du coach pour révision spaced repetition
-- =============================================================
-- Quand l'utilisateur clique sur 💡 sur un de ses messages en mode Tuteur,
-- la correction renvoyée par /api/coach/correct est automatiquement sauvée ici.
-- Elle peut ensuite être révisée comme un concept, avec FSRS (réutilise le
-- même algorithme que user_progress).
-- =============================================================

create table if not exists public.coach_corrections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lang_code lang_code not null default 'en-GB',
  source_mode text not null default 'tuteur'
    check (source_mode in ('ami','auto','tuteur','speaking_pur','pro_grc')),
  original_text text not null,
  corrected_text text not null,
  reason text,
  fsrs_state jsonb not null default '{}'::jsonb,
  last_review timestamptz,
  next_review timestamptz default now(),
  lapses smallint default 0,
  consec_correct smallint default 0,
  created_at timestamptz default now()
);

create index if not exists idx_coach_corrections_user_next
  on public.coach_corrections (user_id, next_review)
  where next_review is not null;

-- Anti-doublon léger : si une même phrase est corrigée 2 fois, on garde la
-- plus récente (l'ancienne est mise à jour, pas dupliquée).
create unique index if not exists uq_coach_corrections_user_orig
  on public.coach_corrections (user_id, lang_code, original_text);

alter table public.coach_corrections enable row level security;

create policy "Users CRUD own coach_corrections"
  on public.coach_corrections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.coach_corrections is
  'v3.6 — Corrections du coach (mode Tuteur principalement) pour révision FSRS.';
