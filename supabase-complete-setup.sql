-- ============================================
-- HPA Cabs – COMPLETE Supabase Setup
-- Run this ONCE in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new
-- ============================================

-- ========== STEP 1: Core Tables ==========

-- 1. Incomes
create table if not exists incomes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  date text not null,
  platform text not null,
  amount numeric not null,
  trips integer not null default 0,
  note text not null default '',
  car_id bigint,
  created_at timestamptz default now()
);

alter table incomes enable row level security;
drop policy if exists "Authenticated users can read incomes" on incomes;
create policy "Authenticated users can read incomes" on incomes for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert incomes" on incomes;
create policy "Authenticated users can insert incomes" on incomes for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update incomes" on incomes;
create policy "Authenticated users can update incomes" on incomes for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete incomes" on incomes;
create policy "Authenticated users can delete incomes" on incomes for delete using (auth.role() = 'authenticated');

-- 2. Expenses
create table if not exists expenses (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  date text not null,
  category text not null,
  amount numeric not null,
  note text not null default '',
  recurring boolean not null default false,
  car_id bigint,
  receipt_url text,
  created_at timestamptz default now()
);

alter table expenses enable row level security;
drop policy if exists "Authenticated users can read expenses" on expenses;
create policy "Authenticated users can read expenses" on expenses for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert expenses" on expenses;
create policy "Authenticated users can insert expenses" on expenses for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update expenses" on expenses;
create policy "Authenticated users can update expenses" on expenses for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete expenses" on expenses;
create policy "Authenticated users can delete expenses" on expenses for delete using (auth.role() = 'authenticated');

-- 3. Cars
create table if not exists cars (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  number text not null,
  total_cost numeric not null default 0,
  created_at timestamptz default now()
);

alter table cars enable row level security;
drop policy if exists "Authenticated users can read cars" on cars;
create policy "Authenticated users can read cars" on cars for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert cars" on cars;
create policy "Authenticated users can insert cars" on cars for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update cars" on cars;
create policy "Authenticated users can update cars" on cars for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete cars" on cars;
create policy "Authenticated users can delete cars" on cars for delete using (auth.role() = 'authenticated');

-- 4. Car Documents
create table if not exists car_documents (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  car_id bigint references cars(id) on delete cascade not null,
  doc_type text not null,
  expiry_date text not null,
  note text not null default '',
  created_at timestamptz default now()
);

alter table car_documents enable row level security;
drop policy if exists "Authenticated users can read car_documents" on car_documents;
create policy "Authenticated users can read car_documents" on car_documents for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert car_documents" on car_documents;
create policy "Authenticated users can insert car_documents" on car_documents for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update car_documents" on car_documents;
create policy "Authenticated users can update car_documents" on car_documents for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete car_documents" on car_documents;
create policy "Authenticated users can delete car_documents" on car_documents for delete using (auth.role() = 'authenticated');

-- 5. Service Records
create table if not exists service_records (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  car_id bigint references cars(id) on delete cascade not null,
  date text not null,
  description text not null,
  cost numeric not null default 0,
  odometer_km numeric not null default 0,
  created_at timestamptz default now()
);

alter table service_records enable row level security;
drop policy if exists "Authenticated users can read service_records" on service_records;
create policy "Authenticated users can read service_records" on service_records for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert service_records" on service_records;
create policy "Authenticated users can insert service_records" on service_records for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update service_records" on service_records;
create policy "Authenticated users can update service_records" on service_records for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete service_records" on service_records;
create policy "Authenticated users can delete service_records" on service_records for delete using (auth.role() = 'authenticated');

-- ========== STEP 2: Profiles (user names + roles) ==========

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'owner',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
drop policy if exists "Authenticated users can read profiles" on profiles;
create policy "Authenticated users can read profiles" on profiles for select using (auth.role() = 'authenticated');

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    ),
    'owner'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for existing users
insert into profiles (id, display_name, role)
select id, split_part(email, '@', 1), 'owner'
from auth.users
where id not in (select id from profiles)
on conflict (id) do nothing;

-- Add role column if profiles table already existed without it
alter table profiles add column if not exists role text not null default 'owner';

-- ========== STEP 3: Feature Tables ==========

-- Fuel Logs (CNG/Fuel efficiency tracking)
create table if not exists fuel_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  car_id bigint references cars(id) on delete cascade not null,
  date text not null,
  quantity_kg numeric not null,
  price_per_kg numeric not null,
  total_cost numeric not null,
  odometer_km numeric not null,
  created_at timestamptz default now()
);

alter table fuel_logs enable row level security;
drop policy if exists "Authenticated users can read fuel_logs" on fuel_logs;
create policy "Authenticated users can read fuel_logs" on fuel_logs for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert fuel_logs" on fuel_logs;
create policy "Authenticated users can insert fuel_logs" on fuel_logs for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update fuel_logs" on fuel_logs;
create policy "Authenticated users can update fuel_logs" on fuel_logs for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete fuel_logs" on fuel_logs;
create policy "Authenticated users can delete fuel_logs" on fuel_logs for delete using (auth.role() = 'authenticated');
create index if not exists idx_fuel_logs_car on fuel_logs(car_id, date);

-- Link auto-created expenses to their source records
alter table expenses add column if not exists fuel_log_id bigint
  references fuel_logs(id) on delete cascade;
alter table expenses add column if not exists service_record_id bigint
  references service_records(id) on delete cascade;
create unique index if not exists idx_expenses_fuel_log_unique
  on expenses(fuel_log_id) where fuel_log_id is not null;
create unique index if not exists idx_expenses_service_record_unique
  on expenses(service_record_id) where service_record_id is not null;

-- Goals (monthly revenue targets)
create table if not exists goals (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  month text not null,
  target_revenue numeric not null,
  created_at timestamptz default now(),
  unique(month)
);

alter table goals enable row level security;
drop policy if exists "Authenticated users can read goals" on goals;
create policy "Authenticated users can read goals" on goals for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert goals" on goals;
create policy "Authenticated users can insert goals" on goals for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update goals" on goals;
create policy "Authenticated users can update goals" on goals for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete goals" on goals;
create policy "Authenticated users can delete goals" on goals for delete using (auth.role() = 'authenticated');

-- Receipt storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload receipts" on storage.objects;
create policy "Authenticated users can upload receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
drop policy if exists "Authenticated users can view receipts" on storage.objects;
create policy "Authenticated users can view receipts" on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete receipts" on storage.objects;
create policy "Authenticated users can delete receipts" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- Add receipt_url to expenses (if not already there)
alter table expenses add column if not exists receipt_url text;

-- ========== DONE ==========
-- Now go to Authentication → Users → Add user to create accounts.
-- Set role to 'driver' for driver accounts:
--   UPDATE profiles SET role = 'driver' WHERE display_name = 'driver_name';
