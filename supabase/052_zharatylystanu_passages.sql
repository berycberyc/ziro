-- Migration: Жаратылыстану can have reading passages too.
--
-- Real example from the user: one passage about a wind power station in the
-- Жетісу gate region, then three questions about it — classify the energy
-- source, compute daily output, name the ecological advantage. Structurally
-- identical to БИЛ-оқылым, so it uses the same machinery.
--
-- Only the CHECK constraint stood in the way; the passages table itself
-- already supports everything needed. Математика, сандық and РФМШ stay
-- without passages — confirmed with the user.
-- Run in Supabase SQL Editor after 051_published_results.sql

begin;

alter table passages drop constraint if exists passages_subject_check;
alter table passages add constraint passages_subject_check
  check (subject in ('tilder', 'bil', 'zharatylystanu'));

commit;
