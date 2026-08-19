-- Role-based Row Level Security for HPA Cabs
--
-- Before this migration every policy was `auth.role() = 'authenticated'`, which let any
-- signed-in user (including drivers, using the public anon key) read and delete every
-- financial row. Owner/driver separation existed only in client-side routing.
--
-- After this migration:
--   owner  -> full read/write on everything
--   driver -> reads only their own driver profile, settlements and advances, plus the
--             car assigned to them and that car's income/fuel/service/document rows;
--             may insert fuel logs (and the linked fuel expense) for that car only.
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER so policies can read profiles/driver_profiles
-- without recursing through those tables' own policies.
-- ---------------------------------------------------------------------------

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.my_driver_profile_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id from public.driver_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_car_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select car_id from public.driver_profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

revoke all on function public.is_owner() from public;
revoke all on function public.my_driver_profile_id() from public;
revoke all on function public.my_car_id() from public;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_driver_profile_id() to authenticated;
grant execute on function public.my_car_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the blanket "authenticated" policies
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'cars', 'car_documents', 'incomes', 'expenses',
        'fuel_logs', 'service_records', 'goals', 'driver_profiles',
        'driver_settlements'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter table profiles enable row level security;
alter table cars enable row level security;
alter table car_documents enable row level security;
alter table incomes enable row level security;
alter table expenses enable row level security;
alter table fuel_logs enable row level security;
alter table service_records enable row level security;
alter table goals enable row level security;
alter table driver_profiles enable row level security;
alter table driver_settlements enable row level security;

-- ---------------------------------------------------------------------------
-- profiles: owners see everyone (History shows who entered a row), drivers see self
-- ---------------------------------------------------------------------------

create policy "read profiles" on profiles
  for select to authenticated
  using (is_owner() or id = auth.uid());

create policy "owner writes profiles" on profiles
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- driver_profiles: a driver sees only their own row
-- ---------------------------------------------------------------------------

create policy "read driver_profiles" on driver_profiles
  for select to authenticated
  using (is_owner() or auth_user_id = auth.uid());

create policy "owner writes driver_profiles" on driver_profiles
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- driver_settlements: a driver sees only their own settlements
-- ---------------------------------------------------------------------------

create policy "read driver_settlements" on driver_settlements
  for select to authenticated
  using (is_owner() or driver_profile_id = my_driver_profile_id());

create policy "owner writes driver_settlements" on driver_settlements
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- cars and their child records: a driver sees only the car assigned to them
-- ---------------------------------------------------------------------------

create policy "read cars" on cars
  for select to authenticated
  using (is_owner() or id = my_car_id());

create policy "owner writes cars" on cars
  for all to authenticated
  using (is_owner()) with check (is_owner());

create policy "read car_documents" on car_documents
  for select to authenticated
  using (is_owner() or car_id = my_car_id());

create policy "owner writes car_documents" on car_documents
  for all to authenticated
  using (is_owner()) with check (is_owner());

create policy "read service_records" on service_records
  for select to authenticated
  using (is_owner() or car_id = my_car_id());

create policy "owner writes service_records" on service_records
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- incomes: a driver sees their own car's revenue (needed for incentive display)
-- ---------------------------------------------------------------------------

create policy "read incomes" on incomes
  for select to authenticated
  using (is_owner() or car_id = my_car_id());

create policy "owner writes incomes" on incomes
  for all to authenticated
  using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- fuel_logs: a driver may read and add fills for the car assigned to them,
-- but may not edit or delete them
-- ---------------------------------------------------------------------------

create policy "read fuel_logs" on fuel_logs
  for select to authenticated
  using (is_owner() or car_id = my_car_id());

create policy "driver inserts fuel_logs" on fuel_logs
  for insert to authenticated
  with check (is_owner() or car_id = my_car_id());

create policy "owner updates fuel_logs" on fuel_logs
  for update to authenticated
  using (is_owner()) with check (is_owner());

create policy "owner deletes fuel_logs" on fuel_logs
  for delete to authenticated
  using (is_owner());

-- ---------------------------------------------------------------------------
-- expenses: a driver sees only their own advances/salary/incentive rows and the
-- fuel rows of their car — never EMI, commission or another driver's payments.
-- They may insert the fuel expense that accompanies a fuel log, nothing else.
-- ---------------------------------------------------------------------------

create policy "read expenses" on expenses
  for select to authenticated
  using (
    is_owner()
    or driver_profile_id = my_driver_profile_id()
    or (fuel_log_id is not null and car_id = my_car_id())
  );

create policy "driver inserts fuel expenses" on expenses
  for insert to authenticated
  with check (
    is_owner()
    or (
      category = 'fuel'
      and fuel_log_id is not null
      and car_id = my_car_id()
      and driver_profile_id is null
    )
  );

create policy "owner updates expenses" on expenses
  for update to authenticated
  using (is_owner()) with check (is_owner());

create policy "owner deletes expenses" on expenses
  for delete to authenticated
  using (is_owner());

-- ---------------------------------------------------------------------------
-- goals: owner only
-- ---------------------------------------------------------------------------

create policy "owner reads goals" on goals
  for select to authenticated
  using (is_owner());

create policy "owner writes goals" on goals
  for all to authenticated
  using (is_owner()) with check (is_owner());
