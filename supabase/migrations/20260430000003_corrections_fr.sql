-- v3.8.1 — Ajout d'une colonne corrected_fr pour la traduction française
-- de la correction. Permet à l'utilisateur de comprendre la phrase corrigée
-- même s'il ne maîtrise pas encore l'anglais.
alter table public.coach_corrections
  add column if not exists corrected_fr text;

comment on column public.coach_corrections.corrected_fr is
  'v3.8.1 — Traduction française de corrected_text, fournie par le LLM lors de la captation.';
