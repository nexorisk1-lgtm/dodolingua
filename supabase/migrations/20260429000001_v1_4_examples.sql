-- v1.4 — Ajout colonne `example` sur translations + colonne `gloss_fr` sur concepts
-- Objectif :
--   - examples : pour Sentence Builder et Speaking Cloze (plus de "I love hello")
--   - gloss_fr : pour Speed Round et Quiz (afficher la traduction française du mot)
-- Migration non-destructive (colonnes nullable).

-- 1) examples par mot
alter table public.translations
  add column if not exists example text;

-- 2) glose française du concept (= sens en français, pour QCM/Speed Round)
alter table public.concepts
  add column if not exists gloss_fr text;

-- 3) Seed des 10 mots A1 existants (anglais) avec exemple + gloss_fr
update public.translations set example = 'Hello, my name is Anna.'
  where lang_code = 'en-GB' and lemma = 'hello';
update public.translations set example = 'Goodbye, see you tomorrow.'
  where lang_code = 'en-GB' and lemma = 'goodbye';
update public.translations set example = 'Please pass me the salt.'
  where lang_code = 'en-GB' and lemma = 'please';
update public.translations set example = 'Thank you for your help.'
  where lang_code = 'en-GB' and lemma = 'thank you';
update public.translations set example = 'Yes, I would like some tea.'
  where lang_code = 'en-GB' and lemma = 'yes';
update public.translations set example = 'No, I am not hungry.'
  where lang_code = 'en-GB' and lemma = 'no';
update public.translations set example = 'My name is Tom.'
  where lang_code = 'en-GB' and lemma = 'my name is';
update public.translations set example = 'How are you today?'
  where lang_code = 'en-GB' and lemma = 'how are you';
update public.translations set example = 'I am fine, thanks.'
  where lang_code = 'en-GB' and lemma = 'fine';
update public.translations set example = 'I am very tired tonight.'
  where lang_code = 'en-GB' and lemma = 'tired';

-- gloss_fr pour les 10 concepts A1
update public.concepts c set gloss_fr = 'bonjour'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='hello');
update public.concepts c set gloss_fr = 'au revoir'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='goodbye');
update public.concepts c set gloss_fr = 's''il vous plaît'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='please');
update public.concepts c set gloss_fr = 'merci'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='thank you');
update public.concepts c set gloss_fr = 'oui'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='yes');
update public.concepts c set gloss_fr = 'non'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='no');
update public.concepts c set gloss_fr = 'je m''appelle'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='my name is');
update public.concepts c set gloss_fr = 'comment vas-tu'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='how are you');
update public.concepts c set gloss_fr = 'bien'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='fine');
update public.concepts c set gloss_fr = 'fatigué'
  where exists (select 1 from public.translations t where t.concept_id=c.id and t.lang_code='en-GB' and t.lemma='tired');

comment on column public.translations.example is 'v1.4 — Phrase exemple courte dans la langue cible';
comment on column public.concepts.gloss_fr is 'v1.4 — Sens du concept en français (pour QCM, Speed Round)';
