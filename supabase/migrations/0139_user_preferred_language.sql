-- 0139_user_preferred_language.sql
-- Add preferred_language column to profiles and company_users for user language persistence

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

ALTER TABLE company_users 
ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'en';

COMMENT ON COLUMN profiles.preferred_language IS 'User interface language preference (en or ko)';
COMMENT ON COLUMN company_users.preferred_language IS 'User interface language preference (en or ko)';
