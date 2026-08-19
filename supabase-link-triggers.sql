-- ============================================
-- Fuel / service <-> expense linkage enforced in the database.
--
-- Client code already creates the linked expense, but a stale cached bundle,
-- a failed second request or a manual insert can leave a fuel log without its
-- expense (or a duplicate expense). These triggers make the linkage a property
-- of the database instead of the client:
--   * every fuel log / service record gets exactly one linked expense
--   * an unlinked expense that matches an unlinked record is adopted
--   * a second expense for an already-linked record is silently skipped
--   * amount / date / note edits propagate both ways
--   * deleting either side removes the other
--   * CNG odometer readings must stay ordered by date
--
-- Safe to run more than once.
-- ============================================

-- ---------- helpers ----------

create or replace function public.fuel_expense_note(
  fuel_type text,
  quantity_kg numeric,
  price_per_kg numeric,
  total_cost numeric
) returns text
language sql
immutable
set search_path = public
as $$
  select case when fuel_type = 'petrol'
    then 'Petrol ₹' || trim_scale(total_cost)::text
    else trim_scale(quantity_kg)::text || 'kg CNG @ ₹' || trim_scale(price_per_kg)::text || '/kg'
  end;
$$;

-- ---------- fuel log -> expense ----------

create or replace function public.fuel_log_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adopted_id bigint;
begin
  if new.total_cost is null or new.total_cost <= 0 then
    return null;
  end if;

  if exists (select 1 from expenses where fuel_log_id = new.id) then
    return null;
  end if;

  -- Adopt an expense the client already wrote without the link.
  update expenses set fuel_log_id = new.id
  where id = (
    select e.id from expenses e
    where e.fuel_log_id is null
      and e.category = 'fuel'
      and e.car_id = new.car_id
      and e.date = new.date
      and e.amount = new.total_cost
    order by e.id
    limit 1
  )
  returning id into adopted_id;
  if adopted_id is not null then
    return null;
  end if;

  insert into expenses (
    date, category, amount, note, recurring, car_id, receipt_url,
    fuel_log_id, service_record_id, user_id
  ) values (
    new.date, 'fuel', new.total_cost,
    fuel_expense_note(new.fuel_type, new.quantity_kg, new.price_per_kg, new.total_cost),
    false, new.car_id, null, new.id, null, new.user_id
  );
  return null;
end $$;

create or replace function public.fuel_log_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update expenses e
  set date = new.date,
      amount = new.total_cost,
      note = fuel_expense_note(new.fuel_type, new.quantity_kg, new.price_per_kg, new.total_cost)
  where e.fuel_log_id = new.id
    and (e.date <> new.date or e.amount <> new.total_cost);
  return null;
end $$;

-- ---------- service record -> expense ----------

create or replace function public.service_record_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  adopted_id bigint;
begin
  if new.cost is null or new.cost <= 0 then
    return null;
  end if;

  if exists (select 1 from expenses where service_record_id = new.id) then
    return null;
  end if;

  update expenses set service_record_id = new.id
  where id = (
    select e.id from expenses e
    where e.service_record_id is null
      and e.category = 'service'
      and e.car_id = new.car_id
      and e.date = new.date
      and e.amount = new.cost
    order by e.id
    limit 1
  )
  returning id into adopted_id;
  if adopted_id is not null then
    return null;
  end if;

  insert into expenses (
    date, category, amount, note, recurring, car_id, receipt_url,
    fuel_log_id, service_record_id, user_id
  ) values (
    new.date, 'service', new.cost, new.description,
    false, new.car_id, null, null, new.id, new.user_id
  );
  return null;
end $$;

create or replace function public.service_record_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update expenses e
  set date = new.date, amount = new.cost, note = new.description
  where e.service_record_id = new.id
    and (e.date <> new.date or e.amount <> new.cost or coalesce(e.note,'') <> coalesce(new.description,''));
  return null;
end $$;

-- ---------- expense side ----------

