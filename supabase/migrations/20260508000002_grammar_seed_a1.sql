-- v3.24.0 — Seed grammaire A1 (14 topics × ~6 exercices = 84 exercices)
-- À exécuter APRÈS la migration 20260508000001_grammar_engine.sql

-- Helper : insertion idempotente
-- Format topic : id, level, slug, position, title_fr, rule_md, emoji, examples_json

-- 1. TO_BE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_to_be', 'A1', 'to_be', 1, 'Le verbe Be (être)',
'**Be** veut dire **être**. Il sert à dire qui on est, comment on se sent, ou décrire quelque chose.

Conjugaison au présent :
- **I am** → je suis
- **You are** → tu es / vous êtes
- **He / She / It is** → il / elle / ce est
- **We are** → nous sommes
- **They are** → ils / elles sont',
'🟢',
'[{"en":"I am tired.","fr":"Je suis fatigué."},{"en":"She is a teacher.","fr":"Elle est professeur."},{"en":"They are at home.","fr":"Ils sont à la maison."},{"en":"We are ready.","fr":"Nous sommes prêts."},{"en":"It is cold.","fr":"Il fait froid."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_to_be','mcq','She ___ a doctor.','["am","is","are"]'::jsonb,'is','Avec She, il faut "is".',1),
('A1_to_be','mcq','They ___ happy.','["am","is","are"]'::jsonb,'are','Avec They, il faut "are".',2),
('A1_to_be','fill_blank','I ___ tired.',null,'am','Avec I, il faut "am".',3),
('A1_to_be','fill_blank','We ___ at school.',null,'are','Avec We, il faut "are".',4),
('A1_to_be','reorder','happy / is / she',null,'she is happy','Sujet + verbe + adjectif.',5),
('A1_to_be','translate','Je suis professeur.',null,'i am a teacher','I am + a + nom de métier.',6);

-- 2. TO_HAVE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_to_have', 'A1', 'to_have', 2, 'Le verbe Have (avoir)',
'**Have** veut dire **avoir**. On l''utilise pour la possession ou pour parler de l''âge, de la famille, des objets.

Conjugaison au présent :
- **I / You / We / They have** → j''ai, tu as, nous avons, ils ont
- **He / She / It has** → il a, elle a

Astuce : à la 3e personne du singulier, "have" devient **has**.',
'🟢',
'[{"en":"I have a sister.","fr":"J''ai une sœur."},{"en":"She has a cat.","fr":"Elle a un chat."},{"en":"They have a car.","fr":"Ils ont une voiture."},{"en":"He has brown eyes.","fr":"Il a les yeux marron."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_to_have','mcq','She ___ two brothers.','["have","has","is"]'::jsonb,'has','À la 3e personne (she), "have" devient "has".',1),
('A1_to_have','mcq','We ___ a big house.','["have","has","are"]'::jsonb,'have','Avec We, on garde "have".',2),
('A1_to_have','fill_blank','I ___ a new phone.',null,'have','Avec I, on utilise "have".',3),
('A1_to_have','fill_blank','He ___ a dog.',null,'has','He = 3e personne → has.',4),
('A1_to_have','reorder','a / he / car / has',null,'he has a car','Sujet + has + a + objet.',5),
('A1_to_have','translate','Elle a un frère.',null,'she has a brother','Avec She → has.',6);

-- 3. PRONOUNS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_pronouns', 'A1', 'pronouns', 3, 'Les pronoms personnels',
'Les pronoms personnels remplacent un nom :

- **I** = je
- **You** = tu / vous
- **He** = il (homme)
- **She** = elle (femme)
- **It** = il / elle / ce (objet, animal, idée)
- **We** = nous
- **They** = ils / elles

En anglais, **You** sert pour "tu" comme pour "vous".',
'🟢',
'[{"en":"He is my brother.","fr":"C''est mon frère."},{"en":"She is nice.","fr":"Elle est gentille."},{"en":"It is a book.","fr":"C''est un livre."},{"en":"We are friends.","fr":"Nous sommes amis."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_pronouns','mcq','___ am French.','["I","He","They"]'::jsonb,'I','"am" va avec "I".',1),
('A1_pronouns','mcq','Maria is at home. ___ is happy.','["He","She","It"]'::jsonb,'She','Maria est une femme → She.',2),
('A1_pronouns','mcq','My dog is big. ___ is friendly.','["He","She","It"]'::jsonb,'It','Pour un animal/objet → It.',3),
('A1_pronouns','fill_blank','Tom and I are friends. ___ are happy.',null,'we','Tom + I = We.',4),
('A1_pronouns','fill_blank','Anna and Bob are here. ___ are tired.',null,'they','Plusieurs personnes → They.',5),
('A1_pronouns','translate','Elle est jeune.',null,'she is young','Elle = She.',6);

