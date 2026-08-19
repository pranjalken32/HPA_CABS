-- ============================================
-- HPA Cabs – Link fuel logs / service records to their expense row
-- Run ONCE in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new
--
-- Before this migration the app matched a fuel log to its auto-created
-- expense by (category, date, amount, car_id). Any edit to either side
-- broke the match, so deleting a log left an orphan expense (and deleting
-- the expense left the log in the car's fuel log). These columns make the
-- relationship explicit, and the cascade removes the expense with the log.
-- ============================================

alter table expenses add column if not exists fuel_log_id bigint
  references fuel_logs(id) on delete cascade;
alter table expenses add column if not exists service_record_id bigint
  references service_records(id) on delete cascade;

-- One expense per fuel log / service record.
create unique index if not exists idx_expenses_fuel_log_unique
  on expenses(fuel_log_id) where fuel_log_id is not null;
create unique index if not exists idx_expenses_service_record_unique
  on expenses(service_record_id) where service_record_id is not null;

-- ---- Backfill existing rows ----
-- Historical pairs can differ slightly because either side was edited
-- (rounding, e.g. 630.49 vs 630.50, or a date corrected in History), so
-- allow a small tolerance and pick the closest candidate per log.
with candidates as (
  select f.id as fuel_log_id,
         e.id as expense_id,
         abs(e.amount - f.total_cost) as amt_diff,
         abs(e.date::date - f.date::date) as day_diff
  from fuel_logs f
  join expenses e
    on e.category = 'fuel'
   and e.car_id = f.car_id
   and e.fuel_log_id is null
   and abs(e.amount - f.total_cost) <= 0.05
   and abs(e.date::date - f.date::date) <= 2
),
ranked as (
  select distinct on (fuel_log_id) fuel_log_id, expense_id
  from candidates
  order by fuel_log_id, amt_diff, day_diff, expense_id
)
update expenses e
   set fuel_log_id = r.fuel_log_id
  from ranked r
 where e.id = r.expense_id;

with candidates as (
  select s.id as service_record_id,
         e.id as expense_id,
         abs(e.amount - s.cost) as amt_diff,
         abs(e.date::date - s.date::date) as day_diff
  from service_records s
  join expenses e
    on e.category = 'service'
   and e.car_id = s.car_id
   and e.service_record_id is null
   and abs(e.amount - s.cost) <= 0.05
   and abs(e.date::date - s.date::date) <= 2
),
ranked as (
  select distinct on (service_record_id) service_record_id, expense_id
  from candidates
  order by service_record_id, amt_diff, day_diff, expense_id
)
update expenses e
   set service_record_id = r.service_record_id
  from ranked r
 where e.id = r.expense_id;

-- ---- Verify: both queries should return no rows ----
-- Fuel logs with no expense:
--   select f.* from fuel_logs f
--   where not exists (select 1 from expenses e where e.fuel_log_id = f.id)
--     and f.total_cost > 0;
-- Fuel expenses with no log:
--   select e.* from expenses e where e.category = 'fuel' and e.fuel_log_id is null;
