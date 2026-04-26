-- =============================================================
--  Row Level Security — chaque user ne voit que ses données
-- =============================================================

alter table public.profiles enable row level security;
alter table public.user_languages enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_voice_pref enable row level security;
alter table public.user_progress enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.daily_quests enable row level security;
alter table public.challenges enable row level security;
alter table public.user_badges enable row level security;
alter table public.audit_log enable row level security;

-- Tables de contenu : lecture publique (tout user authentifié)
alter table public.concepts enable row level security;
alter table public.translations enable row level security;
alter table public.sentences enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_concepts enable row level security;
alter table public.scenarios enable row level security;
alter table public.leagues enable row level security;
alter table public.badges enable row level security;

-- ---------- profiles ----------
create policy "Users see own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile"
  on public.profiles for update using (auth.uid() = id);

-- ---------- user_languages / preferences / voice ----------
create policy "Users CRUD own languages"
  on public.user_languages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users CRUD own preferences"
  on public.user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users CRUD own voice pref"
  on public.user_voice_pref for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- progression / sessions / quêtes ----------
create policy "Users CRUD own progress"
  on public.user_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users CRUD own sessions"
  on public.learning_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users CRUD own quests"
  on public.daily_quests for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- challenges (les deux participants peuvent voir) ----------
create policy "Users see own challenges"
  on public.challenges for select
  using (auth.uid() = creator_id or auth.uid() = opponent_id);

create policy "Users create challenges"
  on public.challenges for insert
  with check (auth.uid() = creator_id);

create policy "Users update own created challenges"
  on public.challenges for update
  using (auth.uid() = creator_id);

-- ---------- user_badges ----------
create policy "Users see own badges"
  on public.user_badges for select using (auth.uid() = user_id);

-- ---------- audit_log : lecture admin uniquement (à raffiner via JWT claim) ----------
create policy "Admin sees audit"
  on public.audit_log for select
  using (auth.jwt() ->> 'role' = 'admin');

-- ---------- Contenu pédagogique : lecture pour tous les authentifiés ----------
create policy "Authenticated read concepts"
  on public.concepts for select using (auth.role() = 'authenticated');

create policy "Authenticated read translations"
  on public.translations for select using (auth.role() = 'authenticated');

create policy "Authenticated read sentences"
  on public.sentences for select using (auth.role() = 'authenticated');

create policy "Authenticated read lessons"
  on public.lessons for select using (auth.role() = 'authenticated');

create policy "Authenticated read lesson_concepts"
  on public.lesson_concepts for select using (auth.role() = 'authenticated');

create policy "Authenticated read scenarios"
  on public.scenarios for select using (auth.role() = 'authenticated');

create policy "Authenticated read leagues"
  on public.leagues for select using (auth.role() = 'authenticated');

create policy "Authenticated read badges"
  on public.badges for select using (auth.role() = 'authenticated');
