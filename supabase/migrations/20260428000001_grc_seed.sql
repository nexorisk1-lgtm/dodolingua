-- =============================================================
--  Seed contenus GRC — anglais UK, 4 niveaux
--  Contenus originaux. Aucun emprunt à des sources protégées.
--  Confidentiel — PI Raïssa
-- =============================================================

-- ---------- Junior (200 termes prévus, 30 ici en seed initial) ----------
do $$
declare c uuid;
  termes text[][] := array[
    ['risk','/rɪsk/','risque'],
    ['control','/kənˈtrəʊl/','contrôle'],
    ['compliance','/kəmˈplaɪəns/','conformité'],
    ['audit','/ˈɔːdɪt/','audit'],
    ['audit trail','/ˈɔːdɪt treɪl/','piste d''audit'],
    ['know your customer','/nəʊ jɔː ˈkʌstəmə/','connaissance client (KYC)'],
    ['anti-money laundering','/ˌæntiˈmʌni ˈlɔːndərɪŋ/','lutte anti-blanchiment (AML)'],
    ['escalation','/ˌeskəˈleɪʃn/','escalade'],
    ['incident report','/ˈɪnsɪdənt rɪˈpɔːt/','rapport d''incident'],
    ['policy','/ˈpɒləsi/','politique'],
    ['procedure','/prəˈsiːdʒə/','procédure'],
    ['evidence','/ˈevɪdəns/','preuve'],
    ['documentation','/ˌdɒkjʊmenˈteɪʃn/','documentation'],
    ['exception','/ɪkˈsepʃn/','exception'],
    ['breach','/briːtʃ/','manquement'],
    ['mitigation','/ˌmɪtɪˈɡeɪʃn/','atténuation'],
    ['threshold','/ˈθreʃhəʊld/','seuil'],
    ['materiality','/məˌtɪəriˈæləti/','matérialité'],
    ['root cause','/ruːt kɔːz/','cause racine'],
    ['remediation','/rɪˌmiːdiˈeɪʃn/','remédiation'],
    ['fraud','/frɔːd/','fraude'],
    ['suspicious activity','/səˈspɪʃəs ækˈtɪvəti/','activité suspecte'],
    ['whistleblower','/ˈwɪslbləʊə/','lanceur d''alerte'],
    ['conflict of interest','/ˈkɒnflɪkt əv ˈɪntrəst/','conflit d''intérêts'],
    ['segregation of duties','/ˌseɡrɪˈɡeɪʃn əv ˈdjuːtiz/','séparation des tâches'],
    ['four-eyes principle','/fɔːr aɪz ˈprɪnsəpl/','principe des quatre yeux'],
    ['raci','/ˈreɪsi/','RACI'],
    ['stakeholder','/ˈsteɪkˌhəʊldə/','partie prenante'],
    ['inherent risk','/ɪnˈhɪərənt rɪsk/','risque inhérent'],
    ['residual risk','/rɪˈzɪdʒʊəl rɪsk/','risque résiduel']
  ];
  i int;
begin
  for i in 1..array_length(termes, 1) loop
    insert into public.concepts (domain, cefr_min, tags)
    values ('grc_junior', 'B1', array['grc','junior'])
    returning id into c;
    insert into public.translations (concept_id, lang_code, lemma, ipa)
    values (c, 'en-GB', termes[i][1], termes[i][2]);
  end loop;
end $$;

-- ---------- Confirmé (sample) ----------
do $$
declare c uuid;
  termes text[][] := array[
    ['risk appetite','/rɪsk ˈæpɪtaɪt/','appétence au risque'],
    ['key risk indicator','/kiː rɪsk ˈɪndɪkeɪtə/','indicateur clé de risque (KRI)'],
    ['key control indicator','/kiː kənˈtrəʊl ˈɪndɪkeɪtə/','indicateur clé de contrôle (KCI)'],
    ['risk register','/rɪsk ˈredʒɪstə/','cartographie des risques'],
    ['action plan','/ˈækʃn plæn/','plan d''action'],
    ['root cause analysis','/ruːt kɔːz əˈnæləsɪs/','analyse de cause racine'],
    ['risk matrix','/rɪsk ˈmeɪtrɪks/','matrice des risques'],
    ['risk taxonomy','/rɪsk tækˈsɒnəmi/','taxonomie des risques'],
    ['heatmap','/ˈhiːtmæp/','heatmap'],
    ['operational risk','/ˌɒpəˈreɪʃnəl rɪsk/','risque opérationnel'],
    ['top-down review','/tɒp daʊn rɪˈvjuː/','revue descendante'],
    ['bottom-up assessment','/ˈbɒtəm ʌp əˈsesmənt/','évaluation ascendante'],
    ['risk owner','/rɪsk ˈəʊnə/','propriétaire du risque'],
    ['control owner','/kənˈtrəʊl ˈəʊnə/','propriétaire du contrôle'],
    ['issue tracking','/ˈɪʃuː ˈtrækɪŋ/','suivi des écarts']
  ];
  i int;
