-- ============================================
-- HPA Cabs – Driver Profiles Table
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ueiixjkfxbzyuknrkmtk/sql/new
-- ============================================

create table if not exists driver_profiles (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  name text not null,
  phone text not null default '',
  start_date text not null,
  end_date text,
  monthly_salary numeric not null default 0,
  dl_url text,
  aadhaar_url text,
  pan_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);

alter table driver_profiles enable row level security;
-- Apply supabase-rls-roles.sql after creating this table.
-- Apply supabase-data-constraints.sql after the role policies.
