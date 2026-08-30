-- Migration: the shared topic list for the four maths-based subjects.
--
-- Why: topics are what turn a score into advice. A parent who sees "1120 out
-- of 1500" learns nothing; a parent who sees "Проценты — 40%, Окружность —
-- 90%" knows what to work on next. That breakdown is the thing that sets
-- Ziro apart from the sites that just hand back a number, so the list has to
-- exist before questions are uploaded, not after.
--
-- Where the list came from: 89 past papers (НИШ, БИЛ, РФМШ, сандық — about
-- 866 000 characters) were scanned for what actually appears. Every topic
-- below is in that material; nothing was invented to round out the list.
--
-- One finding worth naming: БИЛ and РФМШ lean heavily on questions that are
-- not arithmetic at all — painted cubes, nets, rotations, symmetry, "which
-- figure replaces the question mark", what weekday falls 345 days from now.
-- Left mixed in with algebra they would tell a parent nothing, so they are
-- separated out as «Кеңістіктік ойлау» and «Логика және комбинаторика».
--
-- The same 21 topics go to all four subjects. They are deliberately broad —
-- «Бөлшектер», not three separate fraction topics — so the breakdown reads
-- easily and picking a topic during upload stays quick. Unused ones simply
-- never get chosen; that costs nothing, whereas a missing topic blocks an
-- upload outright.
--
-- Наименования должны совпадать буква в букву с тем, что стоит в [Тақырып]
-- при загрузке: импорт ищет тему по name_kk, без учёта регистра и пробелов
-- по краям, но в остальном — точное совпадение.
--
-- Reading (оқылым) topics for БИЛ, plus Тілдер and Жаратылыстану, are not
-- here: the source files held no reading material, and guessing those would
-- produce a list detached from the real papers. They come in a later
-- migration once the material exists.
-- Run in Supabase SQL Editor after 057_private_receipts.sql

begin;

with topic_list(name_kk, name_ru) as (
  values
    -- Сандар және есептеулер
    ('Натурал сандар және бөлінгіштік', 'Натуральные числа и делимость'),
    ('Бөлшектер',                       'Дроби'),
    ('Пайыз',                           'Проценты'),
    ('Қатынас, пропорция, масштаб',     'Отношение, пропорция, масштаб'),
    ('Сан өрнектері және амалдар реті', 'Числовые выражения и порядок действий'),
    ('Теңдеулер мен теңсіздіктер',      'Уравнения и неравенства'),

    -- Мәтіндік есептер
    ('Қозғалыс есептері',               'Задачи на движение'),
    ('Жұмыс және өнімділік',            'Работа и производительность'),
    ('Қоспа, ерітінді, концентрация',   'Смеси, растворы, концентрация'),
    ('Ақша, баға, жеңілдік',            'Деньги, цены, скидки'),
    ('Мәтіндік логикалық есептер',      'Текстовые логические задачи'),

    -- Геометрия
    ('Периметр және аудан',             'Периметр и площадь'),
    ('Көлем және бет ауданы',           'Объём и площадь поверхности'),
    ('Бұрыштар және үшбұрыштар',        'Углы и треугольники'),
    ('Шеңбер және дөңгелек',            'Окружность и круг'),
    ('Координаталық жазықтық және симметрия', 'Координатная плоскость и симметрия'),

    -- Ойлау және деректер
    ('Кеңістіктік ойлау',               'Пространственное мышление'),
    ('Заңдылықтар және тізбектер',      'Закономерности и последовательности'),
    ('Логика және комбинаторика',       'Логика и комбинаторика'),
    ('Кестелер, диаграммалар, орта мән','Таблицы, диаграммы, среднее значение'),
    ('Уақыт, күнтізбе, өлшем бірліктері','Время, календарь, единицы измерения')
),
subject_list(subject) as (
  values ('math'), ('sandyq'), ('bil'), ('rfmsh')
)
insert into topics (subject, name_kk, name_ru)
select s.subject, t.name_kk, t.name_ru
from subject_list s
cross join topic_list t
-- Уникальность по (subject, name_kk): повторный запуск ничего не сломает
-- и не создаст дублей.
on conflict (subject, name_kk) do nothing;

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--
--   select subject, count(*) from topics group by subject order by subject;
--
-- math, sandyq, bil, rfmsh — әрқайсысында 21 тақырып болуы керек
-- (бұрыннан тақырып болса, саны көбірек шығады).
--
--   select name_kk, name_ru from topics where subject = 'math' order by name_kk;
--
-- Атауларды көзбен қарап шығыңыз: [Тақырып] жолында дәл осылай жазылуы тиіс.
-- ---------------------------------------------------------------
