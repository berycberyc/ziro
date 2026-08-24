-- Migration: push notifications for new payment receipts, for the
-- admin's PWA install on Android.
-- Run in Supabase SQL Editor after 040_fix_admin_profiles_recursion.sql

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "Admins manage own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id and is_admin())
  with check (auth.uid() = user_id and is_admin());

-- pg_net lets a Postgres trigger make an outbound HTTP call — this is
-- what fires the actual push notification via our Next.js API route
-- whenever a receipt gets uploaded (or replaced).
create extension if not exists pg_net;

create or replace function notify_receipt_uploaded()
returns trigger as $$
begin
  if new.receipt_url is not null and (old.receipt_url is null or old.receipt_url <> new.receipt_url) then
    perform net.http_post(
      url := 'https://zirotest.com/api/push/notify-receipt',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('registrationId', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_receipt_uploaded on registrations;
create trigger on_receipt_uploaded
  after update on registrations
  for each row execute function notify_receipt_uploaded();
