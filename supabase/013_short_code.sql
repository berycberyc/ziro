-- Migration: add a short, QR-friendly code to registrations, generated
-- automatically on insert. Used for the pass QR and the answer sheet QR
-- instead of the long UUID id — much less data for the camera to decode.

alter table registrations add column if not exists short_code text unique;

create or replace function generate_short_code() returns text as $$
declare
  chars text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- no 0/O/1/I/L to avoid confusion
  result text;
  attempt int := 0;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from registrations where short_code = result);
    attempt := attempt + 1;
    exit when attempt > 20; -- safety valve, astronomically unlikely to hit
  end loop;
  return result;
end;
$$ language plpgsql;

create or replace function set_registration_short_code() returns trigger as $$
begin
  if new.short_code is null then
    new.short_code := generate_short_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_registration_short_code on registrations;
create trigger trg_set_registration_short_code
  before insert on registrations
  for each row execute function set_registration_short_code();

-- Backfill any existing rows that don't have one yet.
update registrations set short_code = generate_short_code() where short_code is null;
