/**
 * Product Performance Policy — Real QA Integration Test Suite
 * Task ID: ADM-SALES-PERF-005-R5
 * Target QA Environment: elkgizqgksshukxgcndy.supabase.co
 * Migration: 0182_product_performance_policy_system.sql & 0183_product_performance_policy_permissions.sql
 *
 * SCOPE:
 * 1. Draft save & reload persistence
 * 2. Database validation invariants (CHECK constraint, weights sum, active exclusivity)
 * 3. Security: Direct unauthorized calls rejected (Owner/Super Admin gating)
 * 4. Restricted role enforcement: Direct table writes cannot bypass Owner-only transitions
 * 5. Owner-only atomic publish execution (status transition, version bump, audit record)
 * 6. Concurrent publish / status transition guard
 * 7. Audit log immutability triggers (append-only UPDATE/DELETE prevention)
 * 8. Transaction atomicity & failed-operation rollback
 * 9. Policy rollback and baseline v1.0.0 clean state restoration
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// @ts-ignore
import { Client as PgClient } from 'pg';
import {
  assertQaEnvironmentOrThrow,
  resolveQaConfig,
  createQaSupabaseClient,
} from '../../scripts/qa/qa-guard';
import { run0183PermissionsMigration } from '../../scripts/qa/qa-run-0183-permissions';

describe('ADM-SALES-PERF-005-R5: Product Performance Policy Real QA Integration', () => {
  let pg: PgClient;
  let supabase: ReturnType<typeof createQaSupabaseClient>;
  let baselinePolicyId: string;

  const SYNTHETIC_DRAFT_ID = 'e1111111-2222-3333-4444-555555555555';
  const SYNTHETIC_INVALID_WEIGHTS_DRAFT_ID = 'e2222222-3333-4444-5555-666666666666';
  const TEST_OWNER_ID = '00000000-0000-4000-c000-000000000001';
  const TEST_STANDARD_ADMIN_ID = '00000000-0000-4000-c000-000000000099';
  const TEST_OWNER_EMAIL = 'qa-admin@kselect-test.local';

  beforeAll(async () => {
    // 1. Assert isolated QA environment — strictly reject Production
    const qaInfo = assertQaEnvironmentOrThrow();
    expect(qaInfo.host).toBe('elkgizqgksshukxgcndy.supabase.co');

    const config = resolveQaConfig();
    pg = new PgClient({
      connectionString: config.QA_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    await pg.connect();

    // Step 2: Apply forward migration 0183 using guarded migration engine
    const report = await run0183PermissionsMigration();
    console.log('0183 migration report:', {
      status: report.status,
      attempted: report.migrationsAttempted,
      succeeded: report.migrationsSucceeded,
    });
    expect(report.status).toBe('SUCCESS');
    expect(report.migrationsSucceeded).toContain('0183_product_performance_policy_permissions.sql');

    // Ensure a standard admin profile exists for RLS testing
    await pg.query(`
      INSERT INTO public.profiles (id, role, display_name)
      VALUES ('${TEST_STANDARD_ADMIN_ID}', 'admin', 'QA Standard Admin')
      ON CONFLICT (id) DO UPDATE SET role = 'admin';
    `);

    supabase = createQaSupabaseClient();

    // 3. Locate baseline active policy (v1.0.0)
    const { data: baseline, error } = await supabase
      .from('product_performance_policies')
      .select('id, version, status, is_active, automatic_grading_enabled')
      .eq('is_active', true)
      .single();

    expect(error).toBeNull();
    expect(baseline).toBeDefined();
    if (!baseline) throw new Error('Baseline active policy v1.0.0 not found');
    expect(baseline.version).toBe('v1.0.0');
    expect(baseline.is_active).toBe(true);
    expect(baseline.automatic_grading_enabled).toBe(false);
    baselinePolicyId = baseline.id;

  }, 20000);

  afterAll(async () => {
    if (!pg) return;

    try {
      // Clean up any test synthetic records and guarantee baseline v1.0.0 is the active policy
      await pg.query(`
        ALTER TABLE public.product_performance_policy_audit_logs DISABLE TRIGGER trg_policy_audit_append_only;
        DELETE FROM public.product_performance_policy_audit_logs 
        WHERE policy_id IN ('${SYNTHETIC_DRAFT_ID}', '${SYNTHETIC_INVALID_WEIGHTS_DRAFT_ID}');
        ALTER TABLE public.product_performance_policy_audit_logs ENABLE TRIGGER trg_policy_audit_append_only;

        DELETE FROM public.product_performance_policies 
        WHERE id IN ('${SYNTHETIC_DRAFT_ID}', '${SYNTHETIC_INVALID_WEIGHTS_DRAFT_ID}');

        ${baselinePolicyId ? `
        -- Restore baseline v1.0.0 as active policy
        UPDATE public.product_performance_policies
        SET is_active = true, status = 'published', effective_to = NULL, updated_at = now()
        WHERE id = '${baselinePolicyId}';
        ` : ''}

        -- Clean up synthetic test admin profile
        DELETE FROM public.profiles WHERE id = '${TEST_STANDARD_ADMIN_ID}';
      `);
    } finally {
      await pg.end();
    }
  });

  // =========================================================================
  // 1. DRAFT SAVE & RELOAD (PERSISTENCE)
  // =========================================================================
  describe('1. Draft Save, Reload, and Update Persistence', () => {
    it('creates a new synthetic policy draft and reloads all structured fields via Supabase client', async () => {
      // Clean up synthetic ID if leftover
      await pg.query(`DELETE FROM public.product_performance_policies WHERE id = '${SYNTHETIC_DRAFT_ID}'`);

      const syntheticDraft = {
        id: SYNTHETIC_DRAFT_ID,
        version: 'draft',
        draft_title: 'QA Synthetic Draft Policy V1.1',
        status: 'draft',
        is_active: false,
        evaluation_period_days: 60,
        eligibility_criteria: {
          min_operating_history_days: 60,
          min_completed_orders: 3,
          min_distinct_stores: 3,
          require_historical_landed_cost: true,
          missing_cost_policy: 'N/A',
        },
        dimension_weights: {
          profitability: 25,
          sales_performance: 20,
          inventory_efficiency: 20,
          exchange_risk: 15,
          retail_velocity: 10,
          growth_potential: 5,
          operational_reliability: 5,
        },
        grade_bands: {
          A: { min: 80, max: 100, label: 'A: 80–100' },
          B: { min: 65, max: 80, label: 'B: 65–<80' },
          C: { min: 50, max: 65, label: 'C: 50–<65' },
          D: { min: 0, max: 50, label: 'D: 0–<50' },
        },
        automatic_grading_enabled: false,
        lock_version: 1,
        change_summary: 'Initial synthetic QA draft',
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('product_performance_policies')
        .insert(syntheticDraft)
        .select()
        .single();

      expect(insertErr).toBeNull();
      expect(inserted.id).toBe(SYNTHETIC_DRAFT_ID);
      expect(inserted.draft_title).toBe('QA Synthetic Draft Policy V1.1');
      expect(inserted.status).toBe('draft');
      expect(inserted.is_active).toBe(false);
      expect(inserted.evaluation_period_days).toBe(60);
      expect(inserted.automatic_grading_enabled).toBe(false);
      expect(inserted.lock_version).toBe(1);

      // Reload via independent query
      const { data: reloaded, error: reloadErr } = await supabase
        .from('product_performance_policies')
        .select('*')
        .eq('id', SYNTHETIC_DRAFT_ID)
        .single();

      expect(reloadErr).toBeNull();
      expect(reloaded.draft_title).toBe('QA Synthetic Draft Policy V1.1');
      expect(reloaded.dimension_weights.profitability).toBe(25);
      expect(reloaded.grade_bands.A.min).toBe(80);
      expect(reloaded.grade_bands.A.max).toBe(100);
      expect(reloaded.eligibility_criteria.min_operating_history_days).toBe(60);
    });

    it('updates draft fields and increments lock_version successfully', async () => {
      const { data: updated, error: updateErr } = await supabase
        .from('product_performance_policies')
        .update({
          draft_title: 'QA Synthetic Draft Policy V1.1 — Updated',
          lock_version: 2,
          change_summary: 'Updated draft title and notes',
        })
        .eq('id', SYNTHETIC_DRAFT_ID)
        .eq('lock_version', 1)
        .select()
        .single();

      expect(updateErr).toBeNull();
      expect(updated.draft_title).toBe('QA Synthetic Draft Policy V1.1 — Updated');
      expect(updated.lock_version).toBe(2);
      expect(updated.change_summary).toBe('Updated draft title and notes');
    });
  });

  // =========================================================================
  // 2. VALIDATION INVARIANTS & DATABASE CONSTRAINTS
  // =========================================================================
  describe('2. Validation Invariants & Physical Database Constraints', () => {
    it('PHYSICALLY BLOCKS automatic grading activation via CHECK constraint (error 23514)', async () => {
      // Attempt to activate automatic grading on draft
      let checkError: any = null;
      try {
        await pg.query(`
          UPDATE public.product_performance_policies
          SET automatic_grading_enabled = true
          WHERE id = '${SYNTHETIC_DRAFT_ID}';
        `);
      } catch (err: any) {
        checkError = err;
      }

      expect(checkError).not.toBeNull();
      expect(checkError.code).toBe('23514'); // check_violation
      expect(checkError.message).toContain('product_performance_policies_automatic_grading_enabled_check');
    });

    it('PHYSICALLY PREVENTS multiple active policies via partial unique index (error 23505)', async () => {
      // Attempt to directly set is_active = true on the draft while baseline v1.0.0 is already active
      let uniqueError: any = null;
      try {
        await pg.query(`
          UPDATE public.product_performance_policies
          SET is_active = true
          WHERE id = '${SYNTHETIC_DRAFT_ID}';
        `);
      } catch (err: any) {
        uniqueError = err;
      }

      expect(uniqueError).not.toBeNull();
      expect(uniqueError.code).toBe('23505'); // unique_violation
      expect(uniqueError.message).toContain('idx_product_performance_policies_active');
    });

    it('RPC rejects draft publishing if pillar dimension weights do not sum to exactly 100', async () => {
      // Create a draft where weights sum to 90%
      await pg.query(`
        INSERT INTO public.product_performance_policies (
          id, version, draft_title, status, is_active, evaluation_period_days,
          eligibility_criteria, dimension_weights, grade_bands, automatic_grading_enabled, lock_version
        ) VALUES (
          '${SYNTHETIC_INVALID_WEIGHTS_DRAFT_ID}', 'draft', 'Invalid Weights Draft', 'draft', false, 60,
          '{"min_operating_history_days": 60}'::jsonb,
          '{"profitability": 15, "sales_performance": 20, "inventory_efficiency": 20, "exchange_risk": 15, "retail_velocity": 10, "growth_potential": 5, "operational_reliability": 5}'::jsonb,
          '{"A": {"min": 80, "max": 100}}'::jsonb,
          false, 1
        ) ON CONFLICT (id) DO UPDATE SET dimension_weights = EXCLUDED.dimension_weights;
      `);

      // Set Owner credentials in session
      await pg.query(`
        SELECT set_config('request.jwt.claims', '{"sub": "${TEST_OWNER_ID}", "app_metadata": {"role": "super_admin"}}', false);
      `);

      let rpcError: any = null;
      try {
        await pg.query(`
          SELECT public.publish_product_performance_policy_atomic(
            '${SYNTHETIC_INVALID_WEIGHTS_DRAFT_ID}'::uuid,
            'Attempt publish invalid weights',
            '${TEST_OWNER_ID}'::uuid,
            '${TEST_OWNER_EMAIL}'
          );
        `);
      } catch (err: any) {
        rpcError = err;
      }

      expect(rpcError).not.toBeNull();
      expect(rpcError.message).toContain('Pillar weights must sum to exactly 100. Current sum: 90');
    });
  });

  // =========================================================================
  // 3. SECURITY & RBAC ENFORCEMENT
  // =========================================================================
  describe('3. Security & Owner-Only RBAC Enforcement', () => {
    it('STRICTLY REJECTS unauthenticated or non-super-admin publish attempts with Forbidden error', async () => {
      // Set caller session with role = 'authenticated' (not super_admin)
      await pg.query(`
        SELECT set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-c000-000000000002", "app_metadata": {"role": "authenticated"}}', false);
      `);

      let unauthorizedError: any = null;
      try {
        await pg.query(`
          SELECT public.publish_product_performance_policy_atomic(
            '${SYNTHETIC_DRAFT_ID}'::uuid,
            'Unauthorized publish attempt',
            '00000000-0000-4000-c000-000000000002'::uuid,
            'qa-warehouse@kselect-test.local'
          );
        `);
      } catch (err: any) {
        unauthorizedError = err;
      }

      expect(unauthorizedError).not.toBeNull();
      expect(unauthorizedError.message).toContain(
        'Forbidden: Only the Owner (Super Admin) is authorized to publish Product Performance evaluation policies.'
      );

      // Verify draft status was NOT modified
      const { data: draftCheck } = await supabase
        .from('product_performance_policies')
        .select('status, is_active')
        .eq('id', SYNTHETIC_DRAFT_ID)
        .single();

      expect(draftCheck!.status).toBe('draft');
      expect(draftCheck!.is_active).toBe(false);
    });

    it('DIRECT TABLE WRITES CANNOT BYPASS Owner-only transitions (RLS WITH CHECK blocks status = published)', async () => {
      // In a transaction, set role to authenticated with a non-super-admin user (standard admin)
      // Note: Even if user is an admin, RLS WITH CHECK restricts UPDATE to ((status = 'draft' AND is_active = false) OR auth_is_super_admin())
      let bypassError: any = null;
      try {
        await pg.query('BEGIN;');
        await pg.query(`SET LOCAL ROLE authenticated;`);
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${TEST_STANDARD_ADMIN_ID}", "app_metadata": {"role": "authenticated"}}', true);
        `);

        // Attempt direct UPDATE of status to published
        await pg.query(`
          UPDATE public.product_performance_policies
          SET status = 'published'
          WHERE id = '${SYNTHETIC_DRAFT_ID}';
        `);
        await pg.query('COMMIT;');
      } catch (err: any) {
        await pg.query('ROLLBACK;');
        bypassError = err;
      }

      expect(bypassError).not.toBeNull();
      // Should fail with 42501 (RLS violation or permission denied)
      expect(bypassError.code).toBe('42501');
    });

    it('DIRECT TABLE WRITES CANNOT BYPASS Owner-only transitions (RLS WITH CHECK blocks is_active = true)', async () => {
      let bypassError: any = null;
      try {
        await pg.query('BEGIN;');
        await pg.query(`SET LOCAL ROLE authenticated;`);
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${TEST_STANDARD_ADMIN_ID}", "app_metadata": {"role": "authenticated"}}', true);
        `);

        // Attempt direct UPDATE of is_active to true
        await pg.query(`
          UPDATE public.product_performance_policies
          SET is_active = true
          WHERE id = '${SYNTHETIC_DRAFT_ID}';
        `);
        await pg.query('COMMIT;');
      } catch (err: any) {
        await pg.query('ROLLBACK;');
        bypassError = err;
      }

      expect(bypassError).not.toBeNull();
      expect(bypassError.code).toBe('42501');
    });

    it('ANONYMOUS USERS HAVE ZERO ACCESS to policy tables (REVOKE ALL verified)', async () => {
      let anonError: any = null;
      try {
        await pg.query('BEGIN;');
        await pg.query(`SET LOCAL ROLE anon;`);
        await pg.query(`SELECT * FROM public.product_performance_policies;`);
        await pg.query('COMMIT;');
      } catch (err: any) {
        await pg.query('ROLLBACK;');
        anonError = err;
      }

      expect(anonError).not.toBeNull();
      expect(anonError.code).toBe('42501'); // permission denied for table product_performance_policies
    });
  });

  // =========================================================================
  // 4. ATOMIC OWNER PUBLISH EXECUTION
  // =========================================================================
  describe('4. Owner-Only Atomic Policy Publish Execution', () => {
    it('executes atomic publish with Super Admin context, transitions status, bumps version, and logs audit', async () => {
      // Set Owner credentials in session
      await pg.query(`
        SELECT set_config('request.jwt.claims', '{"sub": "${TEST_OWNER_ID}", "app_metadata": {"role": "super_admin"}}', false);
      `);

      const publishRes = await pg.query(`
        SELECT public.publish_product_performance_policy_atomic(
          '${SYNTHETIC_DRAFT_ID}'::uuid,
          'Owner approved QA V1.1 policy launch',
          '${TEST_OWNER_ID}'::uuid,
          '${TEST_OWNER_EMAIL}'
        ) as result;
      `);

      const result = publishRes.rows[0]?.result;
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.version).toBe('v1.1.0');
      expect(result.policy_id).toBe(SYNTHETIC_DRAFT_ID);

      // Verify database state after publish:
      // 1. Newly published policy
      const { data: newActive } = await supabase
        .from('product_performance_policies')
        .select('*')
        .eq('id', SYNTHETIC_DRAFT_ID)
        .single();

      expect(newActive!.status).toBe('published');
      expect(newActive!.is_active).toBe(true);
      expect(newActive!.version).toBe('v1.1.0');
      expect(newActive!.change_summary).toBe('Owner approved QA V1.1 policy launch');
      expect(newActive!.published_at).not.toBeNull();
      expect(newActive!.automatic_grading_enabled).toBe(false);

      // 2. Previous baseline policy must be superseded and deactivated
      const { data: prevActive } = await supabase
        .from('product_performance_policies')
        .select('*')
        .eq('id', baselinePolicyId)
        .single();

      expect(prevActive!.status).toBe('superseded');
      expect(prevActive!.is_active).toBe(false);
      expect(prevActive!.effective_to).not.toBeNull();

      // 3. Exactly ONE policy must be active in the whole database
      const { data: activeList } = await supabase
        .from('product_performance_policies')
        .select('id, version')
        .eq('is_active', true);

      expect(activeList).toHaveLength(1);
      expect(activeList![0].id).toBe(SYNTHETIC_DRAFT_ID);

      // 4. Immutable audit record must be recorded
      const { data: auditLogs } = await supabase
        .from('product_performance_policy_audit_logs')
        .select('*')
        .eq('policy_id', SYNTHETIC_DRAFT_ID)
        .eq('action', 'publish');

      expect(auditLogs).toHaveLength(1);
      const audit = auditLogs![0];
      expect(audit.actor_email).toBe(TEST_OWNER_EMAIL);
      expect(audit.change_reason).toBe('Owner approved QA V1.1 policy launch');
      expect(audit.previous_state.version).toBe('v1.0.0');
      expect(audit.new_state.version).toBe('v1.1.0');
    });

    it('rejects duplicate or concurrent publish of an already-published policy', async () => {
      // Re-invoke publish on already published policy
      await pg.query(`
        SELECT set_config('request.jwt.claims', '{"sub": "${TEST_OWNER_ID}", "app_metadata": {"role": "super_admin"}}', false);
      `);

      let republishError: any = null;
      try {
        await pg.query(`
          SELECT public.publish_product_performance_policy_atomic(
            '${SYNTHETIC_DRAFT_ID}'::uuid,
            'Duplicate publish attempt',
            '${TEST_OWNER_ID}'::uuid,
            '${TEST_OWNER_EMAIL}'
          );
        `);
      } catch (err: any) {
        republishError = err;
      }

      expect(republishError).not.toBeNull();
      expect(republishError.message).toContain('Only draft policies can be published. Current status: published');
    });
  });

  // =========================================================================
  // 5. AUDIT LOG & HISTORICAL EVALUATION IMMUTABILITY
  // =========================================================================
  describe('5. Audit Log Immutability Triggers', () => {
    it('PREVENTS UPDATE mutations on policy audit logs (append-only trigger)', async () => {
      let updateError: any = null;
      try {
        await pg.query(`
          UPDATE public.product_performance_policy_audit_logs
          SET change_reason = 'Tampered reason'
          WHERE policy_id = '${SYNTHETIC_DRAFT_ID}';
        `);
      } catch (err: any) {
        updateError = err;
      }

      expect(updateError).not.toBeNull();
      expect(updateError.message).toContain('Policy audit log entries are append-only audit records and cannot be modified.');
    });

    it('PREVENTS DELETE mutations on policy audit logs (append-only trigger)', async () => {
      let deleteError: any = null;
      try {
        await pg.query(`
          DELETE FROM public.product_performance_policy_audit_logs
          WHERE policy_id = '${SYNTHETIC_DRAFT_ID}';
        `);
      } catch (err: any) {
        deleteError = err;
      }

      expect(deleteError).not.toBeNull();
      expect(deleteError.message).toContain('Policy audit log entries are append-only audit records and cannot be deleted.');
    });
  });

  // =========================================================================
  // 6. TRANSACTION ATOMICITY & FAILED-OPERATION ROLLBACK
  // =========================================================================
  describe('6. Transaction Atomicity & Failed-Operation Rollback', () => {
    it('rolls back database modifications completely when an error occurs inside a transaction', async () => {
      const rollbackProbeDraftId = 'e3333333-4444-5555-6666-777777777777';

      try {
        await pg.query('BEGIN');

        // Insert a probe draft
        await pg.query(`
          INSERT INTO public.product_performance_policies (
            id, version, draft_title, status, is_active, evaluation_period_days,
            eligibility_criteria, dimension_weights, grade_bands, automatic_grading_enabled
          ) VALUES (
            '${rollbackProbeDraftId}', 'draft', 'Transaction Rollback Probe', 'draft', false, 60,
            '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, false
          );
        `);

        // Intentionally trigger a CHECK constraint error in the same transaction
        await pg.query(`
          UPDATE public.product_performance_policies
          SET automatic_grading_enabled = true
          WHERE id = '${rollbackProbeDraftId}';
        `);

        await pg.query('COMMIT');
      } catch (err) {
        await pg.query('ROLLBACK');
      }

      // Verify probe draft does NOT exist in database
      const probeCheck = await pg.query(`
        SELECT id FROM public.product_performance_policies WHERE id = '${rollbackProbeDraftId}';
      `);
      expect(probeCheck.rows).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. POLICY ROLLBACK & RESTORATION OF APPROVED BASELINE V1.0.0
  // =========================================================================
  describe('7. Policy Rollback & Baseline v1.0.0 Restoration', () => {
    it('executes policy rollback: deactivates v1.1.0, restores v1.0.0, and records rollback audit entry', async () => {
      // Deactivate v1.1.0 synthetic policy
      await pg.query(`
        UPDATE public.product_performance_policies
        SET is_active = false, status = 'archived', updated_at = now()
        WHERE id = '${SYNTHETIC_DRAFT_ID}';
      `);

      // Restore baseline v1.0.0 as active
      await pg.query(`
        UPDATE public.product_performance_policies
        SET is_active = true, status = 'published', effective_to = NULL, updated_at = now()
        WHERE id = '${baselinePolicyId}';
      `);

      // Record rollback in audit log
      await pg.query(`
        INSERT INTO public.product_performance_policy_audit_logs (
          policy_id, action, actor_id, actor_email, previous_state, new_state, change_reason
        ) VALUES (
          '${baselinePolicyId}',
          'rollback',
          '${TEST_OWNER_ID}',
          '${TEST_OWNER_EMAIL}',
          json_build_object('active_policy_id', '${SYNTHETIC_DRAFT_ID}', 'version', 'v1.1.0'),
          json_build_object('active_policy_id', '${baselinePolicyId}', 'version', 'v1.0.0'),
          'QA rollback execution: restored approved baseline v1.0.0'
        );
      `);

      // Verify restored active state
      const { data: activePolicy, error: activeErr } = await supabase
        .from('product_performance_policies')
        .select('*')
        .eq('is_active', true)
        .single();

      expect(activeErr).toBeNull();
      expect(activePolicy.id).toBe(baselinePolicyId);
      expect(activePolicy.version).toBe('v1.0.0');
      expect(activePolicy.status).toBe('published');
      expect(activePolicy.is_active).toBe(true);
      expect(activePolicy.automatic_grading_enabled).toBe(false);

      // Verify exact count of active policies is 1
      const countRes = await pg.query(`
        SELECT count(*) as active_count FROM public.product_performance_policies WHERE is_active = true;
      `);
      expect(parseInt(countRes.rows[0].active_count, 10)).toBe(1);
    });
  });
});
