-- v3.24.2 — Seed grammaire A1 ENRICHI (règles complètes + contractions + tableaux)
-- Utilise dollar-quoted strings ($body$ ... $body$) pour préserver tous les retours à la ligne
-- même quand le SQL est collé via un chat ou une UI qui pourrait collapser les multi-lines.

-- Reset propre des topics A1 + leurs exercices
delete from public.grammar_exercises where topic_id like 'A1_%';
delete from public.grammar_topics where level = 'A1';

-- 1. TO_BE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_to_be', 'A1', 'to_be', 1, 'Le verbe Be (être)',
  $body$**Be** veut dire **être**. C'est le verbe le plus utilisé en anglais : il sert à se présenter, décrire, dire comment on se sent.

**Conjugaison au présent :**
- **I am** → je suis
- **You are** → tu es / vous êtes
- **He is / She is / It is** → il est / elle est / c'est
- **We are** → nous sommes
- **They are** → ils / elles sont

**Astuce :** "is" pour la 3e personne du singulier (he, she, it). "are" pour le pluriel (we, they) et le "you".

**Contractions courantes :**
- I am → **I'm** ("aïmm")
- You are → **You're** ("yor")
- He is → **He's** ("hizz")
- She is → **She's** ("chizz")
- It is → **It's** ("itss")
- We are → **We're** ("wir")
- They are → **They're** ("zer")

À l'oral, les contractions sont quasi obligatoires.

**Forme négative :** ajoute "not" : *I am not, He is not, We are not.*
- Contractions : *I'm not, He isn't, We aren't.*

**Question :** inverser sujet et verbe : *Are you tired? Is she here?*$body$,
  '🟢',
  '[{"en":"I am tired.","fr":"Je suis fatigué."},{"en":"She is a teacher.","fr":"Elle est professeur."},{"en":"They are at home.","fr":"Ils sont à la maison."},{"en":"It is cold today.","fr":"Il fait froid aujourd''hui."},{"en":"I''m happy!","fr":"Je suis content !"},{"en":"He''s not French.","fr":"Il n''est pas français."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_to_be','mcq','She ___ a doctor.','["am","is","are"]'::jsonb,'is','3e personne du singulier (she) → "is".',1),
('A1_to_be','mcq','They ___ happy.','["am","is","are"]'::jsonb,'are','Pluriel (they) → "are".',2),
('A1_to_be','mcq','___ tired.','["I am","I is","I are"]'::jsonb,'I am','Avec "I", on utilise toujours "am".',3),
('A1_to_be','fill_blank','We ___ at school.',null,'are','We → "are" (pluriel).',4),
('A1_to_be','reorder','happy / is / she',null,'she is happy','Sujet + verbe + adjectif.',5),
('A1_to_be','translate','Je suis professeur.',null,'i am a teacher','I am + a + nom de métier.',6);

-- 2. TO_HAVE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_to_have', 'A1', 'to_have', 2, 'Le verbe Have (avoir)',
  $body$**Have** veut dire **avoir**. On l'utilise pour la possession, l'âge, la famille, les objets.

**Conjugaison au présent :**
- **I have** → j'ai
- **You have** → tu as / vous avez
- **He has / She has / It has** → il a / elle a
- **We have** → nous avons
- **They have** → ils / elles ont

**⚠️ Piège classique :** à la 3e personne du singulier (he, she, it), "have" devient **has**.

**Contractions :**
- I have → **I've**
- You have → **You've**
- He has → **He's** (attention : même contraction que "He is" — le contexte fait la différence)
- We have → **We've**
- They have → **They've**

**Forme négative :** *I don't have, He doesn't have.*

**Question :** *Do you have a pen? Does she have time?*

**Have got (variante britannique) :** *I've got a sister.* = *I have a sister.*$body$,
  '🟢',
  '[{"en":"I have a sister.","fr":"J''ai une sœur."},{"en":"She has a cat.","fr":"Elle a un chat."},{"en":"They have a car.","fr":"Ils ont une voiture."},{"en":"He has brown eyes.","fr":"Il a les yeux marron."},{"en":"I''ve got a question.","fr":"J''ai une question."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_to_have','mcq','She ___ two brothers.','["have","has","is"]'::jsonb,'has','3e personne (she) → "has".',1),
