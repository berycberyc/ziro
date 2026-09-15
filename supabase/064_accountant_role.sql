-- Migration: «Бухгалтер» рөлі.
--
-- Бухгалтер «Оплата» бетінде әкімші істей алатынның бәрін істейді
-- (растау, растауды қайтару, түбіртекті ашу, ата-ана байланысын көру,
-- хабарландыру қосу) және сессиялар тізімін тек көреді. Админканың қалған
-- бөлімдері оған жабық — бұл тек интерфейсте емес, базада да: бухгалтерге
-- басқа кестелерге рұқсат берілмейді.
--
-- Сонымен қатар әр брондауда төлемді КІМ және ҚАШАН растағаны сақталады.
-- Оны қолдан жазу мүмкін емес: триггер өзі қояды.
--
-- Жолай екі тесік жабылады:
--   1) кез келген тіркелген адам браузер консолінен өз рөлін 'admin' етіп
--      өзгерте алатын (profiles-та «өз профилін өзгерту» ережесі барлық
--      бағанға рұқсат береді). Енді рөл тек SQL Editor арқылы өзгереді.
--   2) ата-ана мен мұғалім өз брондауының payment_status бағанын өзгерте
--      алатын. Енді төлем мәртебесін тек әкімші мен бухгалтер өзгертеді.
--
-- Run in Supabase SQL Editor after 062_manual_answer_sheets.sql,
-- BEFORE deploying the matching code.

begin;

-- ---------------------------------------------------------------
-- 1. Жаңа рөл: 'accountant'.
--    schema.sql-дегі тексеру тек parent/teacher/admin рұқсат береді.
--    Шектеудің аты қолмен берілмеген, сондықтан оны тауып өшіреміз.
-- ---------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%parent%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('parent', 'teacher', 'admin', 'accountant'));

-- ---------------------------------------------------------------
-- 2. Рөлді тексеретін функциялар (is_admin() сияқты, 040-ты қараңыз:
--    security definer — profiles ережесінің өз-өзіне айналып кетпеуі үшін).
-- ---------------------------------------------------------------
create or replace function is_accountant()
returns boolean as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'accountant'
  );
$$ language sql security definer stable set search_path = public;

create or replace function is_payment_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'accountant')
  );
$$ language sql security definer stable set search_path = public;

-- ---------------------------------------------------------------
-- 3. Рөлді тек SQL Editor арқылы өзгертуге болады.
--    SQL Editor-да auth.uid() бос — сондықтан ол жерден өтеді,
--    ал сайттан (кім кірсе де) өзгерту қабылданбайды.
-- ---------------------------------------------------------------
create or replace function guard_profile_role()
returns trigger as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Рөлді сайттан өзгертуге болмайды';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_guard_profile_role on profiles;
create trigger trg_guard_profile_role
  before update on profiles
  for each row execute function guard_profile_role();

-- ---------------------------------------------------------------
-- 4. Кім және қашан растады.
--    Сыртқы кілт (foreign key) әдейі жоқ: registrations-та profiles-қа
--    бір сілтеме бар (parent_id), екіншісі пайда болса, болашақта
--    registrations → profiles біріктірілген сұраулары қатеге түседі.
-- ---------------------------------------------------------------
alter table registrations add column if not exists payment_confirmed_by uuid;
alter table registrations add column if not exists payment_confirmed_at timestamptz;

create or replace function guard_payment_fields()
returns trigger as $$
declare
  staff boolean := is_payment_staff();
  from_site boolean := auth.uid() is not null;
begin
  if tg_op = 'INSERT' then
    if new.payment_status = 'paid' then
      if from_site and not staff then
        raise exception 'Төлемді тек әкімші немесе бухгалтер растай алады';
      end if;
      new.payment_confirmed_by := auth.uid();
      new.payment_confirmed_at := now();
    else
      new.payment_confirmed_by := null;
      new.payment_confirmed_at := null;
    end if;
    return new;
  end if;

  -- UPDATE

  -- Бухгалтер (әкімші емес) тек төлем мәртебесін өзгерте алады:
  -- аудитория, орын, нұсқа және т.б. — жоқ.
  if from_site and is_accountant() and not is_admin() then
    if (to_jsonb(new) - 'payment_status' - 'payment_confirmed_by' - 'payment_confirmed_at')
       is distinct from
       (to_jsonb(old) - 'payment_status' - 'payment_confirmed_by' - 'payment_confirmed_at')
    then
      raise exception 'Бухгалтер тек төлем мәртебесін өзгерте алады';
    end if;
  end if;

  if new.payment_status is distinct from old.payment_status then
    if from_site and not staff then
      raise exception 'Төлемді тек әкімші немесе бухгалтер растай алады';
    end if;
    if new.payment_status = 'paid' then
      new.payment_confirmed_by := auth.uid();
      new.payment_confirmed_at := now();
    else
      new.payment_confirmed_by := null;
      new.payment_confirmed_at := null;
    end if;
  else
    -- Мәртебе өзгермесе, «кім растады» да өзгермейді — қолдан жазуға болмайды.
    new.payment_confirmed_by := old.payment_confirmed_by;
    new.payment_confirmed_at := old.payment_confirmed_at;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_guard_payment_fields on registrations;
create trigger trg_guard_payment_fields
  before insert or update on registrations
  for each row execute function guard_payment_fields();

-- ---------------------------------------------------------------
-- 5. Бухгалтерге «Оплата» беті үшін керек рұқсаттар.
--    Ережесіз RLS қате бермейді, бос тізім береді — сондықтан бәрі
--    осы жерде, бет қолданатын әр кесте үшін.
--    test_sessions, test_types, session_test_types — оқу бәріне ашық (008).
-- ---------------------------------------------------------------
drop policy if exists "Accountants can view all registrations" on registrations;
create policy "Accountants can view all registrations" on registrations
  for select using (is_accountant());

drop policy if exists "Accountants can update registrations" on registrations;
create policy "Accountants can update registrations" on registrations
  for update using (is_accountant()) with check (is_accountant());

drop policy if exists "Accountants can view all students" on students;
create policy "Accountants can view all students" on students
  for select using (is_accountant());

-- Ата-ананың байланысы және растаушының аты.
drop policy if exists "Accountants can view all profiles" on profiles;
create policy "Accountants can view all profiles" on profiles
  for select using (is_accountant());

-- Түбіртектер (жабық қойма, 057).
drop policy if exists "Accountants can view receipts" on storage.objects;
create policy "Accountants can view receipts" on storage.objects
  for select using (bucket_id = 'receipts' and is_accountant());

-- Жаңа түбіртек туралы хабарландыру.
drop policy if exists "Accountants manage own push subscriptions" on push_subscriptions;
create policy "Accountants manage own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id and is_accountant())
  with check (auth.uid() = user_id and is_accountant());

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profiles'::regclass and contype = 'c';
--
-- Тізімде 'accountant' болуы керек.
--
--   select column_name from information_schema.columns
--   where table_name = 'registrations' and column_name like 'payment_confirmed%';
--
-- Екі жол: payment_confirmed_by, payment_confirmed_at.
-- ---------------------------------------------------------------
