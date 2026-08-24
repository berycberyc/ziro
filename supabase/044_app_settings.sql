-- Migration: make the Kaspi QR image + payment link editable from the admin
-- panel instead of being a file in the repo (public/kaspi-qr.png) and a URL
-- hardcoded in app/dashboard/bookings/page.tsx. Changing either used to
-- require a code edit and a redeploy.
-- Run in Supabase SQL Editor after 043_bilingual_passages.sql

-- Generic key/value store for small site-wide settings. Kept deliberately
-- simple so future settings (contacts, banners, etc.) can reuse it.
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Parents need to read the QR/link while paying, so reads are public.
-- The values here are not secrets — the QR is meant to be shown publicly.
create policy "Anyone can view app settings" on app_settings
  for select using (true);

-- Writes only for the admin, via the security-definer is_admin() helper
-- (added in 040). Never subquery profiles directly inside a policy.
create policy "Admins can edit app settings" on app_settings
  for all using (is_admin())
  with check (is_admin());

-- Seed with the values currently hardcoded in the code, so nothing
-- disappears the moment this migration runs.
insert into app_settings (key, value)
values
  ('kaspi_qr_url', '/kaspi-qr.png'),
  ('kaspi_pay_link', 'https://qr.kaspi.kz/1199806411750970251502354288835494391255'),
  -- Shown to parents as a fallback when the QR is deleted. Taken from the
  -- contact details already published in the oferta.
  ('contact_phone', '+7 778 884 23 24')
on conflict (key) do nothing;

-- Public bucket for admin-managed site assets (currently just the Kaspi QR).
-- Separate from receipts/student-photos so permissions stay scoped.
insert into storage.buckets (id, name, public)
values ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Only the admin uploads/replaces/deletes these files.
create policy "Admins can upload app assets" on storage.objects
  for insert with check (bucket_id = 'app-assets' and is_admin());

create policy "Admins can update app assets" on storage.objects
  for update using (bucket_id = 'app-assets' and is_admin())
  with check (bucket_id = 'app-assets' and is_admin());

create policy "Admins can delete app assets" on storage.objects
  for delete using (bucket_id = 'app-assets' and is_admin());

-- Everyone can read them (the bucket is public; this documents intent).
create policy "Anyone can view app assets" on storage.objects
  for select using (bucket_id = 'app-assets');