('A1_to_have','mcq','We ___ a big house.','["have","has","are"]'::jsonb,'have','We → "have" (pluriel).',2),
('A1_to_have','fill_blank','I ___ a new phone.',null,'have','Avec I → "have".',3),
('A1_to_have','fill_blank','He ___ a dog.',null,'has','He = 3e personne → "has".',4),
('A1_to_have','reorder','a / he / car / has',null,'he has a car','Sujet + has + a + objet.',5),
('A1_to_have','translate','Elle a un frère.',null,'she has a brother','Avec She → "has".',6);

-- 3. PRONOUNS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_pronouns', 'A1', 'pronouns', 3, 'Les pronoms personnels',
  $body$Les **pronoms personnels** remplacent un nom et indiquent qui fait l'action.

**Pronoms sujets :**
- **I** = je (toujours en majuscule, même au milieu d'une phrase !)
- **You** = tu / vous (singulier ou pluriel, formel ou informel)
- **He** = il (homme ou garçon)
- **She** = elle (femme ou fille)
- **It** = il / elle / ce (objet, animal sans genre, idée, météo)
- **We** = nous
- **They** = ils / elles (mixte, masculin ou féminin)

**Astuce mémo :**
- Une seule personne → I (moi), you (toi), he/she/it (lui/elle/ça)
- Plusieurs personnes → we (nous), you (vous), they (eux)

**⚠️ Différences avec le français :**
- **You** sert à la fois pour "tu" et "vous" (pas de distinction de politesse)
- **It** existe pour TOUS les objets/animaux/idées — le français utilise "il" ou "elle" selon le genre
- **They** ne distingue pas masculin/féminin

**Pronoms compléments (à connaître plus tard) :** me, you, him, her, it, us, them.$body$,
  '🟢',
  '[{"en":"He is my brother.","fr":"C''est mon frère."},{"en":"She is nice.","fr":"Elle est gentille."},{"en":"It is a book.","fr":"C''est un livre."},{"en":"We are friends.","fr":"Nous sommes amis."},{"en":"They live in Paris.","fr":"Ils habitent à Paris."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_pronouns','mcq','___ am French.','["I","He","They"]'::jsonb,'I','"am" va avec "I".',1),
('A1_pronouns','mcq','Maria is at home. ___ is happy.','["He","She","It"]'::jsonb,'She','Maria est une femme → She.',2),
('A1_pronouns','mcq','My dog is big. ___ is friendly.','["He","She","It"]'::jsonb,'It','Animal/objet → It.',3),
('A1_pronouns','fill_blank','Tom and I are friends. ___ are happy.',null,'we','Tom + I = We.',4),
('A1_pronouns','fill_blank','Anna and Bob are here. ___ are tired.',null,'they','Plusieurs personnes → They.',5),
('A1_pronouns','translate','Elle est jeune.',null,'she is young','Elle = She.',6);

-- 4. ARTICLES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_articles', 'A1', 'articles', 4, 'Les articles : a / an / the',
  $body$Les **articles** se placent devant un nom.

**A / An = un / une** (article indéfini : pour quelque chose qu'on présente pour la 1ère fois ou non précis)
- **A** devant une consonne : *a book, a cat, a house*
- **An** devant une voyelle (a, e, i, o, u) ou un h muet : *an apple, an hour, an umbrella*

**⚠️ Attention :** c'est le SON, pas la lettre, qui décide.
- *a university* (le "u" se prononce "you" → consonne)
- *an hour* (le "h" est muet → voyelle)

**The = le / la / les** (article défini : pour quelque chose de précis ou déjà connu)
- *The book on the table.* → le livre (précis)
- Singulier ou pluriel : *the cat / the cats*

**Quand utiliser quoi ?**
- 1ère mention d'une chose nouvelle → **a / an** : *I see a dog.*
- 2e mention ou chose unique/précise → **the** : *The dog is brown.*
- Choses uniques (Soleil, Lune, mer, etc.) → **the** : *the sun, the moon*

**Pas d'article :**
- Noms propres : *Paris, Maria, France*
- Repas généraux : *breakfast, lunch, dinner*
- Sports / langues : *football, English*$body$,
  '🟢',
  '[{"en":"I have a book.","fr":"J''ai un livre."},{"en":"She eats an apple.","fr":"Elle mange une pomme."},{"en":"The dog is small.","fr":"Le chien est petit."},{"en":"This is an old house.","fr":"C''est une vieille maison."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_articles','mcq','I see ___ elephant.','["a","an","the"]'::jsonb,'an','Voyelle (e) → an.',1),