-- 4. ARTICLES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_articles', 'A1', 'articles', 4, 'Les articles : a / an / the',
'**A** et **An** = un / une (article indéfini, pour quelque chose d''indéfini ou nouveau)
- **A** devant une consonne : *a book*, *a cat*
- **An** devant une voyelle (a, e, i, o, u) ou un h muet : *an apple*, *an hour*

**The** = le / la / les (article défini, pour quelque chose de précis ou déjà connu)
- *The book on the table* → le livre (précis)',
'🟢',
'[{"en":"I have a book.","fr":"J''ai un livre."},{"en":"She eats an apple.","fr":"Elle mange une pomme."},{"en":"The dog is small.","fr":"Le chien est petit."},{"en":"This is an old house.","fr":"C''est une vieille maison."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_articles','mcq','I see ___ elephant.','["a","an","the"]'::jsonb,'an','Devant une voyelle (e) → an.',1),
('A1_articles','mcq','She has ___ car.','["a","an","the"]'::jsonb,'a','Devant une consonne (c) → a.',2),
('A1_articles','mcq','Open ___ door, please.','["a","an","the"]'::jsonb,'the','La porte précise → the.',3),
('A1_articles','fill_blank','I want ___ orange.',null,'an','Voyelle (o) → an.',4),
('A1_articles','fill_blank','He is ___ teacher.',null,'a','Consonne (t) → a.',5),
('A1_articles','translate','C''est une pomme.',null,'it is an apple','an + voyelle.',6);

-- 5. PRESENT_SIMPLE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_present_simple', 'A1', 'present_simple', 5, 'Le présent simple',
'On utilise le **présent simple** pour parler d''**habitudes** ou de **vérités générales**.

Forme :
- **I / You / We / They** + verbe : *I work, You work*
- **He / She / It** + verbe + **-s** : *He works, She works*

Astuce : à la 3e personne du singulier, on ajoute **-s** au verbe.',
'🟢',
'[{"en":"I work every day.","fr":"Je travaille tous les jours."},{"en":"She eats breakfast.","fr":"Elle prend le petit-déjeuner."},{"en":"They play football.","fr":"Ils jouent au football."},{"en":"He drinks coffee.","fr":"Il boit du café."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_present_simple','mcq','She ___ every day.','["work","works","working"]'::jsonb,'works','3e personne → +s.',1),
('A1_present_simple','mcq','We ___ in Paris.','["live","lives","living"]'::jsonb,'live','We → pas de -s.',2),
('A1_present_simple','fill_blank','He ___ (drink) coffee.',null,'drinks','3e personne → drinks.',3),
('A1_present_simple','fill_blank','I ___ (play) football.',null,'play','I → play (pas de -s).',4),
('A1_present_simple','reorder','football / play / they',null,'they play football','Sujet + verbe + objet.',5),
('A1_present_simple','translate','Elle mange une pomme.',null,'she eats an apple','3e personne → eats.',6);

-- 6. NEGATION
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_negation', 'A1', 'negation', 6, 'La négation',
'Pour mettre un verbe à la **forme négative** au présent simple, on ajoute **don''t** ou **doesn''t** devant le verbe.

- **I / You / We / They** + **don''t** + verbe : *I don''t work*
- **He / She / It** + **doesn''t** + verbe (sans -s) : *She doesn''t work*

Avec **be** (am/is/are), on ajoute juste **not** :
- *I am not, You are not, He is not*',
'🟢',
'[{"en":"I don''t like coffee.","fr":"Je n''aime pas le café."},{"en":"She doesn''t speak French.","fr":"Elle ne parle pas français."},{"en":"They are not here.","fr":"Ils ne sont pas là."},{"en":"He doesn''t eat meat.","fr":"Il ne mange pas de viande."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_negation','mcq','She ___ like fish.','["don''t","doesn''t","not"]'::jsonb,'doesn''t','3e personne → doesn''t.',1),
('A1_negation','mcq','I ___ work on Sundays.','["don''t","doesn''t","am not"]'::jsonb,'don''t','I → don''t.',2),
('A1_negation','fill_blank','He ___ (not / play) tennis.',null,'doesn''t play','3e personne → doesn''t + verbe.',3),
('A1_negation','fill_blank','We ___ (not / live) in London.',null,'don''t live','We → don''t + verbe.',4),
('A1_negation','translate','Je ne suis pas fatigué.',null,'i am not tired','Avec be → not.',5),
('A1_negation','translate','Elle ne mange pas de viande.',null,'she doesn''t eat meat','3e personne → doesn''t.',6);

