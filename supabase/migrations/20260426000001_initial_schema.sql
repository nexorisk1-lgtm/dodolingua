-- =============================================================
--  Application langues — Schéma initial (Lot 1 Foundation)
--  Confidentiel — Propriété intellectuelle de Raïssa
--  Version : 1.0  Date : 2026-04-26
-- =============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =============================================================
--  ENUMS
-- =============================================================
create type lang_code as enum ('en-GB', 'es-ES', 'ar-SA', 'ko-KR', 'zh-CN');
create type cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type learn_mode as enum ('oral', 'complet');
create type quest_type as enum ('apprentissage', 'revision', 'pratique', 'jeu');
create type quest_status as enum ('pending', 'in_progress', 'completed', 'skipped');
create type league_tier as enum ('bronze', 'argent', 'or', 'saphir', 'emeraude', 'obsidienne');
create type challenge_type as enum ('solo', 'duel', 'tournament');
create type lang_status as enum ('active', 'paused');
create type scolaire_lvl as enum ('cm1','cm2','6e','5e','4e','3e','2nde','1ere','term','l1','l2','l3','m1','m2');
create type grc_level as enum ('junior', 'confirme', 'senior', 'expert');

-- =============================================================
--  PROFILS UTILISATEUR (lié à auth.users de Supabase)
-- =============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================
--  LANGUES SUIVIES PAR L'UTILISATEUR
-- =============================================================
create table public.user_languages (
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  status lang_status default 'active',
  is_current boolean default false,
  cefr_global cefr_level,
  cefr_co cefr_level,
  cefr_ce cefr_level,
  cefr_eo cefr_level,
  cefr_ee cefr_level,
  total_points integer default 0,
  weekly_points integer default 0,
  league_tier league_tier default 'bronze',
  daily_goal_min smallint default 10 check (daily_goal_min in (5, 10, 20)),
  added_at timestamptz default now(),
  last_activity timestamptz,
  primary key (user_id, lang_code)
);
create unique index idx_user_languages_current
  on public.user_languages(user_id) where is_current;

-- =============================================================
--  PRÉFÉRENCES (objectifs multi, scolaire, mode, thèmes)
-- =============================================================
create table public.user_preferences (
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  goals text[] default '{}',                  -- ['parler','complet','scolaire','pro','voyage','grc','plaisir']
  scolaire_level scolaire_lvl,                -- null si scolaire pas dans goals
  themes text[] default '{}',                 -- ['vie_quoti','ecole','voyage','travail','grc','examens','culture','libre']
  mode learn_mode default 'complet',
  grc_enabled boolean default false,
  grc_level grc_level,
  ipa_display text default 'permanent' check (ipa_display in ('permanent', 'tap', 'off')),
  french_support_level smallint default 100,  -- 100→0 réduction progressive
  notification_hour smallint default 19 check (notification_hour between 0 and 23),
  coach_modes_cached text[] default '{}',     -- recalculé depuis goals
  updated_at timestamptz default now(),
  primary key (user_id, lang_code)
);

-- =============================================================
--  PRÉFÉRENCE DE VOIX TTS
-- =============================================================
create table public.user_voice_pref (
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  voice_name text not null,
  voice_lang text not null,
  is_local boolean default true,
  default_rate numeric(2,1) default 1.0 check (default_rate in (0.5, 1.0, 1.5)),
  updated_at timestamptz default now(),
  primary key (user_id, lang_code)
);