begin
  for i in 1..array_length(termes, 1) loop
    insert into public.concepts (domain, cefr_min, tags)
    values ('grc_confirme', 'B2', array['grc','confirme'])
    returning id into c;
    insert into public.translations (concept_id, lang_code, lemma, ipa)
    values (c, 'en-GB', termes[i][1], termes[i][2]);
  end loop;
end $$;

-- ---------- Senior (sample) ----------
do $$
declare c uuid;
  termes text[][] := array[
    ['three lines of defense','/θriː laɪnz əv dɪˈfens/','les trois lignes de défense'],
    ['regulatory expectations','/ˌreɡjʊˈleɪtri ɪkspekˈteɪʃnz/','attentes réglementaires'],
    ['supervisory dialogue','/ˌsuːpəˈvaɪzəri ˈdaɪəlɒɡ/','dialogue prudentiel'],
    ['governance framework','/ˈɡʌvənəns ˈfreɪmwɜːk/','dispositif de gouvernance'],
    ['internal capital adequacy','/ɪnˈtɜːnl ˈkæpɪtl ˈædɪkwəsi/','adéquation des fonds propres'],
    ['risk appetite statement','/rɪsk ˈæpɪtaɪt ˈsteɪtmənt/','déclaration d''appétence au risque'],
    ['board oversight','/bɔːd ˈəʊvəsaɪt/','supervision du conseil'],
    ['regulatory letter','/ˌreɡjʊˈleɪtri ˈletə/','lettre de suite régulateur'],
    ['on-site review','/ɒn saɪt rɪˈvjuː/','revue sur place'],
    ['audit findings','/ˈɔːdɪt ˈfaɪndɪŋz/','constats d''audit'],
    ['closing meeting','/ˈkləʊzɪŋ ˈmiːtɪŋ/','réunion de clôture'],
    ['executive summary','/ɪɡˈzekjʊtɪv ˈsʌməri/','résumé exécutif']
  ];
  i int;
begin
  for i in 1..array_length(termes, 1) loop
    insert into public.concepts (domain, cefr_min, tags)
    values ('grc_senior', 'C1', array['grc','senior'])
    returning id into c;
    insert into public.translations (concept_id, lang_code, lemma, ipa)
    values (c, 'en-GB', termes[i][1], termes[i][2]);
  end loop;
end $$;

-- ---------- Expert (sample) ----------
do $$
declare c uuid;
  termes text[][] := array[
    ['stress testing','/stres ˈtestɪŋ/','tests de résistance'],
    ['capital adequacy','/ˈkæpɪtl ˈædɪkwəsi/','adéquation des fonds propres'],
    ['recovery and resolution','/rɪˈkʌvəri ənd ˌrezəˈluːʃn/','redressement et résolution'],
    ['operational resilience','/ˌɒpəˈreɪʃnəl rɪˈzɪliəns/','résilience opérationnelle'],
    ['systemic risk','/sɪˈstemɪk rɪsk/','risque systémique'],
    ['model risk','/ˈmɒdl rɪsk/','risque de modèle'],
    ['conduct risk','/ˈkɒndʌkt rɪsk/','risque de conduite'],
    ['icaap','/ˈaɪkæp/','ICAAP'],
    ['ilaap','/ˈaɪlæp/','ILAAP'],
    ['srep','/srep/','SREP'],
    ['recovery plan','/rɪˈkʌvəri plæn/','plan de redressement'],
    ['resolution plan','/ˌrezəˈluːʃn plæn/','plan de résolution']
  ];
  i int;
begin
  for i in 1..array_length(termes, 1) loop
    insert into public.concepts (domain, cefr_min, tags)
    values ('grc_expert', 'C2', array['grc','expert'])
    returning id into c;
    insert into public.translations (concept_id, lang_code, lemma, ipa)
    values (c, 'en-GB', termes[i][1], termes[i][2]);
  end loop;
end $$;

-- ---------- Quelques scénarios GRC ----------
insert into public.scenarios (title, category, cefr, grc_level, steps_json) values
  ('Internal audit kickoff meeting', 'grc', 'B2', 'junior',
   '[{"step":1,"prompt":"Welcome the auditor. Introduce yourself."},
     {"step":2,"prompt":"Walk through the scope of the audit."},
     {"step":3,"prompt":"Agree on the documentation needed."}]'::jsonb),
  ('Risk committee — top risks presentation', 'grc', 'C1', 'senior',
   '[{"step":1,"prompt":"Present the top 3 emerging risks."},
     {"step":2,"prompt":"Defend your remediation plan."},
     {"step":3,"prompt":"Answer board challenge."}]'::jsonb),
  ('On-site supervisory review opening', 'grc', 'C2', 'expert',
   '[{"step":1,"prompt":"Open the meeting with the supervisor."},
     {"step":2,"prompt":"Walk through governance arrangements."},
     {"step":3,"prompt":"Address regulatory observations."}]'::jsonb)
on conflict do nothing;