('A1_articles','mcq','She has ___ car.','["a","an","the"]'::jsonb,'a','Consonne (c) → a.',2),
('A1_articles','mcq','Open ___ door, please.','["a","an","the"]'::jsonb,'the','Porte précise → the.',3),
('A1_articles','fill_blank','I want ___ orange.',null,'an','Voyelle (o) → an.',4),
('A1_articles','fill_blank','He is ___ teacher.',null,'a','Consonne (t) → a.',5),
('A1_articles','translate','C''est une pomme.',null,'it is an apple','an + voyelle.',6);

-- 5. PRESENT_SIMPLE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_present_simple', 'A1', 'present_simple', 5, 'Le présent simple',
  $body$Le **présent simple** sert à parler d'**habitudes**, de **vérités générales** ou de **faits permanents**.

**Forme positive :**
- **I / You / We / They** + verbe : *I work, You work, We work, They work*
- **He / She / It** + verbe + **-s** : *He works, She works, It works*

**⚠️ Piège : le "-s" à la 3e personne du singulier !** C'est l'erreur la plus fréquente.

**Règles d'orthographe pour le -s :**
- Verbes en **-ch, -sh, -s, -x** → ajoute **-es** : *watch → watches, miss → misses*
- Verbes en **-y** précédé d'une consonne → **y devient -ies** : *study → studies*
- Verbes en **-y** précédé d'une voyelle → ajoute **-s** simple : *play → plays*
- Cas spécial : *go → goes, do → does, have → has*

**Forme négative :**
- I/You/We/They + **don't** + verbe : *I don't work*
- He/She/It + **doesn't** + verbe (sans -s !) : *She doesn't work*

**Question :**
- **Do** + I/you/we/they + verbe ? : *Do you work?*
- **Does** + he/she/it + verbe (sans -s !) ? : *Does she work?*

**Mots-clés du présent simple :** *every day, always, often, usually, sometimes, never.*$body$,
  '🟢',
  '[{"en":"I work every day.","fr":"Je travaille tous les jours."},{"en":"She eats breakfast at 7.","fr":"Elle prend le petit-déjeuner à 7h."},{"en":"They play football on Sundays.","fr":"Ils jouent au foot le dimanche."},{"en":"He drinks coffee every morning.","fr":"Il boit du café tous les matins."},{"en":"She studies English.","fr":"Elle étudie l''anglais."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_present_simple','mcq','She ___ every day.','["work","works","working"]'::jsonb,'works','3e personne → +s.',1),
('A1_present_simple','mcq','We ___ in Paris.','["live","lives","living"]'::jsonb,'live','We → pas de -s.',2),
('A1_present_simple','fill_blank','He ___ (drink) coffee.',null,'drinks','3e personne → drinks.',3),
('A1_present_simple','fill_blank','She ___ (study) English.',null,'studies','y → ies (3e personne).',4),
('A1_present_simple','reorder','football / play / they',null,'they play football','Sujet + verbe + objet.',5),
('A1_present_simple','translate','Elle mange une pomme.',null,'she eats an apple','3e personne → eats.',6);

-- 6. NEGATION
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_negation', 'A1', 'negation', 6, 'La négation',
  $body$Pour mettre un verbe à la **forme négative**, on utilise **don't / doesn't** ou **not** selon le verbe.

**Avec un verbe ordinaire (work, eat, like…) :**
- I / You / We / They + **don't** + verbe : *I don't work, We don't like fish*
- He / She / It + **doesn't** + verbe (SANS -s !) : *She doesn't work, It doesn't matter*

**⚠️ Piège classique :** après "doesn't", le verbe ne prend PAS de -s.
- ❌ *She doesn't works*
- ✅ *She doesn't work*

**Avec be (am/is/are) :** on ajoute juste **not**.
- *I am not, You are not, He is not, We are not, They are not.*

