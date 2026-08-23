-- Run this first to SEE the duplicate registrations for that student+session
-- (not a migration — just a lookup query).
select r.id, r.student_id, s.full_name as student_name, r.test_session_id,
       tt.name_kk as test_type, r.format, r.payment_status, r.created_at
from registrations r
join students s on s.id = r.student_id
left join test_types tt on tt.id = r.test_type_id
where r.student_id = '67c1d2c0-6ec8-47ca-9d97-c464e8404640'
  and r.test_session_id = '96d3bac9-97df-4e30-8aad-b955d95eabc8'
order by r.created_at;
