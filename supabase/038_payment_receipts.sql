-- Migration: manual Kaspi-QR + receipt-upload payment flow.
-- Parent scans a static Kaspi QR, pays manually, then uploads a photo of
-- the receipt on their booking; admin reviews it in Оплата and confirms
-- payment the same way as before (the "Растау" button already built).
-- Run in Supabase SQL Editor after 037_admin_insert_students.sql

alter table registrations add column if not exists receipt_url text;

-- Storage bucket for receipt photos (separate from student photos/question
-- images so permissions can be scoped independently).
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Parents can upload a receipt for their OWN registration only. Path
-- convention: {registration_id}/{filename}, matched against a
-- registration the parent actually owns.
create policy "Parents can upload own receipts" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and exists (
      select 1 from registrations r
      where r.id::text = (storage.foldername(name))[1]
        and r.parent_id = auth.uid()
    )
  );

-- Anyone can read a receipt image once it exists (bucket is public, so
-- this just documents intent — the public flag already allows read).
create policy "Anyone can view receipts" on storage.objects
  for select using (bucket_id = 'receipts');

-- Parents can update receipt_url on their own registrations (to attach
-- the uploaded file's URL after upload succeeds).
create policy "Parents can attach receipt to own registration" on registrations
  for update using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);
