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

create policy "Authenticated users can read fuel_logs"
  on fuel_logs for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert fuel_logs"
  on fuel_logs for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update fuel_logs"
  on fuel_logs for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete fuel_logs"
  on fuel_logs for delete using (auth.role() = 'authenticated');

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

create policy "Authenticated users can read goals"
  on goals for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert goals"
  on goals for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update goals"
  on goals for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete goals"
  on goals for delete using (auth.role() = 'authenticated');

-- 3. Receipt storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Authenticated users can upload receipts"
  on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Authenticated users can view receipts"
  on storage.objects for select
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

create policy "Authenticated users can delete receipts"
  on storage.objects for delete
  using (bucket_id = 'receipts' and auth.role() = 'authenticated');

-- 4. Add receipt_url column to expenses
alter table expenses add column if not exists receipt_url text;
