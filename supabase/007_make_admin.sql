-- Run this in Supabase SQL Editor to make yourself an admin.
-- Replace the email below with the one you registered with.

update profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
