-- ============================================
-- HPA Cabs – Supabase Schema Setup
-- Run this in the Supabase SQL Editor once.
-- ============================================

-- Enable RLS on all tables
-- Auth is handled by Supabase Auth (email/password)

-- 1. Incomes
create table if not exists incomes (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date text not null,
  platform text not null,
  amount numeric not null,
  trips integer not null default 0,
  note text not null default '',
  car_id bigint,
  created_at timestamptz default now()
);

alter table incomes enable row level security;

create policy "Users see own incomes"
  on incomes for select using (auth.uid() = user_id);
create policy "Users insert own incomes"
  on incomes for insert with check (auth.uid() = user_id);
create policy "Users update own incomes"
  on incomes for update using (auth.uid() = user_id);
create policy "Users delete own incomes"
  on incomes for delete using (auth.uid() = user_id);

-- 2. Expenses
create table if not exists expenses (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date text not null,
  category text not null,
  amount numeric not null,
  note text not null default '',
  recurring boolean not null default false,
  car_id bigint,
  created_at timestamptz default now()
);

alter table expenses enable row level security;

create policy "Users see own expenses"
  on expenses for select using (auth.uid() = user_id);
create policy "Users insert own expenses"
  on expenses for insert with check (auth.uid() = user_id);
create policy "Users update own expenses"
  on expenses for update using (auth.uid() = user_id);
create policy "Users delete own expenses"
  on expenses for delete using (auth.uid() = user_id);

-- 3. Cars
create table if not exists cars (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  name text not null,
  number text not null,
  total_cost numeric not null default 0,
  created_at timestamptz default now()
);

alter table cars enable row level security;

create policy "Users see own cars"
  on cars for select using (auth.uid() = user_id);
create policy "Users insert own cars"
  on cars for insert with check (auth.uid() = user_id);
create policy "Users update own cars"
  on cars for update using (auth.uid() = user_id);
create policy "Users delete own cars"
  on cars for delete using (auth.uid() = user_id);

-- 4. Car Documents
create table if not exists car_documents (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  car_id bigint references cars(id) on delete cascade not null,
  doc_type text not null,
  expiry_date text not null,
  note text not null default '',
  created_at timestamptz default now()
);

alter table car_documents enable row level security;

create policy "Users see own car_documents"
  on car_documents for select using (auth.uid() = user_id);
create policy "Users insert own car_documents"
  on car_documents for insert with check (auth.uid() = user_id);
create policy "Users update own car_documents"
  on car_documents for update using (auth.uid() = user_id);
create policy "Users delete own car_documents"
  on car_documents for delete using (auth.uid() = user_id);

-- 5. Service Records
create table if not exists service_records (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  car_id bigint references cars(id) on delete cascade not null,
  date text not null,
  description text not null,
  cost numeric not null default 0,
  odometer_km numeric not null default 0,
  created_at timestamptz default now()
);

alter table service_records enable row level security;

create policy "Users see own service_records"
  on service_records for select using (auth.uid() = user_id);
create policy "Users insert own service_records"
  on service_records for insert with check (auth.uid() = user_id);
create policy "Users update own service_records"
  on service_records for update using (auth.uid() = user_id);
create policy "Users delete own service_records"
  on service_records for delete using (auth.uid() = user_id);

-- Create indexes for common queries
create index if not exists idx_incomes_date on incomes(user_id, date);
create index if not exists idx_expenses_date on expenses(user_id, date);
create index if not exists idx_car_documents_car on car_documents(car_id);
create index if not exists idx_service_records_car on service_records(car_id, date);
