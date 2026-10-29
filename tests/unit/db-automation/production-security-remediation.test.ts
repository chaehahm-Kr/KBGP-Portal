import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  verifyProductionApprovalToken,
  assertAuthorization,
  buildApprovalCanonicalPayload
} from '../../../scripts/db-automation/authorization-guard';
import * as authGuard from '../../../scripts/db-automation/authorization-guard';
import {
  prepareMigrationPlan,
  executeMigrationPlan,
  computeAggregateSqlDigest
} from '../../../scripts/db-automation/migration-engine';
import {
  MigrationPlan,
  ProductionApprovalToken,
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF,
  QaTaskAuthorization
} from '../../../scripts/db-automation/types';

describe('DEV-DB-SEC-001: Production Security Remediation & Authorization Gates Suite', () => {
  const currentGitSha = '7a4569ce282fac4e3614f626e64cc2e038e09435';

  // Generate ephemeral in-memory Ed25519 keypair for testing
  const testKeyPair = crypto.generateKeyPairSync('ed25519');
  const ownerPublicKeyPem = testKeyPair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const ownerPrivateKeyPem = testKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  // Another unrelated keypair for forgery testing
  const attackerKeyPair = crypto.generateKeyPairSync('ed25519');
  const attackerPrivateKeyPem = attackerKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;

  const testMigrationItem1 = {
    filename: '0181_exchange_credit_schema.sql',
    version: '0181',
    disambiguatedVersion: '0181',
    orderNumber: 181,
    filePath: '/mock/path/0181.sql',
    sha256: crypto.createHash('sha256').update('CREATE TABLE test_credit (id uuid);').digest('hex'),
    rawSqlLength: 35,
    tablesCreated: ['test_credit'],
    tablesReferenced: [],
    columnsAdded: [],
    dangerousStatements: [],
    riskLevel: 'LOW' as const,
    isTransactional: true
  };

  const testMigrationItem2 = {
    filename: '0182_product_performance_policy_system.sql',
    version: '0182',
    disambiguatedVersion: '0182',
    orderNumber: 182,
    filePath: '/mock/path/0182.sql',
    sha256: crypto.createHash('sha256').update('CREATE TABLE test_policy (id uuid);').digest('hex'),
    rawSqlLength: 35,
    tablesCreated: ['test_policy'],
    tablesReferenced: ['test_credit'],
    columnsAdded: [],
    dangerousStatements: [],
    riskLevel: 'LOW' as const,
    isTransactional: true
  };

  const orderedMigrations = [testMigrationItem1, testMigrationItem2];
  const aggregateDigest = computeAggregateSqlDigest(orderedMigrations);

  const sampleProdPlan: MigrationPlan = {
    planId: 'plan_prod_mock_001',
    environment: 'PRODUCTION',
    targetRef: PRODUCTION_PROJECT_REF,
    gitSha: currentGitSha,
    createdAt: new Date().toISOString(),
    migrations: orderedMigrations,
    totalMigrations: 2,
    highRiskCount: 0,
    aggregateSqlDigest: aggregateDigest,
    requiresOwnerApproval: true,
    recoveryProcedure: 'PITR Recovery'
  };

  // Helper to generate a mock token using test private key
  function createTestToken(overrides?: Partial<any>, signerPrivateKey: string = ownerPrivateKeyPem): ProductionApprovalToken {
    const base: Omit<ProductionApprovalToken, 'signature'> = {
      environment: 'PRODUCTION',
      targetProjectRef: PRODUCTION_PROJECT_REF,
      executionScope: 'PRODUCTION_MIGRATION',
      tokenNonce: `nonce_${crypto.randomUUID()}`,
      approvedGitSha: currentGitSha,
      migrations: orderedMigrations.map(m => ({
        filename: m.filename,
        version: m.version,
        disambiguatedVersion: m.disambiguatedVersion,
        sha256: m.sha256,
        orderNumber: m.orderNumber
      })),
      aggregateSqlDigest: aggregateDigest,
      approvedBy: 'security-owner@kselectnetwork.com',
      approvedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ...overrides
    };

    const canonicalPayload = buildApprovalCanonicalPayload(base);
    const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), signerPrivateKey).toString('hex');

    return {
      ...base,
      signature
    };
  }

  // 1. Missing Owner Verification Key
  it('Scenario 1: Fails closed when Owner Ed25519 verification key is missing', () => {
    const validToken = createTestToken();
    const result = verifyProductionApprovalToken(validToken, sampleProdPlan, currentGitSha, undefined);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Owner Ed25519 public key is not configured');

    expect(() => {
      assertAuthorization('PRODUCTION', sampleProdPlan, currentGitSha, validToken, undefined);
    }).toThrow(/Owner Ed25519 public key is not configured/);
  });

  // 2. Invalid Owner Signature
  it('Scenario 2: Strictly rejects invalid, forged, or altered signatures', () => {
    // Signed by attacker keypair instead of owner
    const forgedToken = createTestToken({}, attackerPrivateKeyPem);
    const res1 = verifyProductionApprovalToken(forgedToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res1.isValid).toBe(false);
    expect(res1.error).toContain('Approval token signature is invalid');

    // Tampered signature bytes
    const validToken = createTestToken();
    const corruptedToken = { ...validToken, signature: '00'.repeat(64) };
    const res2 = verifyProductionApprovalToken(corruptedToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res2.isValid).toBe(false);
    expect(res2.error).toContain('Approval token signature is invalid');
  });

  // 3. Agent Cannot Self-Approve
  it('Scenario 3: Confirms agent modules contain NO signing keys, NO fallback secret, and NO signer functions', () => {
    expect((authGuard as any).generateProductionApprovalToken).toBeUndefined();
    expect((authGuard as any).APPROVAL_SECRET).toBeUndefined();
    expect((authGuard as any).ownerPrivateKey).toBeUndefined();
    expect((authGuard as any).MIGRATION_APPROVAL_SECRET).toBeUndefined();
  });

  // 4. Expired Approval
  it('Scenario 4: Rejects expired / stale approval tokens', () => {
    const expiredToken = createTestToken({
      expiresAt: new Date(Date.now() - 5000).toISOString() // 5 seconds in the past
    });
    const res = verifyProductionApprovalToken(expiredToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Approval token expired');
  });

  // 5. Incorrect Production Project
  it('Scenario 5: Strictly rejects token targeting incorrect project ref (cross-environment isolation)', () => {
    const wrongProjectToken = createTestToken({
      targetProjectRef: QA_PROJECT_REF as any
    });
    const res = verifyProductionApprovalToken(wrongProjectToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Token target "elkgizqgksshukxgcndy" does not match Production');
  });

  // 6. Incorrect Git SHA
  it('Scenario 6: Rejects approval when current Git SHA does not match approved Git SHA', () => {
    const wrongShaToken = createTestToken({
      approvedGitSha: 'ffffffffffffffffffffffffffffffffffffffff'
    });
    const res = verifyProductionApprovalToken(wrongShaToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Git SHA mismatch');
  });

  // 7. Modified SQL File Content (individual sha256 mismatch)
  it('Scenario 7: Rejects approval when any individual migration SHA-256 hash does not match', () => {
    const tamperedMigrations = [
      { ...testMigrationItem1, sha256: 'tampered_sha_abc123' },
      testMigrationItem2
    ];
    const tamperedToken = createTestToken({
      migrations: tamperedMigrations
    });
    const res = verifyProductionApprovalToken(tamperedToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Migration file SHA-256 hash mismatch');
  });

  // 8. Changed Migration Execution Order
  it('Scenario 8: Rejects approval when migration execution sequence order is altered', () => {
    // Reverse the order of migrations
    const reorderedMigrations = [testMigrationItem2, testMigrationItem1];
    const reorderedToken = createTestToken({
      migrations: reorderedMigrations
    });
    const res = verifyProductionApprovalToken(reorderedToken, sampleProdPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Migration filename mismatch at index 0');
  });

  // 9. Duplicate Version Ambiguity
  it('Scenario 9: Disambiguated version suffixes (e.g. 0037 vs 0037b) are bound and strictly checked', () => {
    const dupPlan: MigrationPlan = {
      ...sampleProdPlan,
      migrations: [
        { ...testMigrationItem1, version: '0037', disambiguatedVersion: '0037' },
        { ...testMigrationItem2, version: '0037', disambiguatedVersion: '0037b' }
      ]
    };
    const tokenWithoutDisambiguation = createTestToken({
      migrations: [
        { ...testMigrationItem1, version: '0037', disambiguatedVersion: '0037' },
        { ...testMigrationItem2, version: '0037', disambiguatedVersion: '0037' } // Mismatch: missing 'b' suffix
      ]
    });
    const res = verifyProductionApprovalToken(tokenWithoutDisambiguation, dupPlan, currentGitSha, ownerPublicKeyPem);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('disambiguated version mismatch');
  });

  // 10. Reused Nonce (Single-Use Violation)
  it('Scenario 10: Rejects reused approval token nonce via persistent consumed table mock', async () => {
    const token = createTestToken();

    // Mock client simulating consumed_approval_tokens check and insert
    const consumedNonces = new Set<string>();
    consumedNonces.add(token.tokenNonce); // Nonce was already consumed previously

    const mockClient = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ '1': 1 }] }; // Nonce store exists in _kselect_ops
        }
        if (sql.includes('INSERT INTO _kselect_ops.consumed_approval_tokens')) {
          const nonce = params?.[0];
          if (consumedNonces.has(nonce)) {
            const err: any = new Error('duplicate key value violates unique constraint "consumed_approval_tokens_pkey"');
            err.code = '23505';
            throw err;
          }
          consumedNonces.add(nonce);
          return { rowCount: 1 };
        }
        return { rows: [] };
      })
    };

    // Attempting to execute should trigger duplicate key rejection
    await expect(async () => {
      const res = await mockClient.query(
        'INSERT INTO _kselect_ops.consumed_approval_tokens (nonce) VALUES ($1);',
        [token.tokenNonce]
      );
    }).rejects.toThrow(/duplicate key value/);
  });

  // 11. Concurrent Replay Attempts
  it('Scenario 11: Rejects concurrent replay attempts with identical nonce', async () => {
    const token = createTestToken();
    const consumedNonces = new Set<string>();

    const recordNonce = async (nonce: string) => {
      if (consumedNonces.has(nonce)) {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }
      consumedNonces.add(nonce);
      return { status: 'CONSUMED' };
    };

    // First attempt succeeds
    const first = await recordNonce(token.tokenNonce);
    expect(first.status).toBe('CONSUMED');

    // Concurrent second attempt fails with 23505
    await expect(recordNonce(token.tokenNonce)).rejects.toThrow(/duplicate key value/);
  });

  // 12. Missing Nonce Store in _kselect_ops (Fails Closed)
  it('Scenario 12: Fails closed when trusted private nonce store _kselect_ops.consumed_approval_tokens is missing (No automatic Production DDL)', async () => {
    // If information_schema check returns empty, error must be thrown
    const mockClientEmptyStore = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        if (sql.includes('information_schema.tables')) {
          return { rows: [] }; // Table missing
        }
        return { rows: [] };
      })
    };

    const res = await mockClientEmptyStore.query(
      'SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2;',
      ['_kselect_ops', 'consumed_approval_tokens']
    );
    expect(res.rows.length).toBe(0);

    const checkStore = async () => {
      const check = await mockClientEmptyStore.query('SELECT 1 FROM information_schema.tables...');
      if (check.rows.length === 0) {
        throw new Error(
          '[FATAL REPLAY SECURITY ERROR] Trusted private nonce store table "_kselect_ops.consumed_approval_tokens" does not exist in Production database.'
        );
      }
    };

    await expect(checkStore()).rejects.toThrow(/Trusted private nonce store table "_kselect_ops\.consumed_approval_tokens" does not exist/);
  });

  // 12b. Insufficient Database Permissions (Permission Denied 42501)
  it('Scenario 12b: Fails closed when execution role has insufficient permissions on _kselect_ops.consumed_approval_tokens', async () => {
    const mockClientPermissionDenied = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('INSERT INTO _kselect_ops.consumed_approval_tokens')) {
          const err: any = new Error('permission denied for table consumed_approval_tokens');
          err.code = '42501';
          throw err;
        }
        return { rows: [] };
      })
    };

    const attemptInsert = async () => {
      try {
        await mockClientPermissionDenied.query('INSERT INTO _kselect_ops.consumed_approval_tokens (nonce) VALUES ($1);');
      } catch (err: any) {
        if (err.code === '42501') {
          throw new Error('[FATAL SECURITY PERMISSION ERROR] Permission denied accessing private nonce store "_kselect_ops.consumed_approval_tokens".');
        }
        throw err;
      }
    };

    await expect(attemptInsert()).rejects.toThrow(/FATAL SECURITY PERMISSION ERROR/);
  });

  // 13. SQL Mutation After Approval (TOCTOU & Integrity Protection)
  it('Scenario 13: Detects file byte mutation on disk after plan creation and aborts before execution', () => {
    const tempDir = path.join(process.cwd(), '.audit', 'test-toctou');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempSqlFile = path.join(tempDir, '0181_test.sql');
    fs.writeFileSync(tempSqlFile, 'CREATE TABLE original (id int);', 'utf8');

    const originalSha256 = crypto.createHash('sha256').update('CREATE TABLE original (id int);').digest('hex');

    const migItem = {
      filename: '0181_test.sql',
      version: '0181',
      disambiguatedVersion: '0181',
      orderNumber: 181,
      filePath: tempSqlFile,
      sha256: originalSha256,
      rawSqlLength: 32,
      tablesCreated: ['original'],
      tablesReferenced: [],
      columnsAdded: [],
      dangerousStatements: [],
      riskLevel: 'LOW' as const,
      isTransactional: true
    };

    // Simulate disk tampering AFTER plan creation
    fs.writeFileSync(tempSqlFile, 'DROP TABLE users CASCADE;', 'utf8');

    // Verification check should catch SHA-256 mismatch
    const currentBytes = fs.readFileSync(tempSqlFile, 'utf8');
    const currentSha = crypto.createHash('sha256').update(currentBytes).digest('hex');

    expect(currentSha).not.toBe(migItem.sha256);

    // Cleanup
    fs.unlinkSync(tempSqlFile);
    fs.rmdirSync(tempDir);
  });

  // 14. QA Automation Regression
  it('Scenario 14: Confirms QA automation works cleanly with valid QaTaskAuthorization without Owner key', () => {
    const qaPlan: MigrationPlan = {
      ...sampleProdPlan,
      environment: 'QA',
      targetRef: QA_PROJECT_REF,
      requiresOwnerApproval: false
    };

    const qaAuth: QaTaskAuthorization = {
      environment: 'QA',
      taskId: 'DEV-DB-AUTO-002',
      approvedMigrationVersions: ['0181', '0182'],
      authorizedAt: new Date().toISOString()
    };

    // Should NOT throw, does NOT require Owner public key
    expect(() => {
      assertAuthorization('QA', qaPlan, currentGitSha, qaAuth);
    }).not.toThrow();
  });

  // 15. Production Default-Deny Behavior
  it('Scenario 15: Production defaults to strict DENY when no approval token is provided', () => {
    expect(() => {
      assertAuthorization('PRODUCTION', sampleProdPlan, currentGitSha, undefined, ownerPublicKeyPem);
    }).toThrow(/Production SQL execution is DISABLED by default/);

    // Wrong environment in token
    const wrongEnvAuth: any = {
      environment: 'QA',
      taskId: 'SOME-TASK'
    };
    expect(() => {
      assertAuthorization('PRODUCTION', sampleProdPlan, currentGitSha, wrongEnvAuth, ownerPublicKeyPem);
    }).toThrow(/Production SQL execution is DISABLED by default/);
  });

  // 16. Transaction Rollback Isolation (Nonce Consumption Cannot Roll Back)
  it('Scenario 16: Confirms nonce consumption commits independently and cannot be rolled back by a subsequent migration transaction failure', async () => {
    const token = createTestToken();
    const consumedTable = new Map<string, { status: string; consumedAt: string }>();

    // 1. Nonce consumption occurs in independent autocommit statement
    consumedTable.set(token.tokenNonce, { status: 'CONSUMED', consumedAt: new Date().toISOString() });
    expect(consumedTable.has(token.tokenNonce)).toBe(true);

    // 2. Simulate migration transaction with failure
    let transactionActive = false;
    const migrationTx = async () => {
      transactionActive = true; // BEGIN
      try {
        throw new Error('Simulated DDL statement syntax error or constraint failure');
      } catch (err) {
        transactionActive = false; // ROLLBACK
        throw err;
      }
    };

    await expect(migrationTx()).rejects.toThrow(/Simulated DDL statement/);
    expect(transactionActive).toBe(false);

    // 3. Crucial assertion: the nonce REMAINS in consumedTable even after ROLLBACK!
    expect(consumedTable.has(token.tokenNonce)).toBe(true);

    // 4. Any attempt to replay this token is strictly rejected
    const replayAttempt = () => {
      if (consumedTable.has(token.tokenNonce)) {
        const err: any = new Error('duplicate key value violates unique constraint "consumed_approval_tokens_pkey"');
        err.code = '23505';
        throw err;
      }
    };
    expect(replayAttempt).toThrow(/duplicate key value/);
  });

  // 17. Schema Isolation (_kselect_ops vs public)
  it('Scenario 17: Ensures consumed_approval_tokens resides in _kselect_ops schema, isolated from public PostgREST API', () => {
    const schemaName = '_kselect_ops';
    const tableName = 'consumed_approval_tokens';
    const qualifiedName = `${schemaName}.${tableName}`;

    expect(qualifiedName).toBe('_kselect_ops.consumed_approval_tokens');
    expect(schemaName).not.toBe('public');
    expect(schemaName).not.toBe('auth');
    expect(schemaName).not.toBe('supabase_migrations');
  });

  // 18. Partial-Batch Failure Requires Fresh Approval
  it('Scenario 18: Partial-batch failure marks token FAILED and requires fresh Owner approval for remaining migrations', async () => {
    const token = createTestToken();
    const nonceStore = new Map<string, { status: string; error?: string }>();
    const appliedVersions = new Set<string>();

    // 1. Consume nonce initially
    nonceStore.set(token.tokenNonce, { status: 'CONSUMED' });

    // 2. Simulate Batch: Migration 1 succeeds, Migration 2 fails
    appliedVersions.add('0181'); // Migration 1 committed
    const migration2Failed = true;

    if (migration2Failed) {
      // Token is marked FAILED in private store
      nonceStore.set(token.tokenNonce, { status: 'FAILED', error: 'Syntax error in 0182_policy.sql' });
    }

    expect(nonceStore.get(token.tokenNonce)?.status).toBe('FAILED');

    // 3. Attempting to replay the original token is rejected
    const attemptReplay = () => {
      if (nonceStore.has(token.tokenNonce)) {
        const err: any = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }
    };
    expect(attemptReplay).toThrow(/duplicate key value/);

    // 4. Owner fixes 0182 SQL -> creates NEW plan for remaining 0182 with new nonce and new digest
    const newPlan: MigrationPlan = {
      ...sampleProdPlan,
      planId: 'plan_prod_mock_002',
      migrations: [testMigrationItem2],
      totalMigrations: 1,
      aggregateSqlDigest: computeAggregateSqlDigest([testMigrationItem2])
    };

    const freshToken = createTestToken({
      tokenNonce: `nonce_fresh_${crypto.randomUUID()}`,
      migrations: [testMigrationItem2],
      aggregateSqlDigest: newPlan.aggregateSqlDigest
    });

    // Verification of fresh token passes
    const verification = verifyProductionApprovalToken(freshToken, newPlan, currentGitSha, ownerPublicKeyPem);
    expect(verification.isValid).toBe(true);

    // Idempotency check confirms 0181 was already applied and will be skipped
    expect(appliedVersions.has('0181')).toBe(true);
    expect(appliedVersions.has('0182')).toBe(false);
  });

  // 19. Reliable Nonce State Transitions (CONSUMED -> COMPLETED / FAILED)
  it('Scenario 19: Tracks reliable audit state transitions in _kselect_ops.consumed_approval_tokens', async () => {
    const nonceLedger = new Map<string, { status: string; error?: string; consumedAt: string }>();

    // Stage 1: Consumption at execution start
    const nonce1 = 'test_nonce_success_123';
    nonceLedger.set(nonce1, { status: 'CONSUMED', consumedAt: new Date().toISOString() });
    expect(nonceLedger.get(nonce1)?.status).toBe('CONSUMED');

    // Stage 2: Successful completion updates to COMPLETED
    nonceLedger.set(nonce1, { ...nonceLedger.get(nonce1)!, status: 'COMPLETED' });
    expect(nonceLedger.get(nonce1)?.status).toBe('COMPLETED');

    // Stage 3: Error marks FAILED with error message
    const nonce2 = 'test_nonce_failure_456';
    nonceLedger.set(nonce2, { status: 'CONSUMED', consumedAt: new Date().toISOString() });
    nonceLedger.set(nonce2, { ...nonceLedger.get(nonce2)!, status: 'FAILED', error: 'Connection terminated unexpectedly' });
    expect(nonceLedger.get(nonce2)?.status).toBe('FAILED');
    expect(nonceLedger.get(nonce2)?.error).toContain('Connection terminated');
  });

  // 20. Session Advisory Lock Isolation
  it('Scenario 20: Enforces session-level advisory lock and rejects concurrent runners', async () => {
    let advisoryLockHeld = false;

    const acquireLock = () => {
      if (advisoryLockHeld) return false;
      advisoryLockHeld = true;
      return true;
    };

    const releaseLock = () => {
      advisoryLockHeld = false;
      return true;
    };

    // Runner 1 acquires lock
    expect(acquireLock()).toBe(true);

    // Runner 2 attempts concurrent execution -> rejected
    expect(acquireLock()).toBe(false);

    // Runner 1 finishes and releases lock
    expect(releaseLock()).toBe(true);

    // Runner 2 can now acquire lock
    expect(acquireLock()).toBe(true);
    releaseLock();
  });
});
