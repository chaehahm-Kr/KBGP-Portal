import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  resolveTargetConfig,
  validateTargetUrlSecurity
} from '../../../scripts/db-automation/target-guard';
import {
  getVerifiedTlsConfig
} from '../../../scripts/db-automation/tls-config';
import {
  detectDangerousStatements,
  checkTransactionSupport,
  computeSqlSha256,
  analyzeMigrationSql,
  calculateRiskLevel
} from '../../../scripts/db-automation/sql-analyzer';
import {
  loadRepositoryMigrationInventory,
  checkMigrationPrerequisites
} from '../../../scripts/db-automation/migration-inventory';
import * as crypto from 'crypto';
import {
  verifyProductionApprovalToken,
  assertAuthorization,
  buildApprovalCanonicalPayload
} from '../../../scripts/db-automation/authorization-guard';
import {
  maskSecrets,
  writeAuditLog
} from '../../../scripts/db-automation/audit-logger';
import {
  generateQaBaselineReconstructionPlan
} from '../../../scripts/db-automation/qa-baseline-planner';
import {
  prepareMigrationPlan
} from '../../../scripts/db-automation/migration-engine';
import {
  ExecutionReport,
  MigrationPlan,
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF
} from '../../../scripts/db-automation/types';

describe('DEV-DB-AUTO-001: SQL Migration Automation Safety Gates Suite', () => {

  // 1. TARGET SELECTION & ENVIRONMENT ISOLATION
  describe('Stage A & B: Target Guard & Isolation', () => {
    it('strictly rejects invalid environment strings with no implicit defaults', () => {
      expect(() => resolveTargetConfig('STAGING' as any)).toThrow(
        /Target selection must be explicitly "QA" or "PRODUCTION"/
      );
    });

    it('strictly blocks production project ref from being used in QA target URL (no credential fallback)', () => {
      const prodUrl = `postgresql://postgres:pass@aws-1-us-west-2.pooler.supabase.com:5432/postgres?ref=${PRODUCTION_PROJECT_REF}`;
      expect(() => validateTargetUrlSecurity('QA', prodUrl)).toThrow(
        /Production project ref "shzfrppdobpmrstcjfqu" detected in QA target URL/
      );
    });

    it('strictly blocks QA project ref from being used in PRODUCTION target URL (no credential fallback)', () => {
      const qaUrl = `postgresql://postgres:pass@aws-1-us-west-2.pooler.supabase.com:5432/postgres?ref=${QA_PROJECT_REF}`;
      expect(() => validateTargetUrlSecurity('PRODUCTION', qaUrl)).toThrow(
        /QA project ref "elkgizqgksshukxgcndy" detected in PRODUCTION target URL/
      );
    });
  });

  // 2. VERIFIED TLS CONFIGURATION & ENFORCEMENT
  describe('Section 8: Verified TLS Transport', () => {
    const originalEnv = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

    afterEach(() => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalEnv;
    });

    it('throws fatal security error if NODE_TLS_REJECT_UNAUTHORIZED=0 is set in environment', () => {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
      expect(() => getVerifiedTlsConfig('aws-1-us-west-2.pooler.supabase.com')).toThrow(
        /NODE_TLS_REJECT_UNAUTHORIZED=0 detected in environment/
      );
    });

    it('throws fatal security error if Root CA certificate file is missing', () => {
      expect(() => getVerifiedTlsConfig('aws-1-us-west-2.pooler.supabase.com', '/invalid/path/ca.crt')).toThrow(
        /Supabase Root CA certificate not found at/
      );
    });

    it('successfully loads official Supabase Root CA with rejectUnauthorized: true', () => {
      const tls = getVerifiedTlsConfig('aws-1-us-west-2.pooler.supabase.com');
      expect(tls.rejectUnauthorized).toBe(true);
      expect(tls.ca).toContain('-----BEGIN CERTIFICATE-----');
      expect(tls.servername).toBe('aws-1-us-west-2.pooler.supabase.com');
    });
  });

  // 3. PRE-FLIGHT SQL ANALYZER & DANGEROUS STATEMENTS
  describe('Stage D: Pre-Flight SQL Analyzer & Dangerous Statements', () => {
    it('detects DROP TABLE and classifies as CRITICAL risk', () => {
      const sql = 'DROP TABLE public.companies CASCADE;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'DROP TABLE')).toBe(true);
      expect(dangerous.some(d => d.type === 'CASCADE')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('CRITICAL');
    });

    it('detects DROP COLUMN and classifies as CRITICAL risk', () => {
      const sql = 'ALTER TABLE public.products DROP COLUMN status;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'DROP COLUMN')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('CRITICAL');
    });

    it('detects TRUNCATE and classifies as CRITICAL risk', () => {
      const sql = 'TRUNCATE TABLE public.retailer_orders;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'TRUNCATE')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('CRITICAL');
    });

    it('detects DISABLE ROW LEVEL SECURITY and classifies as CRITICAL risk', () => {
      const sql = 'ALTER TABLE public.stores DISABLE ROW LEVEL SECURITY;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'DISABLE RLS')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('CRITICAL');
    });

    it('detects DELETE FROM and classifies as HIGH risk', () => {
      const sql = 'DELETE FROM public.inquiries WHERE id = 123;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'DELETE')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('HIGH');
    });

    it('detects unbounded UPDATE and classifies as MEDIUM risk', () => {
      const sql = 'UPDATE public.products SET is_active = false;';
      const dangerous = detectDangerousStatements(sql);
      expect(dangerous.some(d => d.type === 'UNBOUNDED UPDATE')).toBe(true);
      expect(calculateRiskLevel(dangerous)).toBe('MEDIUM');
    });

    it('identifies non-transactional statements: CREATE INDEX CONCURRENTLY', () => {
      const sql = 'CREATE INDEX CONCURRENTLY idx_test ON public.orders(id);';
      const res = checkTransactionSupport(sql);
      expect(res.isTransactional).toBe(false);
      expect(res.reason).toContain('CREATE INDEX CONCURRENTLY');
    });

    it('identifies non-transactional statements: ALTER TYPE ... ADD VALUE', () => {
      const sql = "ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'retailer';";
      const res = checkTransactionSupport(sql);
      expect(res.isTransactional).toBe(false);
      expect(res.reason).toContain('ALTER TYPE ... ADD VALUE');
    });

    it('properly strips and handles UTF-8 Byte Order Mark (BOM)', () => {
      const sqlWithBom = '\uFEFF-- Leading comment\nALTER TABLE public.companies ALTER COLUMN country DROP NOT NULL;';
      const dangerous = detectDangerousStatements(sqlWithBom);
      expect(dangerous).toHaveLength(0);
    });

    it('identifies safe transactional statements as isTransactional: true', () => {
      const sql = 'CREATE TABLE IF NOT EXISTS public.test_table (id uuid primary key);';
      const res = checkTransactionSupport(sql);
      expect(res.isTransactional).toBe(true);
    });

    it('computes deterministic SHA256 checksum for SQL content', () => {
      const sha1 = computeSqlSha256('SELECT 1;');
      const sha2 = computeSqlSha256('SELECT 1;');
      const sha3 = computeSqlSha256('SELECT 2;');
      expect(sha1).toBe(sha2);
      expect(sha1).not.toBe(sha3);
    });
  });

  // 4. MIGRATION INVENTORY & DEPENDENCY GRAPH
  describe('Stage C: Repository Migration Inventory & Dependencies', () => {
    it('loads and sequences all repository migrations correctly', () => {
      const inventory = loadRepositoryMigrationInventory();
      expect(inventory.totalFiles).toBeGreaterThanOrEqual(190);
      expect(inventory.minVersion).toBe(1);
      expect(inventory.maxVersion).toBeGreaterThanOrEqual(183);
    });

    it('detects duplicate version numbers in the repository', () => {
      const inventory = loadRepositoryMigrationInventory();
      expect(inventory.duplicateVersions.length).toBe(14);
      const dupVersions = inventory.duplicateVersions.map(d => d.version);
      expect(dupVersions).toContain('0037');
      expect(dupVersions).toContain('0098');
      expect(dupVersions).toContain('0171');
    });

    it('detects missing foreign key dependencies (e.g. products table missing for 0182)', () => {
      const inventory = loadRepositoryMigrationInventory();
      const mig0182 = inventory.migrations.find(m => m.version === '0182')!;
      expect(mig0182).toBeDefined();

      // On a clean slate (empty tables), products is missing
      const cleanSlateTables: string[] = [];
      const prereqCheck = checkMigrationPrerequisites(mig0182, cleanSlateTables);
      expect(prereqCheck.isSatisfied).toBe(false);
      expect(prereqCheck.missingTables).toContain('products');

      // When products exists, prerequisite is satisfied
      const migratedTables = ['products'];
      const satisfiedCheck = checkMigrationPrerequisites(mig0182, migratedTables);
      expect(satisfiedCheck.isSatisfied).toBe(true);
    });
  });

  // 5. DIFFERENTIATED AUTHORIZATION GATES
  describe('Stage F: Differentiated Authorization Gates', () => {
    const gitSha = '7a4569ce282fac4e3614f626e64cc2e038e09435';

    const testKeyPair = crypto.generateKeyPairSync('ed25519');
    const testPublicKeyPem = testKeyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const testPrivateKeyPem = testKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

    const testMigration = {
      filename: '0182_product_performance_policy_system.sql',
      version: '0182',
      disambiguatedVersion: '0182',
      orderNumber: 182,
      filePath: '/path/0182.sql',
      sha256: 'abc123sha456def789',
      rawSqlLength: 1000,
      tablesCreated: ['product_performance_policies'],
      tablesReferenced: ['products'],
      columnsAdded: [],
      dangerousStatements: [],
      riskLevel: 'LOW' as const,
      isTransactional: true
    };

    const samplePlan: MigrationPlan = {
      planId: 'plan_test_123',
      environment: 'PRODUCTION',
      targetRef: PRODUCTION_PROJECT_REF,
      gitSha,
      createdAt: new Date().toISOString(),
      migrations: [testMigration],
      totalMigrations: 1,
      highRiskCount: 0,
      aggregateSqlDigest: 'test_aggregate_digest_1234567890abcdef',
      requiresOwnerApproval: true,
      recoveryProcedure: 'Restore from PITR backup'
    };

    function createMockApprovalToken(overrides?: Partial<any>): any {
      const baseToken = {
        environment: 'PRODUCTION' as const,
        targetProjectRef: PRODUCTION_PROJECT_REF,
        executionScope: 'PRODUCTION_MIGRATION' as const,
        tokenNonce: 'nonce_test_1234567890123456',
        approvedGitSha: gitSha,
        migrations: [
          {
            filename: testMigration.filename,
            version: testMigration.version,
            disambiguatedVersion: testMigration.disambiguatedVersion,
            sha256: testMigration.sha256,
            orderNumber: testMigration.orderNumber
          }
        ],
        aggregateSqlDigest: 'test_aggregate_digest_1234567890abcdef',
        approvedBy: 'Owner',
        approvedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ...overrides
      };

      const canonicalPayload = buildApprovalCanonicalPayload(baseToken);
      const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), testPrivateKeyPem).toString('hex');
      return {
        ...baseToken,
        signature
      };
    }

    it('allows QA execution with valid task scope and taskId', () => {
      const qaPlan: MigrationPlan = { ...samplePlan, environment: 'QA', targetRef: QA_PROJECT_REF };
      expect(() => {
        assertAuthorization('QA', qaPlan, gitSha, {
          environment: 'QA',
          taskId: 'DEV-DB-AUTO-001',
          approvedMigrationVersions: ['0182'],
          authorizedAt: new Date().toISOString()
        });
      }).not.toThrow();
    });

    it('strictly blocks QA execution when taskId is missing', () => {
      const qaPlan: MigrationPlan = { ...samplePlan, environment: 'QA', targetRef: QA_PROJECT_REF };
      expect(() => {
        assertAuthorization('QA', qaPlan, gitSha, {
          environment: 'QA',
          taskId: '',
          approvedMigrationVersions: ['0182'],
          authorizedAt: new Date().toISOString()
        });
      }).toThrow(/Missing Task ID in QA authorization/);
    });

    it('strictly blocks Production execution by default when approval token is missing', () => {
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, undefined, testPublicKeyPem);
      }).toThrow(/Production SQL execution is DISABLED by default/);
    });

    it('strictly blocks Production execution when token is signed for wrong migrations', () => {
      const wrongToken = createMockApprovalToken({
        migrations: [
          {
            filename: '0179_different_file.sql',
            version: '0179',
            disambiguatedVersion: '0179',
            sha256: 'other_sha_123456',
            orderNumber: 179
          }
        ]
      });
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, wrongToken, testPublicKeyPem);
      }).toThrow(/Migration filename mismatch/);
    });

    it('strictly blocks Production execution when token is signed for wrong Git SHA', () => {
      const wrongShaToken = createMockApprovalToken({ approvedGitSha: 'different_git_sha_123' });
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, wrongShaToken, testPublicKeyPem);
      }).toThrow(/Git SHA mismatch/);
    });

    it('strictly blocks Production execution when token has expired (stale approval)', () => {
      const expiredToken = createMockApprovalToken({
        expiresAt: new Date(Date.now() - 600000).toISOString() // Expired 10 min ago
      });
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, expiredToken, testPublicKeyPem);
      }).toThrow(/Approval token expired/);
    });

    it('strictly blocks Production execution when token signature is tampered with', () => {
      const validToken = createMockApprovalToken();
      const tamperedToken = { ...validToken, signature: 'deadbeef'.repeat(16) };
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, tamperedToken, testPublicKeyPem);
      }).toThrow(/Approval token signature is invalid/);
    });

    it('accepts valid Production approval token matching exact SHA, files, digest, and Ed25519 signature', () => {
      const validToken = createMockApprovalToken();
      expect(() => {
        assertAuthorization('PRODUCTION', samplePlan, gitSha, validToken, testPublicKeyPem);
      }).not.toThrow();
    });
  });

  // 6. SECRET MASKING & AUDIT LOGGING
  describe('Stage I: Secret Masking & Audit Logging', () => {
    it('masks database passwords in postgres URIs', () => {
      const raw = 'postgres://postgres:SuperSecretP@ssword123@aws-1-us-west-2.pooler.supabase.com:5432/postgres';
      const masked = maskSecrets(raw);
      expect(masked).not.toContain('SuperSecretP@ssword123');
      expect(masked).toContain('***MASKED***');
    });

    it('masks api keys and bearer tokens in logs', () => {
      const raw = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secretpayload.sig';
      const masked = maskSecrets(raw);
      expect(masked).not.toContain('secretpayload');
      expect(masked).toContain('***');
    });

    it('generates valid JSON and Markdown audit logs on disk', () => {
      const testReport: ExecutionReport = {
        taskId: 'DEV-TEST-001',
        planId: 'plan_test_abc',
        environment: 'QA',
        status: 'SUCCESS',
        migrationsAttempted: ['0182.sql'],
        migrationsSucceeded: ['0182.sql'],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        verification: {
          verifiedTablesCount: 1,
          verifiedRpcCount: 0,
          recordedMigrationsCount: 1,
          schemaDiscrepancies: [],
          isHealthy: true
        }
      };

      const outDir = path.join(process.cwd(), '.audit', 'test-migrations');
      const { jsonPath, mdPath } = writeAuditLog(testReport, outDir);

      expect(fs.existsSync(jsonPath)).toBe(true);
      expect(fs.existsSync(mdPath)).toBe(true);

      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      expect(jsonContent.taskId).toBe('DEV-TEST-001');
      expect(jsonContent.status).toBe('SUCCESS');

      // Cleanup test artifacts
      fs.unlinkSync(jsonPath);
      fs.unlinkSync(mdPath);
      fs.rmdirSync(outDir);
    });
  });

  // 7. QA BASELINE RECONSTRUCTION PLANNER
  describe('Section 9: QA Baseline Reconstruction Planner', () => {
    it('analyzes migrations and generates phased roadmap without mutations', () => {
      const baseline = generateQaBaselineReconstructionPlan();
      expect(baseline.totalFiles).toBeGreaterThanOrEqual(190);
      expect(baseline.reconstructionPhases.length).toBe(6);
      expect(baseline.duplicateVersionsAnalysis.length).toBe(14);
      expect(baseline.transactionRestrictedMigrations.length).toBe(1);
      expect(baseline.transactionRestrictedMigrations[0].filename).toContain('0096');
    });

    it('confirms migration 0182 cannot run directly on clean slate due to products dependency', () => {
      const baseline = generateQaBaselineReconstructionPlan();
      expect(baseline.migration0182Readiness.canExecuteDirectlyOnCleanSlate).toBe(false);
      expect(baseline.migration0182Readiness.prerequisiteTables).toContain('products');
    });
  });

  // 8. DUPLICATE VERSION RESOLUTION & DISAMBIGUATION (DEV-DB-AUTO-005)
  describe('Section 10: Duplicate Version Resolution & Disambiguation', () => {
    it('assigns unique disambiguatedVersion to all duplicate migration pairs', () => {
      const inventory = loadRepositoryMigrationInventory();
      expect(inventory.duplicateVersions.length).toBe(14);

      // Check version 0037 specifically
      const v0037 = inventory.migrationsByVersion.get('0037');
      expect(v0037).toBeDefined();
      expect(v0037!.length).toBe(2);
      expect(v0037![0].filename).toBe('0037_add_product_selling_fields.sql');
      expect(v0037![0].disambiguatedVersion).toBe('0037');
      expect(v0037![1].filename).toBe('0037_add_product_statuses.sql');
      expect(v0037![1].disambiguatedVersion).toBe('0037b');

      // Verify that across all 190 migrations, every disambiguatedVersion is completely unique
      const disambiguatedSet = new Set(inventory.migrations.map(m => m.disambiguatedVersion));
      expect(disambiguatedSet.size).toBe(inventory.totalFiles);
    });

    it('prepareMigrationPlan includes all duplicate files in sequence when base version is requested', () => {
      const plan = prepareMigrationPlan({
        environment: 'QA',
        currentGitSha: '7a4569ce282fac4e3614f626e64cc2e038e09435',
        targetMigrationVersions: ['0037']
      });

      expect(plan.totalMigrations).toBe(2);
      expect(plan.migrations[0].filename).toBe('0037_add_product_selling_fields.sql');
      expect(plan.migrations[0].disambiguatedVersion).toBe('0037');
      expect(plan.migrations[1].filename).toBe('0037_add_product_statuses.sql');
      expect(plan.migrations[1].disambiguatedVersion).toBe('0037b');
    });

    it('prepareMigrationPlan allows targeted selection via disambiguated version key', () => {
      const planA = prepareMigrationPlan({
        environment: 'QA',
        currentGitSha: '7a4569ce282fac4e3614f626e64cc2e038e09435',
        targetMigrationVersions: ['0037b']
      });

      expect(planA.totalMigrations).toBe(1);
      expect(planA.migrations[0].filename).toBe('0037_add_product_statuses.sql');
    });
  });
});
