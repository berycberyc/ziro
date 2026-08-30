-- ЖОЙМАЙДЫ, тек КӨРСЕТЕДІ. Қоймада жатқан, бірақ ешқайда сілтелмейтін
-- файлдарды табады. SQL Editor-де орындап, тізімді көзбен қарап шығыңыз.
--
-- Неге пайда болған: жүйе файлды әрқашан жаңа атпен жүктейтін, ал ескісін
-- ешкім өшірмейтін. Бір нұсқаны бес рет қайта жүктесе — суреттердің бес
-- жинағы жиналған, оның төртеуі керексіз. Код түзетілді, енді жаңа қоқыс
-- жиналмайды; бұл сұрау — бұрыннан қалғанын көру үшін.

-- ---------------------------------------------------------------
-- 1. Қанша орын алынған — қысқаша қорытынды
-- ---------------------------------------------------------------
select
  o.bucket_id                                            as қойма,
  count(*)                                               as файл_саны,
  pg_size_pretty(sum((o.metadata->>'size')::bigint))     as көлемі
from storage.objects o
group by o.bucket_id
order by sum((o.metadata->>'size')::bigint) desc nulls last;


-- ---------------------------------------------------------------
-- 2. Сұрақтардың суреттері: қайсысы ешқайда сілтелмейді
-- ---------------------------------------------------------------
select
  o.name                                        as файл,
  pg_size_pretty((o.metadata->>'size')::bigint) as көлемі,
  o.created_at                                  as жүктелген_күні
from storage.objects o
where o.bucket_id = 'question-images'
  and not exists (
    select 1 from questions q
    where q.image_url like '%' || o.name
       or q.image_url_ru like '%' || o.name
  )
order by o.created_at;


-- ---------------------------------------------------------------
-- 3. Басып шығару PDF-тері: қайсысы ешқайда сілтелмейді
-- ---------------------------------------------------------------
select
  o.name                                        as файл,
  pg_size_pretty((o.metadata->>'size')::bigint) as көлемі,
  o.created_at                                  as жүктелген_күні
from storage.objects o
where o.bucket_id = 'print-files'
  and not exists (
    select 1 from print_files p where p.file_url like '%' || o.name
  )
order by o.created_at;


-- ---------------------------------------------------------------
-- 4. Түбіртектер: қайсысы ешқайда сілтелмейді
-- ---------------------------------------------------------------
select
  o.name                                        as файл,
  pg_size_pretty((o.metadata->>'size')::bigint) as көлемі,
  o.created_at                                  as жүктелген_күні
from storage.objects o
where o.bucket_id = 'receipts'
  and not exists (
    select 1 from registrations r
    where r.receipt_url = o.name or r.receipt_url like '%' || o.name
  )
order by o.created_at;


-- ---------------------------------------------------------------
-- 5. ӨШІРУ — тізімді қарап шыққаннан КЕЙІН ғана
-- ---------------------------------------------------------------
-- Ескерту: бұл қайтарылмайды. Алдымен жоғарыдағы тізімдерді қарап,
-- ішінде керек файл жоқ екеніне көз жеткізіңіз. Күмән болса — қалдырыңыз,
-- орын аз ғана.
--
-- Бір қоймадан бастаңыз, мысалы суреттерден:
--
--   delete from storage.objects o
--   where o.bucket_id = 'question-images'
--     and not exists (
--       select 1 from questions q
--       where q.image_url like '%' || o.name
--          or q.image_url_ru like '%' || o.name
--     );
--
-- Түбіртектерді өшірместен бұрын екі рет ойланыңыз: төлем дауы шықса,
-- олар дәлел бола алады.