-- 7. QUESTIONS_BASIC
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_questions_basic', 'A1', 'questions_basic', 7, 'Les questions simples',
'Pour poser une **question** au présent simple, on commence par **Do** ou **Does**, puis le sujet, puis le verbe.

- **Do** + I / you / we / they + verbe ? *Do you like coffee?*
- **Does** + he / she / it + verbe (sans -s) ? *Does she work?*

Avec **be** : on inverse juste sujet et verbe.
- *Are you ready?*, *Is he French?*',
'🟢',
'[{"en":"Do you speak English?","fr":"Tu parles anglais ?"},{"en":"Does he live here?","fr":"Il habite ici ?"},{"en":"Are you tired?","fr":"Tu es fatigué ?"},{"en":"Is she a doctor?","fr":"Elle est médecin ?"}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_questions_basic','mcq','___ you like tea?','["Do","Does","Are"]'::jsonb,'Do','Avec you → Do.',1),
('A1_questions_basic','mcq','___ she play piano?','["Do","Does","Is"]'::jsonb,'Does','3e personne → Does.',2),
('A1_questions_basic','mcq','___ they happy?','["Do","Does","Are"]'::jsonb,'Are','Question avec be → Are.',3),
('A1_questions_basic','reorder','live / where / you / do',null,'where do you live','Wh + Do + sujet + verbe.',4),
('A1_questions_basic','translate','Tu parles français ?',null,'do you speak french','Do + you + verbe.',5),
('A1_questions_basic','translate','Il est étudiant ?',null,'is he a student','Question avec be → Is.',6);

-- 8. POSSESSIVES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_possessives', 'A1', 'possessives', 8, 'Les adjectifs possessifs',
'Les **adjectifs possessifs** indiquent à qui appartient quelque chose. Ils se placent **devant le nom**.

- **My** = mon / ma / mes
- **Your** = ton / ta / tes (ou votre)
- **His** = son / sa / ses (à lui)
- **Her** = son / sa / ses (à elle)
- **Its** = son / sa / ses (objet, animal)
- **Our** = notre / nos
- **Their** = leur / leurs',
'🟢',
'[{"en":"This is my book.","fr":"C''est mon livre."},{"en":"Your car is nice.","fr":"Ta voiture est belle."},{"en":"Her name is Ana.","fr":"Son prénom est Ana."},{"en":"Their house is big.","fr":"Leur maison est grande."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_possessives','mcq','This is ___ phone (à moi).','["my","your","his"]'::jsonb,'my','À moi → my.',1),
('A1_possessives','mcq','He loves ___ dog (à lui).','["her","his","their"]'::jsonb,'his','À lui (homme) → his.',2),
('A1_possessives','mcq','She has ___ keys (à elle).','["his","her","its"]'::jsonb,'her','À elle (femme) → her.',3),
('A1_possessives','fill_blank','We like ___ teacher.',null,'our','À nous → our.',4),
('A1_possessives','fill_blank','They sold ___ car.',null,'their','À eux → their.',5),
('A1_possessives','translate','C''est mon ami.',null,'this is my friend','Mon → my.',6);

-- 9. PREPOSITIONS_BASIC
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_prepositions_basic', 'A1', 'prepositions_basic', 9, 'Prépositions de lieu : in / on / at',
'Les prépositions de lieu indiquent **où** se trouve quelque chose.