**Contractions négatives :**
- am not → **'m not** : *I'm not French.*
- is not → **isn't** : *He isn't here.*
- are not → **aren't** : *They aren't ready.*
- do not → **don't** : *I don't know.*
- does not → **doesn't** : *She doesn't sing.*

**Avec can (modal) :** *cannot / can't*
- *I can't swim. He can't drive.*

**Forme complète vs contractée :** la forme contractée est utilisée à l'oral et à l'écrit informel. La forme complète est plus formelle ou pour insister.$body$,
  '🟢',
  '[{"en":"I don''t like coffee.","fr":"Je n''aime pas le café."},{"en":"She doesn''t speak French.","fr":"Elle ne parle pas français."},{"en":"They are not here.","fr":"Ils ne sont pas là."},{"en":"He doesn''t eat meat.","fr":"Il ne mange pas de viande."},{"en":"I can''t swim.","fr":"Je ne sais pas nager."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_negation','mcq','She ___ like fish.','["don''t","doesn''t","not"]'::jsonb,'doesn''t','3e personne → doesn''t.',1),
('A1_negation','mcq','I ___ work on Sundays.','["don''t","doesn''t","am not"]'::jsonb,'don''t','I → don''t.',2),
('A1_negation','fill_blank','He ___ (not / play) tennis.',null,'doesn''t play','3e personne → doesn''t + verbe sans s.',3),
('A1_negation','fill_blank','We ___ (not / live) in London.',null,'don''t live','We → don''t + verbe.',4),
('A1_negation','translate','Je ne suis pas fatigué.',null,'i am not tired','Avec be → not.',5),
('A1_negation','translate','Elle ne mange pas de viande.',null,'she doesn''t eat meat','3e personne → doesn''t.',6);

-- 7. QUESTIONS_BASIC
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_questions_basic', 'A1', 'questions_basic', 7, 'Les questions simples',
  $body$Pour poser une **question** au présent simple, on commence par **Do / Does / Am / Is / Are**.

**Avec un verbe ordinaire :**
- **Do** + I / you / we / they + verbe ? : *Do you like coffee?*
- **Does** + he / she / it + verbe (sans -s !) ? : *Does she work?*

**Avec be :** on inverse sujet et verbe.
- *Are you ready? Is he French? Is it cold?*

**Avec can :** on inverse sujet et can.
- *Can you help me? Can she speak Spanish?*

**Questions ouvertes (Wh- questions) :** mot interrogatif + question.
- **What** = quoi : *What do you do?*
- **Where** = où : *Where do you live?*
- **When** = quand : *When does the train leave?*
- **Who** = qui : *Who is she?*
- **Why** = pourquoi : *Why are you sad?*
- **How** = comment : *How are you?*
- **How much / How many** = combien : *How many books do you have?*

**Réponses courtes (très utilisées) :**
- *Do you like tea? — Yes, I do. / No, I don't.*
- *Is she French? — Yes, she is. / No, she isn't.*$body$,
  '🟢',
  '[{"en":"Do you speak English?","fr":"Tu parles anglais ?"},{"en":"Does he live here?","fr":"Il habite ici ?"},{"en":"Are you tired?","fr":"Tu es fatigué ?"},{"en":"Is she a doctor?","fr":"Elle est médecin ?"},{"en":"Where do you live?","fr":"Où habites-tu ?"}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_questions_basic','mcq','___ you like tea?','["Do","Does","Are"]'::jsonb,'Do','Avec you → Do.',1),
('A1_questions_basic','mcq','___ she play piano?','["Do","Does","Is"]'::jsonb,'Does','3e personne → Does.',2),
('A1_questions_basic','mcq','___ they happy?','["Do","Does","Are"]'::jsonb,'Are','Question avec be → Are.',3),
('A1_questions_basic','reorder','live / where / you / do',null,'where do you live','Wh + Do + sujet + verbe.',4),
('A1_questions_basic','translate','Tu parles français ?',null,'do you speak french','Do + you + verbe.',5),
('A1_questions_basic','translate','Il est étudiant ?',null,'is he a student','Question avec be → Is.',6);

