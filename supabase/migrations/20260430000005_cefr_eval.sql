-- v3.10 — Tracking de l'évaluation CEFR automatique (vs CEFR figé déclaratif).
-- cefr_estimated : niveau estimé par l'IA après analyse des conversations
-- cefr_estimated_at : timestamp de la dernière évaluation
-- cefr_breakdown : JSONB { speaking, listening, range, accuracy, fluency, interaction }
alter table public.user_languages
  add column if not exists cefr_estimated text,
  add column if not exists cefr_estimated_at timestamptz,
  add column if not exists cefr_breakdown jsonb;

comment on column public.user_languages.cefr_estimated is
  'v3.10 — Niveau CEFR estimé automatiquement (A1, A2, B1, B2, C1, C2). Différent de cefr_global qui est déclaré.';