- **In** = dans (à l''intérieur de) : *in the box, in Paris*
- **On** = sur (en contact avec une surface) : *on the table, on the wall*
- **At** = à (un point précis) : *at home, at school, at the bus stop*',
'🟢',
'[{"en":"The book is on the table.","fr":"Le livre est sur la table."},{"en":"She is in the kitchen.","fr":"Elle est dans la cuisine."},{"en":"I am at home.","fr":"Je suis à la maison."},{"en":"They live in London.","fr":"Ils vivent à Londres."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_prepositions_basic','mcq','The keys are ___ the table.','["in","on","at"]'::jsonb,'on','Sur la table → on.',1),
('A1_prepositions_basic','mcq','I live ___ Paris.','["in","on","at"]'::jsonb,'in','Pour une ville → in.',2),
('A1_prepositions_basic','mcq','She is ___ home.','["in","on","at"]'::jsonb,'at','À la maison → at home.',3),
('A1_prepositions_basic','fill_blank','The cat is ___ the box.',null,'in','Dans la boîte → in.',4),
('A1_prepositions_basic','fill_blank','We are ___ school.',null,'at','À l''école → at school.',5),
('A1_prepositions_basic','translate','Le livre est sur la chaise.',null,'the book is on the chair','Sur → on.',6);

-- 10. THERE_IS_ARE
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_there_is_are', 'A1', 'there_is_are', 10, 'There is / There are (Il y a)',
'**There is** et **There are** veulent dire **il y a** en français.

- **There is** + nom singulier : *There is a cat in the garden.*
- **There are** + nom pluriel : *There are three books on the table.*

Question : *Is there...? / Are there...?*
Négation : *There is not / There isn''t — There are not / There aren''t.*',
'🟢',
'[{"en":"There is a book on the table.","fr":"Il y a un livre sur la table."},{"en":"There are five chairs.","fr":"Il y a cinq chaises."},{"en":"Is there a problem?","fr":"Y a-t-il un problème ?"},{"en":"There aren''t any apples.","fr":"Il n''y a pas de pommes."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_there_is_are','mcq','___ a cat in the room.','["There is","There are","It is"]'::jsonb,'There is','Singulier (a cat) → there is.',1),
('A1_there_is_are','mcq','___ three books on the desk.','["There is","There are","It are"]'::jsonb,'There are','Pluriel (three books) → there are.',2),
('A1_there_is_are','fill_blank','___ many people here.',null,'there are','Pluriel (many) → there are.',3),
('A1_there_is_are','fill_blank','___ a problem with my phone.',null,'there is','Singulier (a problem) → there is.',4),
('A1_there_is_are','translate','Il y a deux chiens.',null,'there are two dogs','Pluriel → there are.',5),
('A1_there_is_are','translate','Il y a un livre.',null,'there is a book','Singulier → there is.',6);

-- 11. PRESENT_CONTINUOUS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_present_continuous', 'A1', 'present_continuous', 11, 'Le présent continu (be + -ing)',
'Le **présent continu** sert à parler d''une action en cours **maintenant**.

Forme : **be** (am/is/are) + verbe + **-ing**

- *I am working* → je suis en train de travailler
- *She is reading* → elle est en train de lire
- *They are playing* → ils sont en train de jouer

Mots-clés : *now, right now, at the moment*.',
'🟢',
'[{"en":"I am eating.","fr":"Je suis en train de manger."},{"en":"She is sleeping.","fr":"Elle est en train de dormir."},{"en":"They are playing football.","fr":"Ils jouent au football (en ce moment)."},{"en":"What are you doing?","fr":"Qu''est-ce que tu fais ?"}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_present_continuous','mcq','She ___ a book.','["read","is reading","reading"]'::jsonb,'is reading','be + verbe-ing → is reading.',1),
('A1_present_continuous','mcq','We ___ TV right now.','["watch","watching","are watching"]'::jsonb,'are watching','We + are + verbe-ing.',2),
('A1_present_continuous','fill_blank','I ___ (write) an email now.',null,'am writing','I + am + writing.',3),
('A1_present_continuous','fill_blank','They ___ (play) outside.',null,'are playing','They + are + playing.',4),
('A1_present_continuous','translate','Je suis en train de manger.',null,'i am eating','I + am + eating.',5),
('A1_present_continuous','translate','Elle dort.',null,'she is sleeping','She + is + sleeping.',6);

-- 12. CAN
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_can', 'A1', 'can', 12, 'Le verbe Can (pouvoir / savoir)',
'**Can** sert à exprimer une **capacité** (savoir faire) ou une **permission** (pouvoir).

- *I can swim* → je sais nager
- *She can speak Spanish* → elle parle espagnol (capacité)
- *Can I help you?* → puis-je t''aider ?

**Can** ne change pas selon le sujet et est suivi d''un verbe à l''infinitif sans "to".

