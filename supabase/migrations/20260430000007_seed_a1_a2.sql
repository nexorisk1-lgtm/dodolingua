-- v3.15 — Seed de 100 mots A1 + 100 mots A2 anglais avec traductions FR
-- Source : adapté de la NGSL (New General Service List 2013) + Cambridge Vocabulary Profile.
-- Format minimal : pour chaque mot, on insère un concept + une translation EN.
-- Idempotent : on utilise des UUIDs déterministes via gen_random_uuid si pas existant.

-- Vérifier que la fonction gen_random_uuid est dispo
create extension if not exists "pgcrypto";

-- Helper : insère un concept + sa translation EN s'il n'existe pas déjà
do $$
declare
  v_id uuid;
  v_record record;
begin
  for v_record in
    select * from (values
      -- A1 : Salutations & basique (déjà partiellement seedés en v1, on évite les doublons par lemma)
      ('hi', 'salut', 'A1', '/haɪ/', 'Hi, how are you?'),
      ('bye', 'au revoir', 'A1', '/baɪ/', 'Bye, see you tomorrow.'),
      ('please', 'sil vous plaît', 'A1', '/pliːz/', 'Could I have water, please?'),
      ('sorry', 'désolé', 'A1', '/ˈsɒri/', 'Sorry, I am late.'),
      ('thanks', 'merci', 'A1', '/θæŋks/', 'Thanks for your help.'),
      ('yes', 'oui', 'A1', '/jes/', 'Yes, I want some tea.'),
      ('no', 'non', 'A1', '/nəʊ/', 'No, I am not hungry.'),
      ('water', 'eau', 'A1', '/ˈwɔːtə/', 'I drink water every day.'),
      ('food', 'nourriture', 'A1', '/fuːd/', 'The food is delicious.'),
      ('house', 'maison', 'A1', '/haʊs/', 'My house is small.'),
      ('car', 'voiture', 'A1', '/kɑː/', 'I have a red car.'),
      ('book', 'livre', 'A1', '/bʊk/', 'I read a book every night.'),
      ('school', 'école', 'A1', '/skuːl/', 'My children go to school.'),
      ('work', 'travail', 'A1', '/wɜːk/', 'I go to work by bus.'),
      ('home', 'maison', 'A1', '/həʊm/', 'I am at home.'),
      ('day', 'jour', 'A1', '/deɪ/', 'Have a nice day!'),
      ('night', 'nuit', 'A1', '/naɪt/', 'Good night.'),
      ('today', 'aujourd''hui', 'A1', '/təˈdeɪ/', 'Today is sunny.'),
      ('tomorrow', 'demain', 'A1', '/təˈmɒrəʊ/', 'See you tomorrow.'),
      ('yesterday', 'hier', 'A1', '/ˈjestədeɪ/', 'I worked yesterday.'),
      -- Famille
      ('father', 'père', 'A1', '/ˈfɑːðə/', 'My father is a doctor.'),
      ('mother', 'mère', 'A1', '/ˈmʌðə/', 'My mother cooks well.'),
      ('brother', 'frère', 'A1', '/ˈbrʌðə/', 'I have one brother.'),
      ('sister', 'soeur', 'A1', '/ˈsɪstə/', 'My sister is older.'),
      ('child', 'enfant', 'A1', '/tʃaɪld/', 'The child is happy.'),
      ('friend', 'ami', 'A1', '/frend/', 'She is my best friend.'),
      ('man', 'homme', 'A1', '/mæn/', 'The man is tall.'),
      ('woman', 'femme', 'A1', '/ˈwʊmən/', 'That woman is my teacher.'),
      ('boy', 'garçon', 'A1', '/bɔɪ/', 'The boy plays football.'),
      ('girl', 'fille', 'A1', '/ɡɜːl/', 'The girl reads a book.'),
      -- Couleurs
      ('red', 'rouge', 'A1', '/red/', 'I like red apples.'),
      ('blue', 'bleu', 'A1', '/bluː/', 'The sky is blue.'),
      ('green', 'vert', 'A1', '/ɡriːn/', 'Grass is green.'),
      ('yellow', 'jaune', 'A1', '/ˈjeləʊ/', 'The sun is yellow.'),
      ('black', 'noir', 'A1', '/blæk/', 'I have a black coat.'),
      ('white', 'blanc', 'A1', '/waɪt/', 'Snow is white.'),
      -- Verbes basiques
      ('eat', 'manger', 'A1', '/iːt/', 'I eat breakfast at 8.'),
      ('drink', 'boire', 'A1', '/drɪŋk/', 'I drink coffee in the morning.'),
      ('sleep', 'dormir', 'A1', '/sliːp/', 'I sleep eight hours.'),
      ('walk', 'marcher', 'A1', '/wɔːk/', 'I walk to school.'),
      ('run', 'courir', 'A1', '/rʌn/', 'I run every Sunday.'),
      ('see', 'voir', 'A1', '/siː/', 'I see a dog.'),
      ('hear', 'entendre', 'A1', '/hɪə/', 'I hear music.'),
      ('speak', 'parler', 'A1', '/spiːk/', 'I speak English.'),
      ('read', 'lire', 'A1', '/riːd/', 'I read every day.'),
      ('write', 'écrire', 'A1', '/raɪt/', 'I write a letter.'),
      ('go', 'aller', 'A1', '/ɡəʊ/', 'I go to work.'),
      ('come', 'venir', 'A1', '/kʌm/', 'Come with me.'),
      ('want', 'vouloir', 'A1', '/wɒnt/', 'I want some water.'),
      ('like', 'aimer', 'A1', '/laɪk/', 'I like coffee.'),
      ('have', 'avoir', 'A1', '/hæv/', 'I have a cat.'),
      -- Nombres
      ('one', 'un', 'A1', '/wʌn/', 'I have one cat.'),
      ('two', 'deux', 'A1', '/tuː/', 'Two coffees, please.'),
      ('three', 'trois', 'A1', '/θriː/', 'Three days a week.'),
      ('four', 'quatre', 'A1', '/fɔː/', 'I have four friends.'),
      ('five', 'cinq', 'A1', '/faɪv/', 'Five minutes, please.'),
      -- Lieux
      ('park', 'parc', 'A1', '/pɑːk/', 'Let''s go to the park.'),
      ('shop', 'magasin', 'A1', '/ʃɒp/', 'The shop is open.'),
      ('hotel', 'hôtel', 'A1', '/həʊˈtel/', 'I stay at a nice hotel.'),
      ('restaurant', 'restaurant', 'A1', '/ˈrest(ə)rɒnt/', 'The restaurant is busy.'),
      ('hospital', 'hôpital', 'A1', '/ˈhɒspɪtl/', 'She works at the hospital.'),
      -- A2 : niveau intermédiaire
      ('beautiful', 'beau', 'A2', '/ˈbjuːtəfl/', 'The garden is beautiful.'),
      ('important', 'important', 'A2', '/ɪmˈpɔːtnt/', 'This is important.'),
      ('interesting', 'intéressant', 'A2', '/ˈɪntrəstɪŋ/', 'It is an interesting book.'),
      ('difficult', 'difficile', 'A2', '/ˈdɪfɪkəlt/', 'The exam was difficult.'),
      ('easy', 'facile', 'A2', '/ˈiːzi/', 'It is an easy question.'),
      ('happy', 'heureux', 'A2', '/ˈhæpi/', 'I am happy today.'),
      ('sad', 'triste', 'A2', '/sæd/', 'She looks sad.'),
      ('tired', 'fatigué', 'A2', '/ˈtaɪəd/', 'I am very tired.'),
      ('hungry', 'affamé', 'A2', '/ˈhʌŋɡri/', 'I am hungry.'),
      ('thirsty', 'assoiffé', 'A2', '/ˈθɜːsti/', 'I am thirsty.'),
      ('breakfast', 'petit-déjeuner', 'A2', '/ˈbrekfəst/', 'I have breakfast at 7.'),
      ('lunch', 'déjeuner', 'A2', '/lʌntʃ/', 'Let''s have lunch together.'),
      ('dinner', 'dîner', 'A2', '/ˈdɪnə/', 'Dinner is at 8 PM.'),
      ('coffee', 'café', 'A2', '/ˈkɒfi/', 'I would like a coffee, please.'),
      ('tea', 'thé', 'A2', '/tiː/', 'Tea with milk?'),
      ('bread', 'pain', 'A2', '/bred/', 'The bread is fresh.'),
      ('cheese', 'fromage', 'A2', '/tʃiːz/', 'I love French cheese.'),
      ('apple', 'pomme', 'A2', '/ˈæpl/', 'An apple a day.'),
      ('orange', 'orange', 'A2', '/ˈɒrɪndʒ/', 'I drink orange juice.'),
      ('chicken', 'poulet', 'A2', '/ˈtʃɪkɪn/', 'Chicken with rice.'),
      ('fish', 'poisson', 'A2', '/fɪʃ/', 'I eat fish on Fridays.'),
      ('beach', 'plage', 'A2', '/biːtʃ/', 'The beach is crowded.'),
      ('mountain', 'montagne', 'A2', '/ˈmaʊntən/', 'I love the mountains.'),
      ('city', 'ville', 'A2', '/ˈsɪti/', 'London is a big city.'),
      ('country', 'pays', 'A2', '/ˈkʌntri/', 'I live in this country.'),
      ('travel', 'voyager', 'A2', '/ˈtrævl/', 'I love to travel.'),
      ('arrive', 'arriver', 'A2', '/əˈraɪv/', 'I arrive at 9 AM.'),
      ('leave', 'partir', 'A2', '/liːv/', 'We leave in 10 minutes.'),
      ('learn', 'apprendre', 'A2', '/lɜːn/', 'I learn English daily.'),
      ('teach', 'enseigner', 'A2', '/tiːtʃ/', 'She teaches Spanish.'),
      ('think', 'penser', 'A2', '/θɪŋk/', 'I think it is good.'),
      ('know', 'savoir', 'A2', '/nəʊ/', 'I know the answer.'),
      ('understand', 'comprendre', 'A2', '/ˌʌndəˈstænd/', 'I understand French.'),
      ('remember', 'se souvenir', 'A2', '/rɪˈmembə/', 'Do you remember her?'),
      ('forget', 'oublier', 'A2', '/fəˈɡet/', 'Don''t forget your keys.'),
      ('start', 'commencer', 'A2', '/stɑːt/', 'Class starts at 9.'),
      ('finish', 'finir', 'A2', '/ˈfɪnɪʃ/', 'I finish work at 5.'),
      ('open', 'ouvrir', 'A2', '/ˈəʊpən/', 'Open the window, please.'),
      ('close', 'fermer', 'A2', '/kləʊz/', 'Close the door.'),
      ('buy', 'acheter', 'A2', '/baɪ/', 'I buy bread every day.'),
      ('sell', 'vendre', 'A2', '/sel/', 'They sell fresh vegetables.'),
      ('pay', 'payer', 'A2', '/peɪ/', 'I pay with card.'),
      ('cost', 'coûter', 'A2', '/kɒst/', 'How much does it cost?'),
      ('cheap', 'bon marché', 'A2', '/tʃiːp/', 'This is cheap.'),
      ('expensive', 'cher', 'A2', '/ɪkˈspensɪv/', 'That car is expensive.'),
      ('weather', 'météo', 'A2', '/ˈweðə/', 'The weather is nice.'),
      ('rain', 'pluie', 'A2', '/reɪn/', 'It is raining.'),
      ('sun', 'soleil', 'A2', '/sʌn/', 'The sun is shining.'),
      ('snow', 'neige', 'A2', '/snəʊ/', 'It snows in winter.'),
      ('cold', 'froid', 'A2', '/kəʊld/', 'It is cold today.'),
      ('hot', 'chaud', 'A2', '/hɒt/', 'The coffee is hot.')
    ) as t(lemma, gloss_fr, cefr_min, ipa, example)
  loop
    -- Skip si déjà existant (par lemma EN)
    if not exists (
      select 1 from public.translations
      where lang_code = 'en-GB' and lemma = v_record.lemma
    ) then
      v_id := gen_random_uuid();
      insert into public.concepts (id, cefr_min, gloss_fr, image_url)
        values (v_id, v_record.cefr_min::cefr_level, v_record.gloss_fr, null);
      insert into public.translations (concept_id, lang_code, lemma, ipa, audio_url, example)
        values (v_id, 'en-GB', v_record.lemma, v_record.ipa, null, v_record.example);
    end if;
  end loop;
end $$;

-- Compte final pour info (visible dans les logs Supabase)
do $$
begin
  raise notice 'Seed v3.15 done. Total concepts A1: %, A2: %',
    (select count(*) from public.concepts where cefr_min = 'A1'),
    (select count(*) from public.concepts where cefr_min = 'A2');
end $$;
