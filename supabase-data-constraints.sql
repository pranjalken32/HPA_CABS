-- Data-integrity constraints for HPA Cabs
--
-- Dates are stored as text in this schema, so nothing stopped an empty string, a
-- malformed value or an impossible calendar date (2026-02-31) from being written, and
-- nothing stopped a zero/negative amount. The app now validates both, and these
-- constraints make the database the backstop.
--
-- Verified before applying: every existing row in every table below already passes.
-- Safe to re-run.

-- true only for a real ISO calendar date, e.g. rejects '2026-02-31' and '2026-13-01'
create or replace function public.is_iso_date(value text)
returns boolean
language plpgsql
immutable
as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  perform value::date;
  return true;
exception when others then
  return false;
end $$;

-- true only for a valid 'YYYY-MM' month
create or replace function public.is_iso_month(value text)
returns boolean
language plpgsql
immutable
as $$
begin
  if value is null or value !~ '^\d{4}-\d{2}$' then
    return false;
  end if;
  perform (value || '-01')::date;
  return true;
exception when others then
  return false;
end $$;

alter table incomes
  drop constraint if exists incomes_date_valid,
  drop constraint if exists incomes_amount_positive,
  drop constraint if exists incomes_trips_nonnegative;
alter table incomes
  add constraint incomes_date_valid check (is_iso_date(date)),
  add constraint incomes_amount_positive check (amount > 0),
  add constraint incomes_trips_nonnegative check (trips is null or trips >= 0);

alter table expenses
  drop constraint if exists expenses_date_valid,
  drop constraint if exists expenses_amount_positive;
alter table expenses
  add constraint expenses_date_valid check (is_iso_date(date)),
  add constraint expenses_amount_positive check (amount > 0);

alter table fuel_logs
  drop constraint if exists fuel_logs_date_valid,
  drop constraint if exists fuel_logs_cost_positive,
  drop constraint if exists fuel_logs_odometer_nonnegative;
alter table fuel_logs
  add constraint fuel_logs_date_valid check (is_iso_date(date)),
  add constraint fuel_logs_cost_positive check (total_cost > 0),
  add constraint fuel_logs_odometer_nonnegative check (odometer_km is null or odometer_km >= 0);

alter table service_records
  drop constraint if exists service_records_date_valid,
  drop constraint if exists service_records_cost_positive;
alter table service_records
  add constraint service_records_date_valid check (is_iso_date(date)),
  add constraint service_records_cost_positive check (cost > 0);

alter table car_documents
  drop constraint if exists car_documents_expiry_valid;
alter table car_documents
  add constraint car_documents_expiry_valid check (is_iso_date(expiry_date));

alter table driver_profiles
  drop constraint if exists driver_profiles_dates_valid,
  drop constraint if exists driver_profiles_salary_positive,
  drop constraint if exists driver_profiles_period_ordered;
alter table driver_profiles
  add constraint driver_profiles_dates_valid
    check (is_iso_date(start_date) and (end_date is null or is_iso_date(end_date))),
  add constraint driver_profiles_salary_positive check (monthly_salary > 0),
  add constraint driver_profiles_period_ordered
    check (end_date is null or end_date >= start_date);

alter table driver_settlements
  drop constraint if exists driver_settlements_dates_valid,
  drop constraint if exists driver_settlements_amount_nonnegative;
alter table driver_settlements
  add constraint driver_settlements_dates_valid
    check (is_iso_month(month) and is_iso_date(settled_date)),
  add constraint driver_settlements_amount_nonnegative check (amount >= 0);

alter table goals
  drop constraint if exists goals_month_valid,
  drop constraint if exists goals_target_positive;
alter table goals
  add constraint goals_month_valid check (is_iso_month(month)),
  add constraint goals_target_positive check (target_revenue > 0);

-- one settlement per driver per month
create unique index if not exists idx_driver_settlements_unique
  on driver_settlements(driver_profile_id, month);

-- date-range scans are the app's most common query shape
create index if not exists idx_incomes_date on incomes(date);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_fuel_logs_car_date on fuel_logs(car_id, date);
