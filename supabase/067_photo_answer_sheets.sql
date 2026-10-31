-- Жауап парағын телефон камерасымен түсіріп оқу (ZipGrade-тің орнына).
-- Жауаптар answer_sheets кестесіне бұрынғыдай жазылады, тек көзі жаңа:
-- 'photo'. Басқа ештеңе өзгермейді.

begin;

alter table answer_sheets drop constraint if exists answer_sheets_source_check;
alter table answer_sheets add constraint answer_sheets_source_check
  check (source in ('online', 'zipgrade', 'manual', 'photo'));

comment on column answer_sheets.source is
  'online — браузерде тапсырған; zipgrade — ZipGrade сканерінен; manual — қолмен енгізілген (РФМШ); photo — біздің бланкті камерамен түсіру.';

commit;
