-- v3.23 — Ligues hebdomadaires (Pacer-like)
-- Tables pour gérer les saisons (semaines) et l'historique des classements.

-- 1) Table des saisons (semaines)
create table if not exists public.league_seasons (
  id uuid primary key default uuid_generate_v4(),
  season_number int not null,
  week_start timestamptz not null,
  week_end timestamptz not null,
  closed_at timestamptz,
  created_at timestamptz default now(),
  unique(season_number)
);

create index if not exists idx_league_seasons_active
  on public.league_seasons (week_start)
  where closed_at is null;

-- 2) Inscription d'un user à une saison (= sa ligue de la semaine)
create table if not exists public.user_league_seasons (
  user_id uuid references public.profiles(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  lang_code lang_code not null,
  tier text not null,
  points_earned int default 0,
  rank_final smallint,  -- rempli au closing de la semaine
  promoted boolean default false,
  relegated boolean default false,
  created_at timestamptz default now(),
  primary key (user_id, season_id, lang_code)
);

create index if not exists idx_user_league_seasons_lookup
  on public.user_league_seasons (season_id, lang_code, tier);

-- 3) Ajouter weekly_target_days dans user_preferences (objectif personnel)
alter table public.user_preferences
  add column if not exists weekly_target_days smallint default 7
    check (weekly_target_days >= 1 and weekly_target_days <= 7);

-- 4) Ajouter days_active_this_week dans user_languages (compteur reset hebdo)
alter table public.user_languages
  add column if not exists days_active_this_week smallint default 0,
  add column if not exists last_active_date date;

-- Vérification
select 'Tables ligue créées' as result;