-- 8. POSSESSIVES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_possessives', 'A1', 'possessives', 8, 'Les adjectifs possessifs',
  $body$Les **adjectifs possessifs** indiquent à qui appartient quelque chose. Ils se placent **devant le nom**.

**Tableau complet :**
- **My** = mon / ma / mes
- **Your** = ton / ta / tes / votre / vos
- **His** = son / sa / ses (à lui — homme)
- **Her** = son / sa / ses (à elle — femme)
- **Its** = son / sa / ses (à ça — animal, objet)
- **Our** = notre / nos
- **Their** = leur / leurs

**⚠️ Piège important :** en anglais, l'adjectif possessif s'accorde avec le **possesseur**, pas avec l'objet possédé !
- *His mother* (sa mère, à lui) — peu importe que "mère" soit féminin
- *Her father* (son père, à elle) — peu importe que "père" soit masculin

**⚠️ Ne pas confondre :**
- **Its** (possessif, sans apostrophe) ≠ **It's** (= "it is", contraction)
- **Their** (possessif) ≠ **They're** (= "they are") ≠ **There** (= "là-bas")
- **Your** (possessif) ≠ **You're** (= "you are")

**Pronoms possessifs (à connaître plus tard) :** mine, yours, his, hers, ours, theirs.$body$,
  '🟢',
  '[{"en":"This is my book.","fr":"C''est mon livre."},{"en":"Your car is nice.","fr":"Ta voiture est belle."},{"en":"Her name is Ana.","fr":"Son prénom est Ana."},{"en":"Their house is big.","fr":"Leur maison est grande."},{"en":"His sister is here.","fr":"Sa sœur (à lui) est là."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_possessives','mcq','This is ___ phone (à moi).','["my","your","his"]'::jsonb,'my','À moi → my.',1),
('A1_possessives','mcq','He loves ___ dog (à lui).','["her","his","their"]'::jsonb,'his','À lui → his.',2),
('A1_possessives','mcq','She has ___ keys (à elle).','["his","her","its"]'::jsonb,'her','À elle → her.',3),
('A1_possessives','fill_blank','We like ___ teacher.',null,'our','À nous → our.',4),
('A1_possessives','fill_blank','They sold ___ car.',null,'their','À eux → their.',5),
('A1_possessives','translate','C''est mon ami.',null,'this is my friend','Mon → my.',6);

-- 9. PREPOSITIONS_BASIC
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_prepositions_basic', 'A1', 'prepositions_basic', 9, 'Prépositions de lieu : in / on / at',
  $body$Les **prépositions de lieu** indiquent **où** se trouve quelque chose.

**IN = dans / à l'intérieur de** (espace fermé, volume)
- *in the box, in the kitchen, in the car*
- Pour les villes et pays : *in Paris, in France*
- Mois, années, saisons : *in January, in 2024, in summer*

**ON = sur** (en contact avec une surface)
- *on the table, on the wall, on the floor*
- Jours et dates : *on Monday, on July 4th*

**AT = à** (un point précis ou une adresse)
- *at home, at school, at the bus stop*
- Heures précises : *at 7 o'clock, at noon*
- Événements : *at the party, at the meeting*

**Astuce mnémotechnique :**
- **IN** : tu peux ENTRER dedans (*in the room, in Paris*)
- **ON** : tu poses DESSUS (*on the table, on Monday*)
- **AT** : c'est un POINT précis (*at home, at 7am*)

**Exemples de pièges :**
- *in the morning* mais *at night*
- *in summer* mais *on Monday*
- *at home* mais *in the house*$body$,
  '🟢',
  '[{"en":"The book is on the table.","fr":"Le livre est sur la table."},{"en":"She is in the kitchen.","fr":"Elle est dans la cuisine."},{"en":"I am at home.","fr":"Je suis à la maison."},{"en":"They live in London.","fr":"Ils vivent à Londres."},{"en":"The meeting is at 3pm.","fr":"La réunion est à 15h."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_prepositions_basic','mcq','The keys are ___ the table.','["in","on","at"]'::jsonb,'on','Sur → on.',1),
