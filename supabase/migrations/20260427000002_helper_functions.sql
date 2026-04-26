-- =============================================================
--  Helpers RPC : increment points, reset hebdo ligues, etc.
-- =============================================================

create or replace function public.increment_user_points(
  p_user uuid, p_lang lang_code, p_amount integer
) returns void language plpgsql as $$
begin
  insert into public.user_languages (user_id, lang_code, total_points, weekly_points, last_activity)
  values (p_user, p_lang, p_amount, p_amount, now())
  on conflict (user_id, lang_code) do update set
    total_points = public.user_languages.total_points + excluded.total_points,
    weekly_points = public.user_languages.weekly_points + excluded.weekly_points,
    last_activity = now();
end; $$;

-- Reset hebdo ligues (à exécuter chaque lundi 00:00 via cron API route)
create or replace function public.weekly_league_reset() returns void
language plpgsql as $$
begin
  -- Snapshot des classements de la semaine écoulée
  insert into public.leagues (week_id, tier, lang_code, members, rankings_json, reset_at)
  select to_char(now() - interval '1 day', 'IYYY-"W"IW'),
         league_tier,
         lang_code,
         array_agg(user_id),
         jsonb_agg(jsonb_build_object('user_id', user_id, 'points', weekly_points) order by weekly_points desc),
         now()
  from public.user_languages
  where weekly_points > 0
  group by league_tier, lang_code
  on conflict do nothing;

  -- Promotion / relégation simple
  update public.user_languages set league_tier = 'argent'
  where league_tier = 'bronze' and weekly_points >= 100;
  update public.user_languages set league_tier = 'or'
  where league_tier = 'argent' and weekly_points >= 200;
  update public.user_languages set league_tier = 'saphir'
  where league_tier = 'or' and weekly_points >= 350;
  update public.user_languages set league_tier = 'emeraude'
  where league_tier = 'saphir' and weekly_points >= 500;
  update public.user_languages set league_tier = 'obsidienne'
  where league_tier = 'emeraude' and weekly_points >= 700;

  -- Reset des points hebdo
  update public.user_languages set weekly_points = 0;
end; $$;

-- Décompte streak (consécutifs). Appelé après validation d'une quête.
create or replace function public.compute_streak(p_user uuid, p_lang lang_code)
returns integer language plpgsql as $$
declare s integer := 0; d date := current_date;
begin
  loop
    if exists (select 1 from public.daily_quests
               where user_id = p_user and lang_code = p_lang
                 and date = d and status = 'completed') then
      s := s + 1; d := d - 1;
    else exit;
    end if;
    if s > 1000 then exit; end if;
  end loop;
  return s;
end; $$;
