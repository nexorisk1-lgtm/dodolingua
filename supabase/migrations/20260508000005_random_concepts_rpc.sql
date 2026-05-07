-- v3.24.4 — RPC pour vraiment random distractors (ORDER BY random())
-- Utilisé par /api/sessions pour éviter le pattern "appartement" qui revient à chaque session

create or replace function public.get_random_concepts(p_count int default 100, p_levels text[] default array['A1','A2','B1','B2','C1','C2'])
returns table(id uuid, gloss_fr text)
language sql
security definer
stable
as $$
  select c.id, c.gloss_fr
  from public.concepts c
  where c.gloss_fr is not null
    and c.cefr_min::text = any(p_levels)
    and c.enrichment_status = 'enriched'
  order by random()
  limit p_count
$$;

revoke all on function public.get_random_concepts(int, text[]) from public;
grant execute on function public.get_random_concepts(int, text[]) to authenticated;

-- RPC parallèle pour les lemmes (utilisé pour Cloze options)
create or replace function public.get_random_lemmas(p_count int default 100, p_lang text default 'en-GB')
returns table(concept_id uuid, lemma text)
language sql
security definer
stable
as $$
  select t.concept_id, t.lemma
  from public.translations t
  join public.concepts c on c.id = t.concept_id
  where t.lang_code::text = p_lang
    and c.gloss_fr is not null
    and c.enrichment_status = 'enriched'
  order by random()
  limit p_count
$$;

revoke all on function public.get_random_lemmas(int, text) from public;
grant execute on function public.get_random_lemmas(int, text) to authenticated;