('A1_prepositions_basic','mcq','I live ___ Paris.','["in","on","at"]'::jsonb,'in','Ville → in.',2),
('A1_prepositions_basic','mcq','She is ___ home.','["in","on","at"]'::jsonb,'at','at home (point).',3),
('A1_prepositions_basic','fill_blank','The cat is ___ the box.',null,'in','Dans → in.',4),
('A1_prepositions_basic','fill_blank','We are ___ school.',null,'at','at school.',5),
('A1_prepositions_basic','translate','Le livre est sur la chaise.',null,'the book is on the chair','Sur → on.',6);

-- 10. THERE_IS_ARE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_there_is_are', 'A1', 'there_is_are', 10, 'There is / There are (Il y a)',
  $body$**There is** et **There are** veulent dire **il y a** en français : on les utilise pour signaler l'existence ou la présence de quelque chose.

**Forme positive :**
- **There is** + nom singulier : *There is a cat in the garden.*
- **There are** + nom pluriel : *There are three books on the table.*

**Contractions :** *There's a cat. (There's = there is)*
Note : *there're* existe mais est rarement utilisé à l'écrit.

**Forme négative :**
- *There is not / There isn't* : *There isn't a problem.*
- *There are not / There aren't* : *There aren't any apples.*
- Avec "any" pour les pluriels négatifs : *There aren't any chairs.*

**Question :**
- *Is there...?* : *Is there a problem?*
- *Are there...?* : *Are there many people?*

**Réponses courtes :**
- *Is there a phone? — Yes, there is. / No, there isn't.*
- *Are there students? — Yes, there are. / No, there aren't.*

**⚠️ Différence avec "it is" :**
- *It is cold.* (= il fait froid) → météo, état général
- *There is a cat.* (= il y a un chat) → existence d'un objet$body$,
  '🟢',
  '[{"en":"There is a book on the table.","fr":"Il y a un livre sur la table."},{"en":"There are five chairs.","fr":"Il y a cinq chaises."},{"en":"Is there a problem?","fr":"Y a-t-il un problème ?"},{"en":"There aren''t any apples.","fr":"Il n''y a pas de pommes."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_there_is_are','mcq','___ a cat in the room.','["There is","There are","It is"]'::jsonb,'There is','Singulier → there is.',1),
('A1_there_is_are','mcq','___ three books on the desk.','["There is","There are","It are"]'::jsonb,'There are','Pluriel → there are.',2),
('A1_there_is_are','fill_blank','___ many people here.',null,'there are','Pluriel → there are.',3),
('A1_there_is_are','fill_blank','___ a problem with my phone.',null,'there is','Singulier → there is.',4),
('A1_there_is_are','translate','Il y a deux chiens.',null,'there are two dogs','Pluriel → there are.',5),
('A1_there_is_are','translate','Il y a un livre.',null,'there is a book','Singulier → there is.',6);

-- 11. PRESENT_CONTINUOUS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_present_continuous', 'A1', 'present_continuous', 11, 'Le présent continu (be + -ing)',
  $body$Le **présent continu** sert à parler d'une action **en cours maintenant** ou d'une action temporaire.

**Forme : be (am/is/are) + verbe + -ing**
- I am working (je suis en train de travailler)
- You are reading
- He is sleeping
- She is eating
- It is raining
- We are talking
- They are playing

**Contractions :** *I'm working, He's reading, They're playing.*

**Règles d'orthographe pour le -ing :**
- Verbe finit par **-e** muet → on enlève le -e : *make → making, write → writing*
- Verbe d'1 syllabe finissant par consonne-voyelle-consonne → on **double** la consonne : *run → running, swim → swimming, sit → sitting*
- Verbe finit par **-ie** → -ie devient **-y** : *lie → lying, die → dying*

**Forme négative :** *I am not working, She isn't sleeping, They aren't playing.*

**Question :** *Are you working? Is he sleeping? What are you doing?*

**Mots-clés du présent continu :** *now, right now, at the moment, currently, today.*

**⚠️ Présent simple vs présent continu :**
- *I work in Paris.* → habitude (présent simple)
- *I am working now.* → action en cours (présent continu)$body$,
  '🟢',
  '[{"en":"I am eating.","fr":"Je suis en train de manger."},{"en":"She is sleeping.","fr":"Elle est en train de dormir."},{"en":"They are playing football.","fr":"Ils jouent au football (en ce moment)."},{"en":"What are you doing?","fr":"Qu''est-ce que tu fais ?"},{"en":"It''s raining.","fr":"Il pleut (maintenant)."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_present_continuous','mcq','She ___ a book.','["read","is reading","reading"]'::jsonb,'is reading','be + verbe-ing.',1),
