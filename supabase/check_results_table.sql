-- Diagnostic only — run this first to see what columns "results" actually has
select column_name, data_type
from information_schema.columns
where table_name = 'results'
order by ordinal_position;