create or replace function public.expense_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate bigint;
begin
  if new.fuel_log_id is not null then
    -- Second expense for the same fuel log: drop it instead of failing the save.
    if exists (select 1 from expenses where fuel_log_id = new.fuel_log_id) then
      return null;
    end if;
    return new;
  end if;

  if new.service_record_id is not null then
    if exists (select 1 from expenses where service_record_id = new.service_record_id) then
      return null;
    end if;
    return new;
  end if;

  if new.category = 'fuel' then
    select f.id into candidate
    from fuel_logs f
    where f.car_id = new.car_id
      and f.date = new.date
      and f.total_cost = new.amount
      and not exists (select 1 from expenses e where e.fuel_log_id = f.id)
    order by f.id
    limit 1;
    if candidate is not null then
      new.fuel_log_id := candidate;
      return new;
    end if;
    -- The matching log already has its expense, so this is a duplicate write.
    if exists (
      select 1 from fuel_logs f
      where f.car_id = new.car_id and f.date = new.date and f.total_cost = new.amount
    ) then
      return null;
    end if;
  end if;

  if new.category = 'service' then
    select s.id into candidate
    from service_records s
    where s.car_id = new.car_id
      and s.date = new.date
      and s.cost = new.amount
      and not exists (select 1 from expenses e where e.service_record_id = s.id)
    order by s.id
    limit 1;
    if candidate is not null then
      new.service_record_id := candidate;
      return new;
    end if;
    if exists (
      select 1 from service_records s
      where s.car_id = new.car_id and s.date = new.date and s.cost = new.amount
    ) then
      return null;
    end if;
  end if;

  return new;
end $$;

create or replace function public.expense_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fuel_log_id is not null then
    update fuel_logs f
    set date = new.date,
        total_cost = new.amount,
        quantity_kg = case
          when f.fuel_type <> 'petrol' and f.price_per_kg > 0
            then round(new.amount / f.price_per_kg, 2)
          else f.quantity_kg
        end
    where f.id = new.fuel_log_id
      and (f.date <> new.date or f.total_cost <> new.amount);
  end if;

  if new.service_record_id is not null then
    update service_records s
    set date = new.date, cost = new.amount
    where s.id = new.service_record_id
      and (s.date <> new.date or s.cost <> new.amount);
  end if;

  return null;
end $$;

create or replace function public.expense_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The reverse foreign keys cascade, so the row being deleted is already gone.
  if old.fuel_log_id is not null then
    delete from fuel_logs where id = old.fuel_log_id;
  end if;
  if old.service_record_id is not null then
    delete from service_records where id = old.service_record_id;
  end if;
  return null;
end $$;

-- ---------- odometer ordering ----------

create or replace function public.fuel_log_check_odometer()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  previous numeric;
  following numeric;
begin
  if new.fuel_type = 'petrol' or new.odometer_km is null or new.odometer_km <= 0 then
    return new;
  end if;

  select max(odometer_km) into previous
  from fuel_logs
  where car_id = new.car_id and fuel_type <> 'petrol'
    and odometer_km > 0 and date < new.date and id <> new.id;

  select min(odometer_km) into following
  from fuel_logs
  where car_id = new.car_id and fuel_type <> 'petrol'
    and odometer_km > 0 and date > new.date and id <> new.id;

  if previous is not null and new.odometer_km <= previous then
    raise exception
      'Odometer % is not higher than % recorded before %',
      new.odometer_km, previous, new.date;
  end if;
  if following is not null and new.odometer_km >= following then
    raise exception
      'Odometer % is not lower than % recorded after %',
      new.odometer_km, following, new.date;
  end if;

  return new;
end $$;

-- ---------- triggers ----------

drop trigger if exists trg_fuel_log_after_insert on fuel_logs;
create trigger trg_fuel_log_after_insert
  after insert on fuel_logs
  for each row execute function fuel_log_after_insert();

drop trigger if exists trg_fuel_log_after_update on fuel_logs;
create trigger trg_fuel_log_after_update
  after update on fuel_logs
  for each row execute function fuel_log_after_update();

drop trigger if exists trg_fuel_log_check_odometer on fuel_logs;
create trigger trg_fuel_log_check_odometer
  before insert or update on fuel_logs
  for each row execute function fuel_log_check_odometer();

drop trigger if exists trg_service_record_after_insert on service_records;
create trigger trg_service_record_after_insert
  after insert on service_records
  for each row execute function service_record_after_insert();

drop trigger if exists trg_service_record_after_update on service_records;
create trigger trg_service_record_after_update
  after update on service_records
  for each row execute function service_record_after_update();

drop trigger if exists trg_expense_before_insert on expenses;
create trigger trg_expense_before_insert
  before insert on expenses
  for each row execute function expense_before_insert();

drop trigger if exists trg_expense_after_update on expenses;
create trigger trg_expense_after_update
  after update on expenses
  for each row execute function expense_after_update();

drop trigger if exists trg_expense_after_delete on expenses;
create trigger trg_expense_after_delete
  after delete on expenses
  for each row execute function expense_after_delete();
