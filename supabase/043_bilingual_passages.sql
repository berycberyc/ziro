-- Migration: reading passages (currently only used bilingually by
-- БИЛ-оқылым — Тілдер already handles language via separate subject
-- keys tilder_kk/tilder_ru/tilder_en) only had ONE text field, so every
-- БИЛ-оқылым passage only existed in whichever single language the
-- admin typed it in — unlike questions, which already have text_kk +
-- text_ru on the same row. This brings passages in line with that.
-- Run in Supabase SQL Editor after 042_editable_oferta.sql

alter table passages rename column passage_text to passage_text_kk;
alter table passages add column if not exists passage_text_ru text not null default '';
