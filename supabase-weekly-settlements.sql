-- Weekly driver settlements.
-- Adds an explicit settlement period to driver_settlements so a settlement can
-- cover a Monday-to-Sunday week as well as a calendar month, and prevents a
-- driver's periods from overlapping (so a week can never be paid twice, nor a
-- week and the month containing it).
-- Safe to re-run.

alter table driver_settlements
  add column if not exists period_type text not null default 'month',
  add column if not exists period_start text,
  add column if not exists period_end text;

update driver_settlements
set period_start = month || '-01',
    period_end = to_char(
      ((month || '-01')::date + interval '1 month' - interval '1 day')::date,
      'YYYY-MM-DD'
    )
where period_start is null or period_end is null;

alter table driver_settlements
  alter column period_start set not null,
  alter column period_end set not null;

alter table driver_settlements
  drop constraint if exists driver_settlements_period_type_valid,
  drop constraint if exists driver_settlements_period_range_valid;

alter table driver_settlements
  add constraint driver_settlements_period_type_valid
    check (period_type in ('month', 'week')),
  add constraint driver_settlements_period_range_valid
    check (
      period_start ~ '^\d{4}-\d{2}-\d{2}$'
      and period_end ~ '^\d{4}-\d{2}-\d{2}$'
      and period_start <= period_end
    );

-- The month-only uniqueness rule cannot express weekly rows.
drop index if exists idx_driver_settlements_unique;

create unique index if not exists idx_driver_settlements_period_unique
  on driver_settlements(driver_profile_id, period_type, period_start);

create or replace function public.driver_settlement_no_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  clash_start text;
  clash_end text;
begin
  if new.driver_profile_id is null then
    return new;
  end if;

  select s.period_start, s.period_end into clash_start, clash_end
  from driver_settlements s
  where s.driver_profile_id = new.driver_profile_id
    and s.id <> coalesce(new.id, -1)
    and s.period_start <= new.period_end
    and s.period_end >= new.period_start
  order by s.period_start
  limit 1;

  if clash_start is not null then
    raise exception
      'Settlement % to % overlaps the settlement already recorded for % to %',
      new.period_start, new.period_end, clash_start, clash_end;
  end if;

  return new;
end $$;

drop trigger if exists trg_driver_settlement_no_overlap on driver_settlements;
create trigger trg_driver_settlement_no_overlap
  before insert or update on driver_settlements
  for each row execute function driver_settlement_no_overlap();