-- =============================================================
--  CONTENU PÉDAGOGIQUE (multilingue par concept)
-- =============================================================
create table public.concepts (
  id uuid primary key default uuid_generate_v4(),
  domain text not null,                       -- 'general','grc_junior',...
  cefr_min cefr_level not null default 'A1',
  image_url text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

create table public.translations (
  id uuid primary key default uuid_generate_v4(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  lang_code lang_code not null,
  lemma text not null,
  ipa text,
  audio_url text,
  gender text,
  plural text,
  register text,
  unique (concept_id, lang_code)
);
create index idx_translations_lang on public.translations(lang_code);
create index idx_translations_lemma on public.translations(lower(lemma));

create table public.sentences (
  id uuid primary key default uuid_generate_v4(),
  lang_code lang_code not null,
  text text not null,
  ipa text,
  audio_url text,
  cefr cefr_level not null default 'A1',
  scenario_id uuid,
  created_at timestamptz default now()
);
create index idx_sentences_lang_cefr on public.sentences(lang_code, cefr);

create table public.lessons (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  cefr cefr_level not null,
  theme text not null,
  mode learn_mode default 'complet',
  scolaire_level scolaire_lvl,                -- null si pas scolaire
  grc_level grc_level,                        -- null si pas GRC
  ord smallint default 0,
  created_at timestamptz default now()
);

create table public.lesson_concepts (
  lesson_id uuid references public.lessons(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete cascade,
  ord smallint default 0,
  primary key (lesson_id, concept_id)
);

create table public.scenarios (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null,                     -- 'vie_quoti','pro','complexes','grc'
  cefr cefr_level not null,
  steps_json jsonb not null default '[]',
  grc_level grc_level,
  created_at timestamptz default now()
);

-- =============================================================
--  PROGRESSION UTILISATEUR (FSRS)
-- =============================================================
create table public.user_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  concept_id uuid references public.concepts(id) on delete cascade,
  fsrs_state jsonb not null default '{}',
  last_review timestamptz,
  next_review timestamptz,
  lapses smallint default 0,
  consec_correct smallint default 0,
  total_reviews integer default 0,
  primary key (user_id, lang_code, concept_id)
);
create index idx_user_progress_next_review
  on public.user_progress(user_id, lang_code, next_review)
  where next_review is not null;

-- =============================================================
--  SESSIONS D'APPRENTISSAGE (entrelacée 4 phases)
-- =============================================================
create table public.learning_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  lesson_id uuid references public.lessons(id),
  plan_json jsonb not null default '[]',
  results_json jsonb default '[]',
  started_at timestamptz default now(),
  ended_at timestamptz,
  hesitation_count smallint default 0,
  fail_count smallint default 0
);

-- =============================================================
--  QUÊTES JOURNALIÈRES (4)
-- =============================================================
create table public.daily_quests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) on delete cascade,
  lang_code lang_code not null,
  date date not null default current_date,
  quest_type quest_type not null,
  status quest_status default 'pending',
  content_ref jsonb,
  points_earned integer default 0,
  completed_at timestamptz,
  unique (user_id, lang_code, date, quest_type)
);
create index idx_daily_quests_user_date
  on public.daily_quests(user_id, date);

-- =============================================================
--  LIGUES HEBDOMADAIRES
-- =============================================================
create table public.leagues (
  id uuid primary key default uuid_generate_v4(),
  week_id text not null,                       -- '2026-W17'
  tier league_tier not null,
  lang_code lang_code not null,
  members uuid[] not null default '{}',
  rankings_json jsonb default '[]',
  promoted_count smallint default 0,
  demoted_count smallint default 0,
  reset_at timestamptz default now(),
  unique (week_id, tier, lang_code)
);

-- =============================================================
--  DÉFIS
-- =============================================================
create table public.challenges (
  id uuid primary key default uuid_generate_v4(),
  type challenge_type not null,
  creator_id uuid references public.profiles(id) on delete cascade,
  opponent_id uuid references public.profiles(id) on delete set null,
  lang_code lang_code not null,
  content_ref jsonb,
  status text default 'pending',
  score_a integer default 0,
  score_b integer default 0,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================================
--  BADGES
-- =============================================================
create table public.badges (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  label text not null,
  icon text,
  criteria_json jsonb not null default '{}'
);

create table public.user_badges (
  user_id uuid references public.profiles(id) on delete cascade,
  badge_id uuid references public.badges(id) on delete cascade,
  lang_code lang_code,
  unlocked_at timestamptz default now(),
  primary key (user_id, badge_id, lang_code)
);

-- =============================================================
--  AUDIT LOG (admin actions)
-- =============================================================
create table public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id),
  action text not null,
  target text,
  payload_json jsonb,
  created_at timestamptz default now()
);

-- =============================================================
--  TRIGGERS
-- =============================================================
-- Auto-création profile à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Recalcul automatique de coach_modes_cached
create or replace function public.compute_coach_modes()
returns trigger as $$
declare
  modes text[] := '{}';
begin
  if 'parler' = any(new.goals) then modes := array_append(modes, 'conversationnel'); end if;
  if 'complet' = any(new.goals) then modes := array_append(modes, 'hybride'); end if;
  if 'scolaire' = any(new.goals) then modes := array_append(modes, 'professeur'); end if;
  if 'pro' = any(new.goals) then modes := array_append(modes, 'business'); end if;
  if 'voyage' = any(new.goals) then modes := array_append(modes, 'guide'); end if;
  if 'grc' = any(new.goals) then modes := array_append(modes, 'expert_grc'); end if;
  if 'plaisir' = any(new.goals) then modes := array_append(modes, 'culturel'); end if;
  new.coach_modes_cached := modes;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger user_preferences_compute_modes
  before insert or update of goals on public.user_preferences
  for each row execute function public.compute_coach_modes();
