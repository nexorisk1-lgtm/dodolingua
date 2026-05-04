-- v3.18 — Table rase vocabulaire + contrainte anti-doublon + colonne definition_en
-- À exécuter dans Supabase SQL Editor.

-- 1) Ajouter colonne definition_en (pour les défs anglaises Langeek/Cambridge)
alter table public.concepts
  add column if not exists definition_en text;

-- 2) Table rase
delete from public.user_progress where concept_id in (select id from public.concepts);
delete from public.translations where concept_id in (select id from public.concepts);
delete from public.concepts;

-- 3) Contrainte UNIQUE case-insensitive sur translations(lang_code, lemma)
drop index if exists translations_unique_lemma_per_lang;
create unique index translations_unique_lemma_per_lang
  on public.translations (lang_code, lower(lemma));

-- 4) Index pour performance enrichment_status (idempotent)
create index if not exists idx_concepts_enrichment_status
  on public.concepts (enrichment_status, frequency_rank)
  where enrichment_status != 'enriched';

-- 5) Vérification
select 'Concepts restants : ' || count(*)::text as result from public.concepts
union all
select 'Translations restantes : ' || count(*)::text from public.translations;
