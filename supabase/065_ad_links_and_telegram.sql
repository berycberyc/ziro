-- Migration: ата-ана қайдан келгенін есепке алу + Telegram хабарламалары.
--
-- 1) Жарнама сілтемелері (ad_links). Әкімші админкада атау жазады
--    («Шымкент баннер»), сайт оған UTM белгісі бар сілтеме мен QR-код
--    жасайды. Бұл кесте тек атау мен белгіні сақтайды.
--
-- 2) Ата-ана тіркелгенде profiles-қа жазылады:
--      utm_source, utm_medium, utm_campaign — қай сілтемемен келді
--      (сайт белгіні браузерде 30 күн сақтайды);
--      heard_from — «Бізді қайдан білдіңіз?» сұрағына өз жауабы.
--    Бұрын тіркелгендерде бұл бағандар бос қалады.
--
-- 3) Жаңа брондау жасалғанда база сайтқа хабар береді
--    (/api/notify/booking), сайт Telegram-ға жазады. Түбіртек туралы
--    хабарлама бұрынғы триггер арқылы жүреді (041), оған Telegram
--    кодтың ішінде қосылды. Чаттар тізімі — telegram_chats кестесі.
--
-- Run in Supabase SQL Editor after 064_accountant_role.sql,
-- BEFORE deploying the matching code.

begin;

-- ---------------------------------------------------------------
-- 1. Жарнама сілтемелері.
-- ---------------------------------------------------------------
create table if not exists ad_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null,
  campaign text not null unique,
  created_at timestamptz not null default now()
);

alter table ad_links enable row level security;

drop policy if exists "Admins manage ad links" on ad_links;
create policy "Admins manage ad links" on ad_links
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------
-- 2. Ата-ана қайдан келді.
-- ---------------------------------------------------------------
alter table profiles add column if not exists utm_source text;
alter table profiles add column if not exists utm_medium text;
alter table profiles add column if not exists utm_campaign text;
alter table profiles add column if not exists heard_from text;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, full_name, first_name, last_name, phone, email, role,
    utm_source, utm_medium, utm_campaign, heard_from
  )
  values (
    new.id,
    trim(concat(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name')),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    new.email,
    'parent',
    nullif(left(new.raw_user_meta_data->>'utm_source', 100), ''),
    nullif(left(new.raw_user_meta_data->>'utm_medium', 100), ''),
    nullif(left(new.raw_user_meta_data->>'utm_campaign', 100), ''),
    nullif(left(new.raw_user_meta_data->>'heard_from', 50), '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- ---------------------------------------------------------------
-- 3. Telegram хабарламалары қай чаттарға барады.
--    Ереже (policy) әдейі жоқ: бұл кестені сайттың сервері ғана
--    (service-role кілтімен) оқиды және жазады. Браузерден ешкім көрмейді.
-- ---------------------------------------------------------------
create table if not exists telegram_chats (
  chat_id text primary key,
  name text,
  created_at timestamptz not null default now()
);

alter table telegram_chats enable row level security;

-- ---------------------------------------------------------------
-- 4. Жаңа брондау → Telegram.
-- ---------------------------------------------------------------
create extension if not exists pg_net;

create or replace function notify_booking_created()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://zirotest.com/api/notify/booking',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('registrationId', new.id)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_booking_created on registrations;
create trigger on_booking_created
  after insert on registrations
  for each row execute function notify_booking_created();

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--
--   select column_name from information_schema.columns
--   where table_name = 'profiles' and column_name in
--     ('utm_source', 'utm_medium', 'utm_campaign', 'heard_from');
--
-- Төрт жол шығуы керек.
--
--   select tgname from pg_trigger where tgname = 'on_booking_created';
--
-- Бір жол шығуы керек.
-- ---------------------------------------------------------------
