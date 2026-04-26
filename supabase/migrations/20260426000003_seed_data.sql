-- =============================================================
--  Seed minimal — anglais UK A1, badges de base
--  Contenus originaux (aucun emprunt à BBC ou autre source protégée)
-- =============================================================

-- ---------- Badges de base ----------
insert into public.badges (code, label, icon, criteria_json) values
  ('streak_7',     'Streak 7 jours',          'fire',       '{"streak":7}'),
  ('streak_30',    'Streak 30 jours',         'fire',       '{"streak":30}'),
  ('streak_100',   'Streak 100 jours',        'flame',      '{"streak":100}'),
  ('streak_365',   'Streak 365 jours',        'crown',      '{"streak":365}'),
  ('first_perfect','Premier 100% sur un jeu', 'target',     '{"perfect_game":1}'),
  ('top_3',        'Top 3 ligue hebdo',       'trophy',     '{"league_rank":3}'),
  ('discoverer',   'Découvreur — 1er jeu',    'compass',    '{"games_first_time":1}'),
  ('polyglotte',   'Polyglotte — 2 langues B1+', 'globe',   '{"languages_b1":2}'),
  ('grc_senior',   'GRC Senior',              'shield',     '{"grc_level":"senior"}'),
  ('vocab_100',    '100 mots maîtrisés',      'book',       '{"words_mastered":100}'),
  ('vocab_500',    '500 mots maîtrisés',      'books',      '{"words_mastered":500}'),
  ('speed_demon',  'Speed run parfait',       'zap',        '{"speed_run_perfect":1}')
on conflict (code) do nothing;

-- ---------- Concepts A1 anglais — 10 mots de démarrage ----------
do $$
declare c_id uuid;
begin
  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"greeting"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'hello', '/həˈləʊ/'),
    (c_id, 'es-ES', 'hola', '/ˈola/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"greeting"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'goodbye', '/ɡʊdˈbaɪ/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"politeness"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'please', '/pliːz/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"politeness"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'thank you', '/ˈθæŋk juː/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"yesno"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'yes', '/jes/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"yesno"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'no', '/nəʊ/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"intro"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'my name is', '/maɪ neɪm ɪz/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"intro"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'how are you', '/haʊ ɑː juː/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"feel"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'fine', '/faɪn/');

  insert into public.concepts (domain, cefr_min, tags) values
    ('general', 'A1', '{"feel"}') returning id into c_id;
  insert into public.translations (concept_id, lang_code, lemma, ipa) values
    (c_id, 'en-GB', 'tired', '/ˈtaɪəd/');
end $$;

-- ---------- Une leçon de démonstration ----------
insert into public.lessons (title, cefr, theme, mode) values
  ('Greetings & Introductions', 'A1', 'vie_quoti', 'complet')
on conflict do nothing;
