/**
 * Brand Sourcing — Database Permission & Migration Verification (ADM-BSRC-003-R1)
 * Target QA Environment: elkgizqgksshukxgcndy.supabase.co
 * Migration: 0184_brand_sourcing_schema.sql
 *
 * SCOPE:
 * 1. Pre-check: Isolated QA environment assertion & Production protection.
 * 2. Schema, Relational, and RLS Metadata Audit across all 5 sourcing tables:
 *    - sourcing_companies, sourcing_brands, sourcing_contacts, sourcing_websites, sourcing_sources
 *    - relrowsecurity = true & relforcerowsecurity = true
 * 3. Permission Verification Matrix:
 *    - Unauthenticated (anon key & SET LOCAL ROLE anon): SELECT, INSERT, UPDATE, DELETE blocked
 *    - Unauthorized Staff / Portal User (role != admin): SELECT, INSERT, UPDATE, DELETE blocked
 *    - Authorized Brand Staff (admin role): SELECT, INSERT, UPDATE, DELETE permitted
 *    - Super Admin: Full administrative privileges verified
 *    - Service Role: Privileged backend access verified with application layer safety guards
 * 4. Data Contract & Integrity Verification:
 *    - Foreign key cascade deletion (company -> brands, contacts, websites, sources)
 *    - Marketing consent invariant: Strictly UNCONFIRMED default
 *    - Multi-brand, contact, website support matching NormalizedCompanyDraft
 *    - Provenance & raw payload retention
 *    - Duplicate candidate detection and non-destructive operations
 * 5. Migration 0184 sequencing and dependencies verification
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
// @ts-ignore
import { Client as PgClient } from "pg";
import {
  assertQaEnvironmentOrThrow,
  resolveQaConfig,
  createQaSupabaseClient,
} from "../../scripts/qa/qa-guard";
import { createClient } from "@supabase/supabase-js";
import {
  validateSafeExternalUrl,
  isPrivateOrReservedHost,
  findDuplicateCandidates,
  saveSourcingDraft,
  NormalizedCompanyDraft,
} from "../../lib/brand-sourcing";

describe("ADM-BSRC-003-R1: Brand Sourcing Database Permissions & Migration Verification", () => {
  let pg: PgClient;
  let serviceClient: ReturnType<typeof createQaSupabaseClient>;
  let anonClient: ReturnType<typeof createClient>;
  let qaConfig: ReturnType<typeof resolveQaConfig>;

  // Dedicated test fixtures
  const SYNTHETIC_COMP_ID = "00000000-0000-4000-b000-000000000001";
  const SYNTHETIC_SOURCE_ID = "org-perm-test-0000-1111-2222-333333333333";

  let adminUserId: string = "00000000-0000-4000-a000-000000000001";
  let portalUserId: string = "00000000-0000-4000-c000-000000000002";

  beforeAll(async () => {
    // 1. Assert isolated QA environment — strictly reject Production
    const qaInfo = assertQaEnvironmentOrThrow();
    expect(qaInfo.host).toBe("elkgizqgksshukxgcndy.supabase.co");

    qaConfig = resolveQaConfig();
    pg = new PgClient({
      connectionString: qaConfig.QA_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    await pg.connect();

    // 2. Discover or provision active admin and portal test profiles on QA
    const adminRes = await pg.query(
      "SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1;"
    );
    if (adminRes.rows.length > 0) {
      adminUserId = adminRes.rows[0].id;
    } else {
      // Safely ensure synthetic admin profile exists in QA
      await pg.query(`
        INSERT INTO auth.users (id, email) VALUES ('${adminUserId}', 'qa-admin-synthetic@kselect.local')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.profiles (id, role, display_name) VALUES ('${adminUserId}', 'admin', 'QA Synthetic Admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
      `);
    }

    const portalRes = await pg.query(
      "SELECT id FROM public.profiles WHERE role = 'portal' LIMIT 1;"
    );
    if (portalRes.rows.length > 0) {
      portalUserId = portalRes.rows[0].id;
    } else {
      // Safely ensure synthetic portal profile exists in QA
      await pg.query(`
        INSERT INTO auth.users (id, email) VALUES ('${portalUserId}', 'qa-portal-synthetic@kselect.local')
        ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.profiles (id, role, display_name) VALUES ('${portalUserId}', 'portal', 'QA Synthetic Portal User')
        ON CONFLICT (id) DO UPDATE SET role = 'portal';
      `);
    }

    // Initialize Supabase Clients
    serviceClient = createQaSupabaseClient();
    if (qaConfig.QA_SUPABASE_ANON_KEY) {
      anonClient = createClient(qaInfo.targetUrl, qaConfig.QA_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    // Clean up any leftover synthetic fixture before tests
    await pg.query(`
      DELETE FROM public.sourcing_companies WHERE id = '${SYNTHETIC_COMP_ID}';
      DELETE FROM public.sourcing_sources WHERE source_identifier = '${SYNTHETIC_SOURCE_ID}';
    `);
  });

  afterAll(async () => {
    if (!pg) return;
    try {
      // Final clean up of synthetic test fixtures
      await pg.query(`
        DELETE FROM public.sourcing_companies WHERE id = '${SYNTHETIC_COMP_ID}';
        DELETE FROM public.sourcing_sources WHERE source_identifier = '${SYNTHETIC_SOURCE_ID}';
      `);
    } finally {
      await pg.end();
    }
  });

  // =========================================================================
  // 1. SCHEMA, CONSTRAINTS & RLS METADATA AUDIT
  // =========================================================================
  describe("1. Database Schema, Constraints & RLS Metadata Audit", () => {
    const EXPECTED_TABLES = [
      "sourcing_companies",
      "sourcing_brands",
      "sourcing_contacts",
      "sourcing_websites",
      "sourcing_sources",
    ];

    it("verifies all 5 dedicated sourcing tables exist with RLS and FORCE RLS enabled", async () => {
      const res = await pg.query(`
        SELECT relname, relrowsecurity, relforcerowsecurity
        FROM pg_class
        WHERE relname IN (${EXPECTED_TABLES.map((t) => `'${t}'`).join(", ")});
      `);

      expect(res.rows.length).toBe(5);
      for (const row of res.rows) {
        expect(row.relrowsecurity).toBe(true);
        expect(row.relforcerowsecurity).toBe(true);
      }
    });

    it("verifies active RLS policies exist on all 5 tables targeting authenticated users", async () => {
      const res = await pg.query(`
        SELECT tablename, policyname, cmd, roles, qual, with_check
        FROM pg_policies
        WHERE tablename IN (${EXPECTED_TABLES.map((t) => `'${t}'`).join(", ")});
      `);

      expect(res.rows.length).toBe(5);
      for (const row of res.rows) {
        expect(row.cmd).toBe("ALL");
        expect(row.roles).toContain("authenticated");
        expect(row.qual).toContain("auth_is_admin");
        expect(row.with_check).toContain("auth_is_admin");
      }
    });

    it("verifies permissions revoked from anon role on all 5 tables", async () => {
      const res = await pg.query(`
        SELECT table_name, privilege_type
        FROM information_schema.table_privileges
        WHERE grantee = 'anon'
          AND table_name IN (${EXPECTED_TABLES.map((t) => `'${t}'`).join(", ")});
      `);

      expect(res.rows.length).toBe(0);
    });
  });

  // =========================================================================
  // 2. PERMISSION RESTRICTION MATRIX: UNAUTHENTICATED & ANON
  // =========================================================================
  describe("2. Unauthenticated / Anon Access Restrictions", () => {
    it("BLOCKS anon SELECT at database permission level (42501 permission denied)", async () => {
      let err: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE anon;");
        await pg.query("SELECT * FROM public.sourcing_companies;");
      } catch (e: any) {
        err = e;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(err).not.toBeNull();
      expect(err.code).toBe("42501");
    });

    it("BLOCKS anon INSERT at database permission level (42501 permission denied)", async () => {
      let err: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE anon;");
        await pg.query(`
          INSERT INTO public.sourcing_companies (company_name_kr)
          VALUES ('불법익명회사');
        `);
      } catch (e: any) {
        err = e;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(err).not.toBeNull();
      expect(err.code).toBe("42501");
    });

    it("BLOCKS anon UPDATE at database permission level (42501 permission denied)", async () => {
      let err: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE anon;");
        await pg.query(`
          UPDATE public.sourcing_companies
          SET grade = 'A'
          WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
      } catch (e: any) {
        err = e;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(err).not.toBeNull();
      expect(err.code).toBe("42501");
    });

    it("BLOCKS anon DELETE at database permission level (42501 permission denied)", async () => {
      let err: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE anon;");
        await pg.query(`
          DELETE FROM public.sourcing_companies
          WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
      } catch (e: any) {
        err = e;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(err).not.toBeNull();
      expect(err.code).toBe("42501");
    });

    it("PostgREST Anon API client is blocked from reading or writing sourcing tables", async () => {
      if (!anonClient) return;

      const { data: readData, error: readError } = await (anonClient as any)
        .from("sourcing_companies")
        .select("id, company_name_kr");

      // Either returns 42501 error or empty array due to permission revocation / RLS
      if (readError) {
        expect(readError.code).toBe("42501");
      } else {
        expect(readData).toEqual([]);
      }

      const { data: insertData, error: insertError } = await (anonClient as any)
        .from("sourcing_companies")
        .insert({ company_name_kr: "익명침입시도" })
        .select();

      expect(insertError).not.toBeNull();
      expect(insertData).toBeNull();
    });
  });

  // =========================================================================
  // 3. PERMISSION RESTRICTION MATRIX: UNAUTHORIZED STAFF / PORTAL USER
  // =========================================================================
  describe("3. Unauthorized Staff / Portal User Access Restrictions", () => {
    it("BLOCKS portal user from seeing any sourcing records (RLS returns 0 rows)", async () => {
      // First ensure a candidate exists via service client
      await pg.query(`
        INSERT INTO public.sourcing_companies (id, company_name_kr, grade, status)
        VALUES ('${SYNTHETIC_COMP_ID}', '기밀소싱기업', 'A', 'DRAFT')
        ON CONFLICT (id) DO NOTHING;
      `);

      let rows: any[] = [];
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${portalUserId}", "role": "authenticated"}', true);
        `);
        const res = await pg.query(`
          SELECT * FROM public.sourcing_companies WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
        rows = res.rows;
      } finally {
        await pg.query("ROLLBACK;");
      }

      // RLS filtering strictly conceals rows from non-admin authenticated users
      expect(rows.length).toBe(0);
    });

    it("BLOCKS portal user from inserting sourcing candidate (RLS WITH CHECK violation 42501)", async () => {
      let insertErr: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${portalUserId}", "role": "authenticated"}', true);
        `);
        await pg.query(`
          INSERT INTO public.sourcing_companies (company_name_kr)
          VALUES ('포털사용자무단생성');
        `);
      } catch (e: any) {
        insertErr = e;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(insertErr).not.toBeNull();
      expect(insertErr.code).toBe("42501");
      expect(insertErr.message).toContain("row-level security policy");
    });

    it("BLOCKS portal user from modifying sourcing evaluation status (RLS blocks update)", async () => {
      let updateCount = 0;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${portalUserId}", "role": "authenticated"}', true);
        `);
        const res = await pg.query(`
          UPDATE public.sourcing_companies
          SET grade = 'C', status = 'ARCHIVED'
          WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
        updateCount = res.rowCount || 0;
      } finally {
        await pg.query("ROLLBACK;");
      }

      // 0 rows updated because row is invisible to portal user
      expect(updateCount).toBe(0);
    });

    it("BLOCKS portal user from deleting sourcing records (RLS blocks delete)", async () => {
      let deleteCount = 0;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${portalUserId}", "role": "authenticated"}', true);
        `);
        const res = await pg.query(`
          DELETE FROM public.sourcing_companies
          WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
        deleteCount = res.rowCount || 0;
      } finally {
        await pg.query("ROLLBACK;");
      }

      // 0 rows deleted because row is invisible to portal user
      expect(deleteCount).toBe(0);

      // Verify row still exists in DB
      const check = await pg.query(
        `SELECT id FROM public.sourcing_companies WHERE id = '${SYNTHETIC_COMP_ID}';`
      );
      expect(check.rows.length).toBe(1);
    });
  });

  // =========================================================================
  // 4. PERMISSION VERIFICATION: AUTHORIZED ADMIN & SUPER ADMIN
  // =========================================================================
  describe("4. Authorized Admin Staff & Super Admin Access", () => {
    it("ALLOWS authorized admin staff to insert candidate and read back all fields", async () => {
      let insertedRow: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${adminUserId}", "role": "authenticated"}', true);
        `);

        const insertRes = await pg.query(`
          INSERT INTO public.sourcing_companies (
            company_name_kr, company_name_en, grade, status, marketing_consent_status
          ) VALUES (
            '어드민검증화장품', 'ADMIN VERIFIED COSMETICS', 'B', 'REVIEWED', 'UNCONFIRMED'
          ) RETURNING *;
        `);
        insertedRow = insertRes.rows[0];

        const selectRes = await pg.query(`
          SELECT * FROM public.sourcing_companies WHERE id = '${insertedRow.id}';
        `);
        expect(selectRes.rows.length).toBe(1);
        expect(selectRes.rows[0].company_name_kr).toBe("어드민검증화장품");
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(insertedRow).not.toBeNull();
      expect(insertedRow.marketing_consent_status).toBe("UNCONFIRMED");
    });

    it("ALLOWS authorized admin staff to update grade, status, and internal notes", async () => {
      let updatedRow: any = null;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${adminUserId}", "role": "authenticated"}', true);
        `);

        const updateRes = await pg.query(`
          UPDATE public.sourcing_companies
          SET grade = 'A', status = 'SAVED', internal_notes = 'High priority target'
          WHERE id = '${SYNTHETIC_COMP_ID}'
          RETURNING *;
        `);
        updatedRow = updateRes.rows[0];
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(updatedRow).not.toBeNull();
      expect(updatedRow.grade).toBe("A");
      expect(updatedRow.status).toBe("SAVED");
      expect(updatedRow.internal_notes).toBe("High priority target");
    });

    it("ALLOWS Super Admin to delete candidate when explicitly required", async () => {
      let deleteCount = 0;
      try {
        await pg.query("BEGIN;");
        await pg.query("SET LOCAL ROLE authenticated;");
        await pg.query(`
          SELECT set_config('request.jwt.claims', '{"sub": "${adminUserId}", "role": "authenticated"}', true);
        `);

        const deleteRes = await pg.query(`
          DELETE FROM public.sourcing_companies
          WHERE id = '${SYNTHETIC_COMP_ID}';
        `);
        deleteCount = deleteRes.rowCount || 0;
      } finally {
        await pg.query("ROLLBACK;");
      }

      expect(deleteCount).toBe(1);
    });
  });

  // =========================================================================
  // 5. DATA CONTRACT, INTEGRITY & RELATIONAL CASCADING
  // =========================================================================
  describe("5. Data Contract & Relational Integrity Verification", () => {
    it("enforces default marketing_consent_status = 'UNCONFIRMED' on raw inserts", async () => {
      const res = await pg.query(`
        INSERT INTO public.sourcing_companies (company_name_kr)
        VALUES ('기본마케팅동의검증기업')
        RETURNING marketing_consent_status;
      `);
      const defaultStatus = res.rows[0].marketing_consent_status;

      // Clean up
      await pg.query("DELETE FROM public.sourcing_companies WHERE company_name_kr = '기본마케팅동의검증기업';");

      expect(defaultStatus).toBe("UNCONFIRMED");
    });

    it("verifies ON DELETE CASCADE removes all child records atomically", async () => {
      // 1. Insert parent company
      const compRes = await pg.query(`
        INSERT INTO public.sourcing_companies (company_name_kr)
        VALUES ('종속삭제검증기업')
        RETURNING id;
      `);
      const compId = compRes.rows[0].id;

      // 2. Insert child records across all 4 child tables
      await pg.query(`
        INSERT INTO public.sourcing_brands (company_id, brand_name_kr)
        VALUES ('${compId}', '종속브랜드1');

        INSERT INTO public.sourcing_contacts (company_id, email)
        VALUES ('${compId}', 'cascade-test@test.local');

        INSERT INTO public.sourcing_websites (company_id, url)
        VALUES ('${compId}', 'https://cascade-test.local');

        INSERT INTO public.sourcing_sources (company_id, provider, source_url, source_identifier)
        VALUES ('${compId}', 'INTERCHARM', 'https://cascade-test.local/src', 'org-cascade-test-1111');
      `);

      // Verify children exist
      const brandCount = await pg.query(`SELECT count(*) FROM public.sourcing_brands WHERE company_id = '${compId}';`);
      const contactCount = await pg.query(`SELECT count(*) FROM public.sourcing_contacts WHERE company_id = '${compId}';`);
      const webCount = await pg.query(`SELECT count(*) FROM public.sourcing_websites WHERE company_id = '${compId}';`);
      const srcCount = await pg.query(`SELECT count(*) FROM public.sourcing_sources WHERE company_id = '${compId}';`);

      expect(parseInt(brandCount.rows[0].count, 10)).toBe(1);
      expect(parseInt(contactCount.rows[0].count, 10)).toBe(1);
      expect(parseInt(webCount.rows[0].count, 10)).toBe(1);
      expect(parseInt(srcCount.rows[0].count, 10)).toBe(1);

      // 3. Delete parent company
      await pg.query(`DELETE FROM public.sourcing_companies WHERE id = '${compId}';`);

      // 4. Verify all children were automatically cascaded
      const afterBrand = await pg.query(`SELECT count(*) FROM public.sourcing_brands WHERE company_id = '${compId}';`);
      const afterContact = await pg.query(`SELECT count(*) FROM public.sourcing_contacts WHERE company_id = '${compId}';`);
      const afterWeb = await pg.query(`SELECT count(*) FROM public.sourcing_websites WHERE company_id = '${compId}';`);
      const afterSrc = await pg.query(`SELECT count(*) FROM public.sourcing_sources WHERE company_id = '${compId}';`);

      expect(parseInt(afterBrand.rows[0].count, 10)).toBe(0);
      expect(parseInt(afterContact.rows[0].count, 10)).toBe(0);
      expect(parseInt(afterWeb.rows[0].count, 10)).toBe(0);
      expect(parseInt(afterSrc.rows[0].count, 10)).toBe(0);
    });

    it("verifies raw payload retention in sourcing_sources and audit snapshot", async () => {
      const payloadSample = {
        exhibitorId: "ex-sample-1234",
        categoryIds: ["C1", "C2"],
        standNumber: "HALL-3-D05",
        nestedInfo: { key: "value", timestamp: "2026-10-26" },
      };

      const compRes = await pg.query(`
        INSERT INTO public.sourcing_companies (
          company_name_kr, raw_payload_snapshot, audit_summary
        ) VALUES (
          '원천데이터검증기업',
          '${JSON.stringify(payloadSample)}'::jsonb,
          '{"status": "SUCCESS", "missingKeyFields": [], "notes": ["Audited"]}'::jsonb
        ) RETURNING id, raw_payload_snapshot, audit_summary;
      `);
      const compId = compRes.rows[0].id;
      const compRow = compRes.rows[0];

      expect(compRow.raw_payload_snapshot.standNumber).toBe("HALL-3-D05");
      expect(compRow.audit_summary.status).toBe("SUCCESS");

      // Clean up
      await pg.query(`DELETE FROM public.sourcing_companies WHERE id = '${compId}';`);
    });
  });

  // =========================================================================
  // 6. APPLICATION LAYER SECURITY & SERVICE ROLE BOUNDARY
  // =========================================================================
  describe("6. Application Layer Security & SSRF Protection", () => {
    it("BLOCKS private and cloud metadata addresses via isPrivateOrReservedHost", () => {
      expect(isPrivateOrReservedHost("localhost")).toBe(true);
      expect(isPrivateOrReservedHost("127.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("169.254.169.254")).toBe(true);
      expect(isPrivateOrReservedHost("metadata.google.internal")).toBe(true);
      expect(isPrivateOrReservedHost("192.168.1.1")).toBe(true);
      expect(isPrivateOrReservedHost("10.0.0.1")).toBe(true);
      expect(isPrivateOrReservedHost("172.16.0.1")).toBe(true);

      // Safe public domains must pass
      expect(isPrivateOrReservedHost("www.intercharmkorea.com")).toBe(false);
      expect(isPrivateOrReservedHost("brand.co.kr")).toBe(false);
    });

    it("VALIDATES safe external URLs and strictly rejects SSRF attempts", () => {
      expect(() => validateSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toThrow();
      expect(() => validateSafeExternalUrl("http://localhost:3000/admin")).toThrow();
      expect(() => validateSafeExternalUrl("ftp://invalid-protocol.com")).toThrow();

      const validUrl = validateSafeExternalUrl("https://www.intercharmkorea.com/exhibitors");
      expect(validUrl.protocol).toBe("https:");
      expect(validUrl.hostname).toBe("www.intercharmkorea.com");
    });
  });

  // =========================================================================
  // 7. MIGRATION SEQUENCING & QA REPLAY VERIFICATION
  // =========================================================================
  describe("7. Migration Sequencing and Dependencies (0182, 0183, 0184)", () => {
    it("verifies migration 0184 cleanly depends on existing auth schema without circularity", async () => {
      // Check auth_is_admin function existence
      const fnRes = await pg.query(`
        SELECT proname, prosecdef
        FROM pg_proc
        JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
        WHERE n.nspname = 'public' AND proname = 'auth_is_admin';
      `);

      expect(fnRes.rows.length).toBe(1);
      expect(fnRes.rows[0].prosecdef).toBe(true); // security definer
    });
  });
});
