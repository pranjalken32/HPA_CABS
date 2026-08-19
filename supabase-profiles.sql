-- ============================================
-- HPA Cabs – Profiles table for display names
-- Run this in Supabase SQL Editor after supabase-setup.sql
-- ============================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

-- Auto-create a profile when a new user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================
-- INSERT profiles for existing users.
-- This backfills any users already created before this trigger.
-- It uses the part before @ in their email as the display name.
-- You can UPDATE profiles SET display_name = 'Hemant' WHERE ...
-- to set custom names after running this.
-- ============================================
insert into profiles (id, display_name)
select id, split_part(email, '@', 1)
from auth.users
where id not in (select id from profiles)
on conflict (id) do nothing;