('A1_present_continuous','mcq','We ___ TV right now.','["watch","watching","are watching"]'::jsonb,'are watching','We + are + verbe-ing.',2),
('A1_present_continuous','fill_blank','I ___ (write) an email now.',null,'am writing','I + am + writing (-e tombe).',3),
('A1_present_continuous','fill_blank','They ___ (play) outside.',null,'are playing','They + are + playing.',4),
('A1_present_continuous','translate','Je suis en train de manger.',null,'i am eating','I + am + eating.',5),
('A1_present_continuous','translate','Elle dort.',null,'she is sleeping','She + is + sleeping.',6);

-- 12. CAN
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_can', 'A1', 'can', 12, 'Le verbe Can (pouvoir / savoir)',
  $body$**Can** est un **verbe modal** : il exprime une **capacité**, une **permission** ou une **possibilité**.

**3 sens principaux :**
- **Capacité (savoir faire)** : *I can swim* → je sais nager
- **Permission (avoir le droit)** : *Can I leave?* → puis-je sortir ?
- **Possibilité** : *It can rain.* → il peut pleuvoir.

**⚠️ Particularités du verbe Can :**
- **Ne change PAS** selon le sujet : *I can, you can, he can, she can, we can, they can*
- **Suivi du verbe à l'infinitif SANS "to"** : ❌ *I can to swim* — ✅ *I can swim*
- **Pas de -s à la 3e personne** : ❌ *She cans* — ✅ *She can*

**Forme négative :** *cannot* ou **can't** (toujours en un mot pour cannot !).
- *I cannot swim. = I can't swim.*

**Question :** inversion sujet/can.
- *Can you help me? Can she speak Spanish?*

**Réponses courtes :**
- *Can you swim? — Yes, I can. / No, I can't.*

**Pour parler du passé : could.** *I could swim when I was 5.*$body$,
  '🟢',
  '[{"en":"I can swim.","fr":"Je sais nager."},{"en":"She can speak English.","fr":"Elle parle anglais."},{"en":"Can you help me?","fr":"Tu peux m''aider ?"},{"en":"He can''t cook.","fr":"Il ne sait pas cuisiner."},{"en":"Can I go to the bathroom?","fr":"Puis-je aller aux toilettes ?"}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_can','mcq','I ___ play guitar.','["can","cans","is can"]'::jsonb,'can','Can ne change pas.',1),
('A1_can','mcq','She ___ swim.','["can","cans","can to"]'::jsonb,'can','Can + verbe sans "to".',2),
('A1_can','fill_blank','___ you help me?',null,'can','Question → Can + sujet.',3),
('A1_can','fill_blank','He ___ (not / cook).',null,'can''t cook','Négation → can''t.',4),
('A1_can','translate','Je sais parler espagnol.',null,'i can speak spanish','Can + verbe.',5),
('A1_can','translate','Tu peux nager ?',null,'can you swim','Can + you + verbe.',6);

-- 13. PLURALS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_plurals', 'A1', 'plurals', 13, 'Le pluriel des noms',
  $body$En anglais, on forme le **pluriel** d'un nom en ajoutant **-s** la plupart du temps.

**Règle générale :** singulier + **-s** → *book/books, car/cars, friend/friends*

**Cas particuliers (3 règles à retenir) :**

**1. Mots en -s, -x, -ch, -sh, -o → on ajoute -ES**
- *bus → buses, box → boxes, watch → watches, dish → dishes, tomato → tomatoes*

**2. Mots en -y précédé d'une consonne → -y devient -IES**
- *baby → babies, country → countries, story → stories*
- Si voyelle avant -y, on garde -s simple : *boy → boys, day → days*

**3. Mots en -f / -fe → on remplace par -VES**
- *leaf → leaves, knife → knives, life → lives, wife → wives*

