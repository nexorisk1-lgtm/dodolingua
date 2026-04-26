-- =============================================================
--  Image support optionnel + admin
--  Confidentiel — PI Raïssa — v1.1
-- =============================================================

-- ---------- Profile : flag admin ----------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------- Concepts : enrichir image ----------
alter table public.concepts
  add column if not exists image_alt text,
  add column if not exists image_attribution text,
  add column if not exists image_uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists image_uploaded_at timestamptz;

create index if not exists idx_concepts_has_image
  on public.concepts((image_url is not null));

-- ---------- Storage bucket pour images concepts ----------
-- (À créer manuellement aussi via Storage UI si besoin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'concept-images',
  'concept-images',
  true,                                          -- lecture publique (URL signée non requise)
  2097152,                                       -- 2 MB max par image
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- Policies Storage ----------
-- Lecture publique (les utilisateurs et même non-connectés voient l'image via URL CDN)
drop policy if exists "Public read concept images" on storage.objects;
create policy "Public read concept images"
  on storage.objects for select
  using (bucket_id = 'concept-images');

-- Upload : admins uniquement
drop policy if exists "Admins upload concept images" on storage.objects;
create policy "Admins upload concept images"
  on storage.objects for insert
  with check (
    bucket_id = 'concept-images'
    and exists (select 1 from public.profiles
                where id = auth.uid() and is_admin = true)
  );

-- Update / delete : admins uniquement
drop policy if exists "Admins update concept images" on storage.objects;
create policy "Admins update concept images"
  on storage.objects for update
  using (
    bucket_id = 'concept-images'
    and exists (select 1 from public.profiles
                where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins delete concept images" on storage.objects;
create policy "Admins delete concept images"
  on storage.objects for delete
  using (
    bucket_id = 'concept-images'
    and exists (select 1 from public.profiles
                where id = auth.uid() and is_admin = true)
  );

-- ---------- RLS écriture concepts/translations/sentences/lessons : admins ----------
-- Lecture déjà ouverte aux authentifiés (cf. migration 002)

drop policy if exists "Admins write concepts" on public.concepts;
create policy "Admins write concepts"
  on public.concepts for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins write translations" on public.translations;
create policy "Admins write translations"
  on public.translations for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins write sentences" on public.sentences;
create policy "Admins write sentences"
  on public.sentences for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "Admins write lessons" on public.lessons;
create policy "Admins write lessons"
  on public.lessons for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ---------- Helper SQL : promouvoir un user admin ----------
-- À exécuter manuellement la 1ère fois pour Raïssa :
--   update public.profiles set is_admin = true where id = '<uuid raïssa>';
-- Ou via email :
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'nexorisk1@gmail.com');

-- ---------- View pratique : concepts avec leur image ----------
create or replace view public.v_concepts_with_image as
select
  c.id, c.domain, c.cefr_min, c.tags,
  c.image_url, c.image_alt, c.image_attribution,
  (c.image_url is not null) as has_image,
  c.created_at,
  count(t.id) as translation_count
from public.concepts c
left join public.translations t on t.concept_id = c.id
group by c.id;
