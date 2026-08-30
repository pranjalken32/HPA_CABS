-- Daily revenue-slab incentives, replacing the weekly target rule.
--
-- Old rule: a week paid `incentive_base + steps` once the week's revenue passed
-- `incentive_target / 4`. New rule: each day pays the incentive of the highest
-- revenue slab that day's revenue reaches, e.g. 3000 -> 100, 3500 -> 200,
-- 4000 -> 400, 4500 -> 650. Slabs are per driver so the schedule can change
-- without a code change, and `daily_incentive_from` keeps settled history on the
-- old rule (days before that date are still scored weekly).
--
-- A manual entry in driver_daily_incentives overrides the computed amount for
-- that driver and day, so a one-off can be paid or a bad day zeroed.
--
-- Safe to re-run.

alter table driver_profiles
  add column if not exists daily_incentive_from text,
  add column if not exists daily_incentive_slabs jsonb not null default '[]'::jsonb;

alter table driver_profiles
  drop constraint if exists driver_profiles_daily_incentive_from_valid;

alter table driver_profiles
  add constraint driver_profiles_daily_incentive_from_valid
    check (daily_incentive_from is null or daily_incentive_from ~ '^\d{4}-\d{2}-\d{2}$');

-- Slab shape: [{"revenue": 3000, "incentive": 100}, ...]. A check constraint
-- cannot walk the array, so validate on write.
create or replace function public.validate_daily_incentive_slabs()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  slab jsonb;
begin
  if jsonb_typeof(new.daily_incentive_slabs) <> 'array' then
    raise exception 'daily_incentive_slabs must be a JSON array';
  end if;

  for slab in select value from jsonb_array_elements(new.daily_incentive_slabs)
  loop
    if jsonb_typeof(slab) <> 'object'
       or jsonb_typeof(slab -> 'revenue') <> 'number'
       or jsonb_typeof(slab -> 'incentive') <> 'number' then
      raise exception 'Each incentive slab needs numeric revenue and incentive values';
    end if;
    if (slab ->> 'revenue')::numeric < 0 or (slab ->> 'incentive')::numeric < 0 then
      raise exception 'Incentive slab values cannot be negative';
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists trg_validate_daily_incentive_slabs on driver_profiles;
create trigger trg_validate_daily_incentive_slabs
  before insert or update of daily_incentive_slabs on driver_profiles
  for each row execute function public.validate_daily_incentive_slabs();

create table if not exists driver_daily_incentives (
  id bigserial primary key,
  driver_profile_id bigint not null references driver_profiles(id) on delete cascade,
  date text not null,
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

alter table driver_daily_incentives
  drop constraint if exists driver_daily_incentives_valid;

alter table driver_daily_incentives
  add constraint driver_daily_incentives_valid
    check (date ~ '^\d{4}-\d{2}-\d{2}$' and amount >= 0);

create unique index if not exists idx_driver_daily_incentives_unique
  on driver_daily_incentives(driver_profile_id, date);

create index if not exists idx_driver_daily_incentives_date
  on driver_daily_incentives(date);

alter table driver_daily_incentives enable row level security;

do $$
declare
  p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'driver_daily_incentives'
  loop
    execute format('drop policy %I on public.driver_daily_incentives', p.policyname);
  end loop;
end $$;

create policy "read driver_daily_incentives" on driver_daily_incentives
  for select to authenticated
  using (is_owner() or driver_profile_id = my_driver_profile_id());

create policy "owner writes driver_daily_incentives" on driver_daily_incentives
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- Agreed schedule, effective 2026-08-14 (the rule was agreed on the 13th).
update driver_profiles
set daily_incentive_from = '2026-08-14',
    daily_incentive_slabs = '[
      {"revenue": 3000, "incentive": 100},
      {"revenue": 3500, "incentive": 200},
      {"revenue": 4000, "incentive": 400},
      {"revenue": 4500, "incentive": 650}
    ]'::jsonb
where daily_incentive_from is null;
