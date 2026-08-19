-- ============================================
-- HPA Cabs – Migrate from per-user to shared data model
-- Run ONLY if you previously ran the old supabase-setup.sql
-- (that had "Users see own ..." policies).
-- If setting up fresh, use supabase-setup.sql instead.
-- This is a legacy migration only. Do not run it for a fresh setup; apply
-- supabase-rls-roles.sql and supabase-data-constraints.sql instead.
-- ============================================

-- Drop old per-user policies
do $$
declare
  tbl text;
  pol record;
begin
  for tbl in select unnest(array['incomes','expenses','cars','car_documents','service_records'])
  loop
    for pol in
      select policyname from pg_policies where tablename = tbl and schemaname = 'public'
    loop
      execute format('drop policy if exists %I on %I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

-- Create new shared-access policies (any authenticated user)
-- Incomes
create policy "Authenticated users can read incomes"
  on incomes for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert incomes"
  on incomes for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update incomes"
  on incomes for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete incomes"
  on incomes for delete using (auth.role() = 'authenticated');

-- Expenses
create policy "Authenticated users can read expenses"
  on expenses for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert expenses"
  on expenses for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update expenses"
  on expenses for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete expenses"
  on expenses for delete using (auth.role() = 'authenticated');

-- Cars
create policy "Authenticated users can read cars"
  on cars for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert cars"
  on cars for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update cars"
  on cars for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete cars"
  on cars for delete using (auth.role() = 'authenticated');

-- Car Documents
create policy "Authenticated users can read car_documents"
  on car_documents for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert car_documents"
  on car_documents for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update car_documents"
  on car_documents for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete car_documents"
  on car_documents for delete using (auth.role() = 'authenticated');

-- Service Records
create policy "Authenticated users can read service_records"
  on service_records for select using (auth.role() = 'authenticated');
create policy "Authenticated users can insert service_records"
  on service_records for insert with check (auth.role() = 'authenticated');
create policy "Authenticated users can update service_records"
  on service_records for update using (auth.role() = 'authenticated');
create policy "Authenticated users can delete service_records"
  on service_records for delete using (auth.role() = 'authenticated');

-- Make user_id nullable (shared data, user_id is just audit trail)
alter table incomes alter column user_id drop not null;
alter table expenses alter column user_id drop not null;
alter table cars alter column user_id drop not null;
alter table car_documents alter column user_id drop not null;
alter table service_records alter column user_id drop not null;
