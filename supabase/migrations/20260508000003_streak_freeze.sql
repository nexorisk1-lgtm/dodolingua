-- v3.24.1 — Streak freeze tokens + Combo XP infrastructure
-- Streak freeze : 1 jeton offert chaque dimanche, consommé silencieusement si journée manquée
-- Combo XP : pas de migration (combo est éphémère, suivi en frontend uniquement)

-- ─── 1. Streak tracking sur user_languages ───
alter table public.user_languages
  add column if not exists streak_count int not null default 0,
  add column if not exists streak_freeze_tokens int not null default 1,
  add column if not exists last_streak_check_date date,
  add column if not exists last_freeze_grant_week date;

-- ─── 2. RPC : check + maintenance du streak ───
-- Appelée à chaque chargement du dashboard.
-- Logique :
--  - Si dernière activité = aujourd'hui : ne fait rien (déjà OK)
--  - Si dernière activité = hier : laisse tel quel (streak intact, pas encore expiré)
--  - Si dernière activité = il y a >= 2 jours :
--      * Si tokens > 0 : décrémente et garde streak (consomme silencieusement le jeton)
--      * Sinon : reset streak à 0
--  - Auto-grant 1 token chaque lundi (max 2 tokens accumulés)
--
-- IMPORTANT : on n'incrémente PAS le streak ici. C'est fait au moment d'une activité
-- (par submit_session ou autre).

create or replace function public.streak_maintenance(p_user uuid, p_lang text default 'en-GB')
returns table(streak_count int, streak_freeze_tokens int, freeze_used boolean)
language plpgsql
security definer
as $$
declare
  v_last_act date;
  v_today date := (now() at time zone 'utc')::date;
  v_monday_this_week date := v_today - extract(dow from v_today)::int + (case when extract(dow from v_today)::int = 0 then -6 else 1 end);
  v_streak int;
  v_tokens int;
  v_last_grant date;
  v_freeze_used boolean := false;
begin
  -- Lire l'état actuel
  select coalesce(streak_count, 0),
         coalesce(streak_freeze_tokens, 1),
         coalesce(last_activity::date, v_today - 10),
         last_freeze_grant_week
    into v_streak, v_tokens, v_last_act, v_last_grant
    from public.user_languages
    where user_id = p_user and lang_code::text = p_lang;

  if not found then
    return query select 0, 1, false;
    return;
  end if;

  -- Auto-grant : 1 token chaque lundi (si pas déjà grant cette semaine, max 2 tokens)
  if v_last_grant is null or v_last_grant < v_monday_this_week then
    if v_tokens < 2 then
      v_tokens := v_tokens + 1;
    end if;
    update public.user_languages
      set streak_freeze_tokens = v_tokens,
          last_freeze_grant_week = v_monday_this_week
      where user_id = p_user and lang_code::text = p_lang;
  end if;

  -- Streak maintenance
  if v_last_act = v_today then
    -- Pratiqué aujourd'hui, rien à faire
    null;
  elsif v_last_act = v_today - 1 then
    -- Pratiqué hier, streak encore valide (jusqu'à fin de journée)
    null;
  elsif v_last_act < v_today - 1 then
    -- Au moins 2 jours sans activité
    if v_tokens > 0 then
      -- Consomme silencieusement le token (autant qu'il en faut pour combler le trou, max 1 par jour manqué)
      declare v_missed_days int := (v_today - v_last_act - 1);
      begin
        if v_tokens >= v_missed_days then
          v_tokens := v_tokens - v_missed_days;
          v_freeze_used := true;
          -- Le streak est conservé
        else
          v_streak := 0;
          v_tokens := 0;
        end if;
      end;
      update public.user_languages
        set streak_freeze_tokens = v_tokens,
            streak_count = v_streak
        where user_id = p_user and lang_code::text = p_lang;
    else
      -- Pas de token → reset
      v_streak := 0;
      update public.user_languages
        set streak_count = 0
        where user_id = p_user and lang_code::text = p_lang;
    end if;
  end if;

  return query select v_streak, v_tokens, v_freeze_used;
end;
$$;

revoke all on function public.streak_maintenance(uuid, text) from public;
grant execute on function public.streak_maintenance(uuid, text) to authenticated;

-- ─── 3. RPC : incrément streak (appelé après une activité réussie) ───
create or replace function public.streak_bump(p_user uuid, p_lang text default 'en-GB')
returns int
language plpgsql
security definer
as $$
declare
  v_last_act date;
  v_today date := (now() at time zone 'utc')::date;
  v_streak int;
begin
  select coalesce(last_activity::date, v_today - 10),
         coalesce(streak_count, 0)
    into v_last_act, v_streak
    from public.user_languages
    where user_id = p_user and lang_code::text = p_lang;

  if not found then return 0; end if;

  if v_last_act = v_today then
    -- Déjà comptabilisé aujourd'hui, ne rien faire
    return v_streak;
  elsif v_last_act = v_today - 1 then
    v_streak := v_streak + 1;
  else
    -- Premier jour ou rupture (ne devrait pas arriver après maintenance, mais safety)
    v_streak := 1;
  end if;

  update public.user_languages
    set streak_count = v_streak,
        last_activity = now()
    where user_id = p_user and lang_code::text = p_lang;

  return v_streak;
end;
$$;

revoke all on function public.streak_bump(uuid, text) from public;
grant execute on function public.streak_bump(uuid, text) to authenticated;
