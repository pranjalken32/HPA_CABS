-- ============================================
-- HPA Cabs – Supabase Schema Setup (Shared Data)
-- Run this in the Supabase SQL Editor once.
-- ============================================
-- All 3 team members (Hemant, Anurag, Pranjal) share the same data.
-- Apply supabase-rls-roles.sql after this schema setup for role-based access.
-- Apply supabase-data-constraints.sql afterward for database validation.
-- Public sign-ups MUST be disabled in Supabase Auth settings.

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

-- Indexes for common queries
create index if not exists idx_incomes_date on incomes(date);
create index if not exists idx_expenses_date on expenses(date);
create index if not exists idx_car_documents_car on car_documents(car_id);
create index if not exists idx_service_records_car on service_records(car_id, date);