**Pluriels irréguliers (à apprendre par cœur) :**
- man → **men**
- woman → **women**
- child → **children**
- foot → **feet**
- tooth → **teeth**
- mouse → **mice**
- person → **people**
- fish → **fish** (invariable)
- sheep → **sheep** (invariable)$body$,
  '🟢',
  '[{"en":"two books","fr":"deux livres"},{"en":"three buses","fr":"trois bus"},{"en":"five babies","fr":"cinq bébés"},{"en":"two children","fr":"deux enfants"},{"en":"many people","fr":"beaucoup de gens"}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_plurals','mcq','Pluriel de "book" :','["books","bookes","bookies"]'::jsonb,'books','Régulier → +s.',1),
('A1_plurals','mcq','Pluriel de "child" :','["childs","children","childes"]'::jsonb,'children','Irrégulier → children.',2),
('A1_plurals','mcq','Pluriel de "baby" :','["babys","babies","babes"]'::jsonb,'babies','y → ies.',3),
('A1_plurals','fill_blank','Pluriel de "bus" :',null,'buses','-s → +es.',4),
('A1_plurals','fill_blank','Pluriel de "man" :',null,'men','Irrégulier.',5),
('A1_plurals','translate','J''ai trois enfants.',null,'i have three children','Pluriel irrégulier.',6);

-- 14. DEMONSTRATIVES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values (
  'A1_demonstratives', 'A1', 'demonstratives', 14, 'This / That / These / Those',
  $body$Les **démonstratifs** servent à montrer ou désigner une chose, en tenant compte de **2 critères** : le nombre (singulier/pluriel) et la distance (proche/loin).

**Tableau complet :**

|         | Singulier  | Pluriel    |
|---------|------------|------------|
| Proche  | **This**   | **These**  |
| Loin    | **That**   | **Those**  |

**This = ce / cette** (singulier, **proche**)
- *This book is mine.* (le livre que j'ai dans la main / ici)

**That = ce / cette** (singulier, **loin** ou éloigné dans le temps)
- *That car is red.* (la voiture là-bas)

**These = ces** (pluriel, **proches**)
- *These shoes are new.* (ces chaussures que je porte)

**Those = ces** (pluriel, **loin**)
- *Those people are loud.* (ces gens là-bas)

**Astuce mnémotechnique :**
- **TH-IS / TH-ESE** = ICI (proche)
- **TH-AT / TH-OSE** = LÀ-BAS (loin)

**Aussi utilisé pour le temps :**
- *This week* (cette semaine, en cours)
- *That day* (ce jour-là, dans le passé)

**Pronoms :** ces démonstratifs peuvent aussi être utilisés seuls comme pronoms.
- *This is mine.* (ceci est à moi)
- *I like that.* (j'aime ça)$body$,
  '🟢',
  '[{"en":"This is my house.","fr":"C''est ma maison (proche)."},{"en":"That car is red.","fr":"Cette voiture (là-bas) est rouge."},{"en":"These shoes are new.","fr":"Ces chaussures sont neuves."},{"en":"Those people are loud.","fr":"Ces gens (là-bas) sont bruyants."}]'::jsonb
);

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_demonstratives','mcq','___ book is mine (ici, près).','["This","That","Those"]'::jsonb,'This','Singulier proche → This.',1),
('A1_demonstratives','mcq','___ shoes are old (là-bas).','["These","Those","This"]'::jsonb,'Those','Pluriel loin → Those.',2),
('A1_demonstratives','mcq','Look at ___ flowers (ici).','["this","these","that"]'::jsonb,'these','Pluriel proche → these.',3),
('A1_demonstratives','fill_blank','___ pen is broken (là-bas).',null,'that','Singulier loin → that.',4),
('A1_demonstratives','translate','Cette maison est belle (proche).',null,'this house is beautiful','Singulier proche → this.',5),
('A1_demonstratives','translate','Ces enfants jouent.',null,'these children are playing','Pluriel proche → these.',6);

-- ─── Vérification ───
select count(*) as nb_topics_a1 from public.grammar_topics where level = 'A1';
select count(*) as nb_exos_a1 from public.grammar_exercises ge join public.grammar_topics gt on gt.id = ge.topic_id where gt.level = 'A1';
select id, length(rule_md) as taille_caractere from public.grammar_topics where level = 'A1' order by position;
