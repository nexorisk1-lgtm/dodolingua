-- v3.17 — Infrastructure d'import et d'enrichissement de vocabulaire CEFR
-- Permet d'importer des wordlists (NGSL, Oxford, etc.) puis d'enrichir
-- chaque mot via LLM avec FR + IPA + exemple, à la demande.

alter table public.concepts
  add column if not exists source_list text,         -- 'NGSL', 'NAWL', 'CEFR-J', 'manual', etc.
  add column if not exists frequency_rank integer,   -- rang dans la liste source (1 = le plus fréquent)
  add column if not exists enrichment_status text default 'enriched'
    check (enrichment_status in ('pending', 'enriching', 'enriched', 'failed'));

-- Pour les concepts existants (déjà enrichis), force enrichment_status = 'enriched'
update public.concepts set enrichment_status = 'enriched' where enrichment_status is null;

create index if not exists idx_concepts_enrichment_status
  on public.concepts (enrichment_status, frequency_rank)
  where enrichment_status != 'enriched';

create index if not exists idx_concepts_source_list
  on public.concepts (source_list);

comment on column public.concepts.source_list is
  'v3.17 — Liste source du mot (NGSL, NAWL, manual, etc.)';
comment on column public.concepts.frequency_rank is
  'v3.17 — Rang de fréquence dans la liste source (1 = le plus fréquent)';
comment on column public.concepts.enrichment_status is
  'v3.17 — Statut enrichissement LLM : pending|enriching|enriched|failed';
