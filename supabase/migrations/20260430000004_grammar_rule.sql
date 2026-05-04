-- v3.9 — Ajout d'un label de règle de grammaire pour grouper les corrections.
-- L'idée : au lieu de réviser chaque phrase corrigée comme une carte isolée,
-- on regroupe par règle (ex: "Past tense", "Articles a/an", "Word order")
-- pour une révision plus structurée et pédagogique.
alter table public.coach_corrections
  add column if not exists grammar_rule text;

create index if not exists idx_coach_corrections_grammar_rule
  on public.coach_corrections (user_id, grammar_rule)
  where grammar_rule is not null;

comment on column public.coach_corrections.grammar_rule is
  'v3.9 — Label court de la règle de grammaire (ex: "Past tense", "Word order"). Permet le groupement.';
