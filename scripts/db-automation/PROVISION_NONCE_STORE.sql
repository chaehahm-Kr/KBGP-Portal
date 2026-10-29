-- ============================================================================
-- K SELECT NETWORK — PRODUCTION MIGRATION SECURITY NONCE STORE PROVISIONING
-- Dedicated Private Administrative Schema & Least-Privilege Ledger
-- Task: DEV-DB-SEC-004
-- Target Database: Production Supabase (shzfrppdobpmrstcjfqu)
-- Mode: STANDALONE ONE-TIME HUMAN OWNER PROVISIONING
-- ============================================================================

-- 1. Create Dedicated Private Administrative Schema
-- Completely isolated from Supabase CLI internal schemas and public PostgREST API
CREATE SCHEMA IF NOT EXISTS _kselect_ops;

-- 2. Restrict Schema Access (Strict Least-Privilege Boundary)
-- Revoke all default privileges from public web, API, and client roles
REVOKE ALL ON SCHEMA _kselect_ops FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA _kselect_ops TO postgres;

-- 3. Create Consumed Approval Tokens Table
CREATE TABLE IF NOT EXISTS _kselect_ops.consumed_approval_tokens (
  nonce TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  git_sha TEXT NOT NULL,
  aggregate_digest TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'CONSUMED',
  execution_error TEXT
);

-- 4. Apply Least-Privilege Table Grants
-- Completely exclude service_role, anon, and authenticated
REVOKE ALL ON TABLE _kselect_ops.consumed_approval_tokens FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE _kselect_ops.consumed_approval_tokens TO postgres;
GRANT UPDATE (status, execution_error) ON TABLE _kselect_ops.consumed_approval_tokens TO postgres;

-- 5. Administrative Comments and Schema Documentation
COMMENT ON SCHEMA _kselect_ops IS 
'Dedicated private administrative schema for K SELECT platform operations and migration security controls.';

COMMENT ON TABLE _kselect_ops.consumed_approval_tokens IS 
'Cryptographic single-use nonce ledger for Production SQL migration approvals (DEV-DB-SEC-004).';

COMMENT ON COLUMN _kselect_ops.consumed_approval_tokens.nonce IS 
'Cryptographically unique single-use token nonce (UUID v4 or 32+ hex). Enforces atomic replay prevention.';

COMMENT ON COLUMN _kselect_ops.consumed_approval_tokens.status IS 
'Lifecycle status of token consumption: CONSUMED (in-progress), COMPLETED (succeeded), or FAILED.';
