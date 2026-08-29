-- Migration: payment receipts stop being publicly readable.
--
-- Why: the 'receipts' bucket was created public in 038, which means every
-- uploaded receipt is a file sitting on the open internet. The path holds a
-- random registration id, so nobody is going to guess it — but a Kaspi
-- receipt shows the payer's full name and part of their phone number, and
-- "hard to guess" is not the same as "protected". A link forwarded once,
-- pasted into a chat, or picked up by anything crawling is public forever.
--
-- After this migration the bucket is closed. Files are reached only through
-- short-lived signed links that the app asks for at the moment of viewing:
--   - the admin, for any receipt (payment confirmation screen);
--   - the parent, for their own receipt only.
--
-- Storage layout is unchanged: {registration_id}/{timestamp}.{ext}, so the
-- first folder of every object name says which registration it belongs to.
-- That is what both policies check.
--
-- IMPORTANT — receipt_url changes meaning. It used to hold a full public
-- URL; those URLs stop working the moment the bucket closes. So old rows
-- are rewritten to hold the storage PATH instead, and from now on the app
-- stores paths and signs them on demand. Deploy the matching code together
-- with this migration: old code + new bucket = admin sees broken images.
-- Run in Supabase SQL Editor after 056_student_language_in_test.sql

begin;

-- ---------------------------------------------------------------
-- 1. Close the bucket.
-- ---------------------------------------------------------------
update storage.buckets set public = false where id = 'receipts';

-- ---------------------------------------------------------------
-- 2. Replace "anyone can read" with two narrow rules.
-- ---------------------------------------------------------------
drop policy if exists "Anyone can view receipts" on storage.objects;

create policy "Admins can view receipts" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Parents can view own receipts" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and exists (
      select 1 from registrations r
      where r.id::text = (storage.foldername(name))[1]
        and r.parent_id = auth.uid()
    )
  );

-- Replacing a receipt overwrites the object (upload uses upsert), which
-- counts as an update, not an insert. Without this a re-upload to an
-- existing path would fail.
drop policy if exists "Parents can replace own receipts" on storage.objects;
create policy "Parents can replace own receipts" on storage.objects
  for update using (
    bucket_id = 'receipts'
    and exists (
      select 1 from registrations r
      where r.id::text = (storage.foldername(name))[1]
        and r.parent_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- 3. Rewrite existing rows: full public URL -> storage path.
--    ".../object/public/receipts/<id>/<file>"  ->  "<id>/<file>"
--    Rows that already hold a bare path are left alone, so running this
--    twice does no harm.
-- ---------------------------------------------------------------
update registrations
set receipt_url = split_part(receipt_url, '/receipts/', 2)
where receipt_url is not null
  and receipt_url like '%/receipts/%';

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--
--   select id, receipt_url from registrations
--   where receipt_url is not null limit 20;
--
-- Барлығы "<брондау id>/<файл аты>" түрінде болуы керек — "https://..."
-- қалмауы тиіс.
--
--   select id, public from storage.buckets where id = 'receipts';
--
-- public = false болуы керек.
-- ---------------------------------------------------------------
