-- ============================================
-- HPA Cabs – New Feature Tables
-- Run this after supabase-setup.sql and supabase-profiles.sql
-- ============================================

-- 1. Fuel Logs (CNG/Fuel efficiency tracking)
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

-- 2. Goals (monthly revenue targets)
create table if not exists goals (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  month text not null,
  target_revenue numeric not null,
  created_at timestamptz default now(),
  unique(month)
);

alter table goals enable row level security;

-- 3. Receipt storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- 4. Add receipt_url column to expenses
alter table expenses add column if not exists receipt_url text;
