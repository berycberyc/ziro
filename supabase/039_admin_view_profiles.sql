-- Migration: admin's Оплата contact popup fetches a parent's profile
-- (full_name/phone/email) by id, but profiles only ever had a
-- "users can view own profile" policy — no admin bypass, so RLS
-- silently returned zero rows for any parent that wasn't the admin
-- themselves. Add the missing admin-select policy.
-- Run in Supabase SQL Editor after 038_payment_receipts.sql

create policy "Admins can view all profiles" on profiles
  for select using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
