-- ============================================
-- HPA Cabs – COMPLETE Supabase Setup
-- Run this ONCE in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new
-- ============================================
-- This file creates tables and storage only. Do not add blanket
-- auth.role() = 'authenticated' policies here. After this setup, apply
-- supabase-rls-roles.sql and supabase-data-constraints.sql.

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

-- ========== STEP 2: Profiles (user names + roles) ==========

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'owner',
  created_at timestamptz default now()
);

alter table profiles enable row level security;

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

-- Receipt storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- Add receipt_url to expenses (if not already there)
alter table expenses add column if not exists receipt_url text;

-- ========== DONE ==========
-- Now go to Authentication → Users → Add user to create accounts.
-- Set role to 'driver' for driver accounts:
--   UPDATE profiles SET role = 'driver' WHERE display_name = 'driver_name';
-- Then apply supabase-rls-roles.sql and supabase-data-constraints.sql.