Négation : *cannot / can''t*',
'🟢',
'[{"en":"I can swim.","fr":"Je sais nager."},{"en":"She can speak English.","fr":"Elle parle anglais."},{"en":"Can you help me?","fr":"Tu peux m''aider ?"},{"en":"He can''t cook.","fr":"Il ne sait pas cuisiner."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_can','mcq','I ___ play guitar.','["can","cans","is can"]'::jsonb,'can','Can ne change pas.',1),
('A1_can','mcq','She ___ swim.','["can","cans","can to"]'::jsonb,'can','Can + verbe sans "to".',2),
('A1_can','fill_blank','___ you help me?',null,'can','Question avec can → Can + sujet.',3),
('A1_can','fill_blank','He ___ (not / cook).',null,'can''t cook','Négation → can''t.',4),
('A1_can','translate','Je sais parler espagnol.',null,'i can speak spanish','Can + verbe.',5),
('A1_can','translate','Tu peux nager ?',null,'can you swim','Can + you + verbe.',6);

-- 13. PLURALS
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_plurals', 'A1', 'plurals', 13, 'Le pluriel des noms',
'En anglais, on forme le **pluriel** en ajoutant **-s** au nom.

- *book → books, car → cars, friend → friends*

Cas particuliers :
- Mots en **-s, -x, -ch, -sh** : on ajoute **-es** : *bus → buses, box → boxes*
- Mots en **-y** précédé d''une consonne : **y → ies** : *baby → babies*
- **Pluriels irréguliers** : *man → men, woman → women, child → children, foot → feet*',
'🟢',
'[{"en":"two books","fr":"deux livres"},{"en":"three buses","fr":"trois bus"},{"en":"five babies","fr":"cinq bébés"},{"en":"two children","fr":"deux enfants"}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_plurals','mcq','Pluriel de "book" :','["books","bookes","bookies"]'::jsonb,'books','Régulier → +s.',1),
('A1_plurals','mcq','Pluriel de "child" :','["childs","children","childes"]'::jsonb,'children','Irrégulier → children.',2),
('A1_plurals','mcq','Pluriel de "baby" :','["babys","babies","babes"]'::jsonb,'babies','y → ies.',3),
('A1_plurals','fill_blank','Pluriel de "bus" :',null,'buses','-s en fin → +es.',4),
('A1_plurals','fill_blank','Pluriel de "man" :',null,'men','Irrégulier → men.',5),
('A1_plurals','translate','J''ai trois enfants.',null,'i have three children','Pluriel irrégulier → children.',6);

-- 14. DEMONSTRATIVES
insert into public.grammar_topics (id, level, slug, position, title_fr, rule_md, emoji, examples_json) values
('A1_demonstratives', 'A1', 'demonstratives', 14, 'This / That / These / Those',
'Les **démonstratifs** servent à montrer ou désigner une chose.

- **This** = ce / cette (singulier, **proche**) : *this book*
- **That** = ce / cette (singulier, **loin**) : *that book*
- **These** = ces (pluriel, **proche**) : *these books*
- **Those** = ces (pluriel, **loin**) : *those books*',
'🟢',
'[{"en":"This is my house.","fr":"C''est ma maison (proche)."},{"en":"That car is red.","fr":"Cette voiture (là-bas) est rouge."},{"en":"These shoes are new.","fr":"Ces chaussures sont neuves."},{"en":"Those people are loud.","fr":"Ces gens (là-bas) sont bruyants."}]'::jsonb)
on conflict (id) do nothing;

insert into public.grammar_exercises (topic_id, type, question, options_json, answer, explanation_fr, position) values
('A1_demonstratives','mcq','___ book is mine (ici, près).','["This","That","Those"]'::jsonb,'This','Singulier proche → This.',1),
('A1_demonstratives','mcq','___ shoes are old (là-bas).','["These","Those","This"]'::jsonb,'Those','Pluriel loin → Those.',2),
('A1_demonstratives','mcq','Look at ___ flowers (ici).','["this","these","that"]'::jsonb,'these','Pluriel proche → these.',3),
('A1_demonstratives','fill_blank','___ pen is broken (là-bas).',null,'that','Singulier loin → that.',4),
('A1_demonstratives','translate','Cette maison est belle (proche).',null,'this house is beautiful','Singulier proche → this.',5),
('A1_demonstratives','translate','Ces enfants jouent.',null,'these children are playing','Pluriel proche → these.',6);
