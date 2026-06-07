-- Add role column to profiles table for driver vs owner access
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'owner';

-- Update existing profiles to be owners
UPDATE profiles SET role = 'owner' WHERE role IS NULL OR role = '';

-- To create a driver account:
-- 1. Create user in Supabase Auth → Authentication → Users → Add user
-- 2. Then update their role:
--    UPDATE profiles SET role = 'driver' WHERE display_name = 'driver_name_here';
