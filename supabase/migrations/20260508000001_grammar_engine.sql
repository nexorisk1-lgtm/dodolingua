-- v3.24.0 — Grammar Engine : tables + RLS
-- Intercale les leçons grammaire dans le parcours, 1 toutes les 5 leçons vocab.
-- Checkpoint après 3 blocs (15 vocab + 3 grammar).

-- Topics grammaire (référentiel)
create table if not exists public.grammar_topics (
  id text primary key,                    -- ex: 'A1_to_be', 'A2_past_simple'
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  slug text not null,                     -- 'to_be', 'past_simple'
  position int not null,                  -- ordre d'apparition dans le niveau (1, 2, 3...)
  title_fr text not null,                 -- titre court FR ("Le verbe Be")
  rule_md text not null,                  -- règle expliquée FR (markdown court)
  emoji text default '📘',
  examples_json jsonb not null default '[]'::jsonb,  -- [{en, fr}]
  created_at timestamptz default now()
);

create unique index if not exists ux_grammar_topics_level_pos on public.grammar_topics(level, position);
create index if not exists ix_grammar_topics_level on public.grammar_topics(level);

-- Exercices grammaire (générés à partir du dataset ou du LLM)
create table if not exists public.grammar_exercises (
  id uuid primary key default gen_random_uuid(),
  topic_id text not null references public.grammar_topics(id) on delete cascade,
  type text not null check (type in ('mcq','fill_blank','reorder','translate')),
  question text not null,                 -- "She ___ a doctor."
  options_json jsonb,                     -- ["am","is","are"] (null si fill_blank/reorder)
  answer text not null,                   -- réponse correcte canonique
  explanation_fr text,                    -- pourquoi cette réponse
  position int default 0,
  created_at timestamptz default now()
);

create index if not exists ix_grammar_exercises_topic on public.grammar_exercises(topic_id, position);

-- Progression grammaire utilisateur (par topic)
create table if not exists public.grammar_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id text not null references public.grammar_topics(id) on delete cascade,
  consec_correct int not null default 0,  -- 0=pas commencé, 1=fragile, 2+=maîtrisé
  last_seen_at timestamptz default now(),
  total_correct int default 0,
  total_attempts int default 0,
  primary key (user_id, topic_id)
);

create index if not exists ix_grammar_progress_user on public.grammar_progress(user_id);

-- RLS
alter table public.grammar_topics enable row level security;
alter table public.grammar_exercises enable row level security;
alter table public.grammar_progress enable row level security;

-- Topics + exercices : lecture publique (auth required)
drop policy if exists "grammar_topics_read" on public.grammar_topics;
create policy "grammar_topics_read" on public.grammar_topics for select using (auth.role() = 'authenticated');

drop policy if exists "grammar_exercises_read" on public.grammar_exercises;
create policy "grammar_exercises_read" on public.grammar_exercises for select using (auth.role() = 'authenticated');

-- Progress : own only
drop policy if exists "grammar_progress_select_own" on public.grammar_progress;
create policy "grammar_progress_select_own" on public.grammar_progress for select using (auth.uid() = user_id);

drop policy if exists "grammar_progress_upsert_own" on public.grammar_progress;
create policy "grammar_progress_upsert_own" on public.grammar_progress for insert with check (auth.uid() = user_id);

drop policy if exists "grammar_progress_update_own" on public.grammar_progress;
create policy "grammar_progress_update_own" on public.grammar_progress for update using (auth.uid() = user_id);
