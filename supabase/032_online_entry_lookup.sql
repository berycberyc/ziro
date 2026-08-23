-- Migration: public online-test entry lookup. Rather than opening a broad
-- public SELECT policy on `registrations` (which would leak other parents'
-- booking data), this is a narrow security-definer function that only
-- returns a registration id when the booking number + student code match,
-- and only for paid online bookings.
-- Run in Supabase SQL Editor after 031_results.sql

create or replace function lookup_online_entry(p_short_code text, p_zipgrade_id text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select r.id
  from registrations r
  join students s on s.id = r.student_id
  where r.short_code = p_short_code
    and s.zipgrade_id = p_zipgrade_id
    and r.format = 'online'
    and r.payment_status = 'paid'
  limit 1;
$$;

grant execute on function lookup_online_entry(text, text) to anon, authenticated;
