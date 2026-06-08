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
drop policy if exists "Authenticated users can read driver_profiles" on driver_profiles;
create policy "Authenticated users can read driver_profiles" on driver_profiles for select using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can insert driver_profiles" on driver_profiles;
create policy "Authenticated users can insert driver_profiles" on driver_profiles for insert with check (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can update driver_profiles" on driver_profiles;
create policy "Authenticated users can update driver_profiles" on driver_profiles for update using (auth.role() = 'authenticated');
drop policy if exists "Authenticated users can delete driver_profiles" on driver_profiles;
create policy "Authenticated users can delete driver_profiles" on driver_profiles for delete using (auth.role() = 'authenticated');
