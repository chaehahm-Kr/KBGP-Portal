-- 0122_company_users_english_name.sql
-- Add explicit english_name column to company_users for official English document data source.

ALTER TABLE company_users ADD COLUMN IF NOT EXISTS english_name TEXT;

COMMENT ON COLUMN company_users.english_name IS 'Official English legal/business name used for POs, Invoices, English agreements, and shipping/export documents.';
