-- v3.10 — Custom drilling : variantes contextuelles d'une correction.
-- Quand le LLM corrige "I go yesterday" → on génère 3-4 variantes
-- ("I went to school yesterday", "Yesterday I went home", etc.)
-- Stockées dans la même table coach_corrections avec parent_correction_id.
-- Permet à l'utilisateur de pratiquer le pattern dans plusieurs contextes.

alter table public.coach_corrections
  add column if not exists parent_correction_id uuid references public.coach_corrections(id) on delete cascade,
  add column if not exists is_drill_variant boolean default false;

create index if not exists idx_coach_corrections_parent
  on public.coach_corrections (parent_correction_id);

comment on column public.coach_corrections.parent_correction_id is
  'v3.10 — Si non NULL, c''est une variante de drilling de la correction parente.';
comment on column public.coach_corrections.is_drill_variant is
  'v3.10 — true pour les variantes générées automatiquement (vs corrections originales user).';
