import * as crypto from 'crypto';
import * as fs from 'fs';
// @ts-ignore
import { Client as PgClient } from 'pg';
import {
  DatabaseEnvironment,
  ExecutionReport,
  MigrationFileAnalysis,
  MigrationPlan,
  ProductionApprovalToken,
  QaTaskAuthorization,
  NONCE_STORE_SCHEMA,
  NONCE_STORE_TABLE,
  FULL_NONCE_STORE_PATH
} from './types';
import { resolveTargetConfig, verifyTargetIdentity, TargetConfig } from './target-guard';
import { loadRepositoryMigrationInventory } from './migration-inventory';
import { getVerifiedTlsConfig } from './tls-config';
import { withMigrationLock } from './lock-manager';
import { assertAuthorization } from './authorization-guard';
import { verifyDatabaseState } from './post-verification';
import { writeAuditLog } from './audit-logger';

export interface PlanOptions {
  environment: DatabaseEnvironment;
  targetMigrationVersions?: string[];
  currentGitSha: string;
  migrationsDir?: string;
  customDbUrl?: string;
}

export interface ExecuteOptions {
  plan: MigrationPlan;
  currentGitSha: string;
  auth?: ProductionApprovalToken | QaTaskAuthorization;
  ownerPublicKey?: string;
  dryRun?: boolean;
  taskId: string;
  customDbUrl?: string;
  customCertPath?: string;
}

/**
 * Computes an unambiguous SHA-256 aggregate digest across all ordered migrations.
 */
export function computeAggregateSqlDigest(
  migrations: Array<{
    filename: string;
    sha256: string;
    disambiguatedVersion?: string;
    version: string;
    orderNumber: number;
  }>
): string {
  const entries = migrations.map((m, idx) =>
    `${idx}:${m.filename}:${m.version}:${m.disambiguatedVersion || m.version}:${m.sha256}:${m.orderNumber}`
  );
  return crypto.createHash('sha256').update(entries.join('\n'), 'utf8').digest('hex');
}

/**
 * Stage E: Generates an immutable, risk-classified migration plan.
 */
export function prepareMigrationPlan(options: PlanOptions): MigrationPlan {
  const inventory = loadRepositoryMigrationInventory(options.migrationsDir);
  let selected: MigrationFileAnalysis[] = [];

  if (options.targetMigrationVersions && options.targetMigrationVersions.length > 0) {
    for (const v of options.targetMigrationVersions) {
      // 1. Try matching disambiguatedVersion or exact filename or filename prefix
      const directMatches = inventory.migrations.filter(m =>
        m.disambiguatedVersion === v ||
        m.filename === v ||
        m.filename === `${v}.sql` ||
        m.filename.startsWith(`${v}_`)
      );

      if (directMatches.length > 0) {
        for (const dm of directMatches) {
          if (!selected.some(s => s.filename === dm.filename)) {
            selected.push(dm);
          }
        }
      } else {
        // 2. Try matching base version (e.g. '0037' matching all files of that version)
        const baseMatches = inventory.migrations.filter(m => m.version === v);
        if (baseMatches.length > 0) {
          for (const bm of baseMatches) {
            if (!selected.some(s => s.filename === bm.filename)) {
              selected.push(bm);
            }
          }
        } else {
          throw new Error(`[MIGRATION PLAN ERROR] Requested migration version "${v}" not found in repository!`);
        }
      }
    }
  } else {
    // Default to all repository migrations in sequence
    selected = inventory.migrations.slice();
  }

  const highRisk = selected.filter(m => m.riskLevel === 'HIGH' || m.riskLevel === 'CRITICAL');
  const planId = `plan_${options.environment.toLowerCase()}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const aggregateSqlDigest = computeAggregateSqlDigest(selected);

  return {
    planId,
    environment: options.environment,
    targetRef: options.environment === 'PRODUCTION' ? 'shzfrppdobpmrstcjfqu' : 'elkgizqgksshukxgcndy',
    gitSha: options.currentGitSha,
    createdAt: new Date().toISOString(),
    migrations: selected,
    totalMigrations: selected.length,
    highRiskCount: highRisk.length,
    aggregateSqlDigest,
    requiresOwnerApproval: options.environment === 'PRODUCTION',
    recoveryProcedure: options.environment === 'PRODUCTION'
      ? 'Perform immediate point-in-time recovery via Supabase Dashboard backup if migration fails.'
      : 'Reset QA Preview Branch to clean state and re-run baseline plan.'
  };
}

/**
 * Stages F, G, H, I: Authorized, locked, and verified execution.
 */
export async function executeMigrationPlan(options: ExecuteOptions): Promise<ExecutionReport> {
  const startedAt = new Date().toISOString();
  const plan = options.plan;

  // 1. Dry Run check
  if (options.dryRun) {
    console.log(`[DRY RUN] Plan ${plan.planId} validated. Total migrations: ${plan.totalMigrations}. Zero DB mutations.`);
    return {
      taskId: options.taskId,
      planId: plan.planId,
      environment: plan.environment,
      status: 'DRY_RUN',
      migrationsAttempted: [],
      migrationsSucceeded: [],
      startedAt,
      completedAt: new Date().toISOString()
    };
  }

  // 2. Stage F: Assert Authorization Gates
  assertAuthorization(plan.environment, plan, options.currentGitSha, options.auth, options.ownerPublicKey);

  // 3. Stage B: Pre-Execution SQL Byte Verification & Immutability Buffer (TOCTOU & Integrity Protection)
  const verifiedSqlPayloads = new Map<string, string>();
  for (let i = 0; i < plan.migrations.length; i++) {
    const mig = plan.migrations[i];
    if (!fs.existsSync(mig.filePath)) {
      throw new Error(`[FATAL INTEGRITY VIOLATION] Planned migration file not found on disk: "${mig.filePath}"`);
    }
    const currentBytes = fs.readFileSync(mig.filePath, 'utf8');
    const currentSha256 = crypto.createHash('sha256').update(currentBytes, 'utf8').digest('hex');
    if (currentSha256 !== mig.sha256) {
      throw new Error(
        `[FATAL INTEGRITY VIOLATION] Migration SQL file "${mig.filename}" on disk has been mutated after plan creation! ` +
        `Planned SHA-256: ${mig.sha256}, Current Disk SHA-256: ${currentSha256}. Execution aborted.`
      );
    }
    if (plan.environment === 'PRODUCTION') {
      const token = options.auth as ProductionApprovalToken;
      const approvedItem = token.migrations[i];
      if (!approvedItem || approvedItem.sha256 !== currentSha256 || approvedItem.filename !== mig.filename) {
        throw new Error(
          `[FATAL INTEGRITY VIOLATION] Migration file "${mig.filename}" does not match approved token item at index ${i}! Execution aborted.`
        );
      }
    }
    verifiedSqlPayloads.set(mig.filename, currentBytes);
  }

  const diskAggregateDigest = computeAggregateSqlDigest(plan.migrations);
  if (diskAggregateDigest !== plan.aggregateSqlDigest) {
    throw new Error(
      `[FATAL INTEGRITY VIOLATION] Aggregate SQL digest mismatch! ` +
      `Planned: ${plan.aggregateSqlDigest}, Current Disk: ${diskAggregateDigest}. Execution aborted.`
    );
  }

  if (plan.environment === 'PRODUCTION') {
    const token = options.auth as ProductionApprovalToken;
    if (diskAggregateDigest !== token.aggregateSqlDigest) {
      throw new Error(
        `[FATAL INTEGRITY VIOLATION] Current disk digest "${diskAggregateDigest}" does not match approved token digest "${token.aggregateSqlDigest}"! Execution aborted.`
      );
    }
  }

  // 4. Target & Identity Verification
  const targetConfig = resolveTargetConfig(plan.environment, options.customDbUrl);
  const targetIdentity = await verifyTargetIdentity(targetConfig, options.customCertPath);

  // 5. Connect with Verified TLS
  const parsed = new URL(targetConfig.databaseUrl);
  const tls = getVerifiedTlsConfig(parsed.hostname, options.customCertPath);

  const client = new PgClient({
    connectionString: targetConfig.databaseUrl,
    ssl: tls,
    connectionTimeoutMillis: 5000
  });

  await client.connect();

  const attempted: string[] = [];
  const succeeded: string[] = [];
  let failedMigration: string | undefined = undefined;
  let executionError: string | undefined = undefined;

  try {
    // Acquire Advisory Lock to prevent concurrent execution
    await withMigrationLock(client, async () => {
      if (plan.environment === 'QA') {
        // In QA: Ensure schema & table exist matching official Supabase CLI spec
        await client.query(`CREATE SCHEMA IF NOT EXISTS supabase_migrations;`);
        await client.query(`
          CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
            version TEXT PRIMARY KEY,
            statements TEXT[],
            name TEXT
          );
        `);
      } else {
        // In PRODUCTION: Verify dedicated private administrative nonce store exists in _kselect_ops
        // FAIL CLOSED: No fallback store, no auto-create schema or table
        const nonceTableCheck = await client.query(`
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = $1 
            AND table_name = $2;
        `, [NONCE_STORE_SCHEMA, NONCE_STORE_TABLE]);

        if (nonceTableCheck.rows.length === 0) {
          throw new Error(
            `[FATAL REPLAY SECURITY ERROR] Trusted private nonce store table "${FULL_NONCE_STORE_PATH}" ` +
            'does not exist in Production database. Automatic schema/table creation or fallback during authorization is strictly forbidden. Execution failed closed.'
          );
        }

        // Atomically record token nonce consumption in _kselect_ops before any migration runs
        const token = options.auth as ProductionApprovalToken;
        try {
          await client.query(`
            INSERT INTO _kselect_ops.consumed_approval_tokens (
              nonce,
              plan_id,
              git_sha,
              aggregate_digest,
              approved_by,
              consumed_at,
              status
            ) VALUES ($1, $2, $3, $4, $5, now(), 'CONSUMED');
          `, [
            token.tokenNonce,
            plan.planId,
            token.approvedGitSha,
            token.aggregateSqlDigest,
            token.approvedBy
          ]);
        } catch (nonceErr: any) {
          if (nonceErr.code === '23505' || nonceErr.message?.includes('duplicate key') || nonceErr.message?.includes('unique constraint')) {
            throw new Error(
              `[FATAL REPLAY ATTACK DETECTED] Approval token nonce "${token.tokenNonce}" has already been consumed in "${FULL_NONCE_STORE_PATH}"! ` +
              'Replay of previously used approval tokens is strictly forbidden. Execution aborted.'
            );
          }
          if (nonceErr.code === '42501' || nonceErr.message?.includes('permission denied')) {
            throw new Error(
              `[FATAL SECURITY PERMISSION ERROR] Permission denied accessing private nonce store "${FULL_NONCE_STORE_PATH}". ` +
              'Execution role lacks required INSERT privileges. Execution failed closed.'
            );
          }
          throw new Error(`[FATAL NONCE STORE ERROR] Failed to record token consumption: ${nonceErr.message}`);
        }
      }

      // Pre-query applied migrations (Idempotency Skip Gate)
      const appliedRes = await client.query(`SELECT version FROM supabase_migrations.schema_migrations;`);
      const appliedVersions = new Set(appliedRes.rows.map((r: any) => r.version));

      for (const mig of plan.migrations) {
        const versionToRecord = mig.disambiguatedVersion || mig.version;
        if (appliedVersions.has(versionToRecord)) {
          console.log(`[SKIP] Migration ${mig.filename} (${versionToRecord}) is already recorded in schema_migrations. Skipping execution.`);
          succeeded.push(mig.filename);
          continue;
        }

        attempted.push(mig.filename);
        const sql = verifiedSqlPayloads.get(mig.filename);
        if (!sql) {
          throw new Error(`[FATAL EXECUTION INTEGRITY] Verified SQL payload missing for ${mig.filename}`);
        }
        const migName = mig.filename.replace(/^\d{4}_/, '').replace(/\.sql$/, '');
        // Strip UTF-8 Byte Order Mark (BOM) if present before sending to PostgreSQL
        const executionSql = sql.replace(/^\uFEFF+/, '');

        // Check if there is an explicit, narrowly scoped transactional exception for QA
        const isAuthorizedTransactionalException =
          plan.environment === 'QA' &&
          options.auth &&
          'authorizedTransactionalExceptions' in options.auth &&
          Boolean((options.auth as any).authorizedTransactionalExceptions?.some(
            (e: any) => e.filename === mig.filename && e.sha256 === mig.sha256
          ));

        const isEffectiveTransactional = mig.isTransactional || isAuthorizedTransactionalException;

        if (isAuthorizedTransactionalException) {
          console.log(`[TRANSACTIONAL EXCEPTION] Migration ${mig.filename} authorized by exact hash to execute inside its own BEGIN ... COMMIT transaction.`);
        }

        console.log(`[EXECUTE] Applying ${mig.filename} (${isEffectiveTransactional ? 'Transactional' : 'Non-Transactional'})...`);

        if (isEffectiveTransactional) {
          await client.query('BEGIN;');
          try {
            await client.query(executionSql);
            await client.query(`
              INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
              VALUES ($1, $2, $3)
              ON CONFLICT (version) DO NOTHING;
            `, [versionToRecord, migName, [executionSql]]);
            await client.query('COMMIT;');
            succeeded.push(mig.filename);
          } catch (migErr: any) {
            await client.query('ROLLBACK;');
            failedMigration = mig.filename;
            executionError = migErr.message;
            throw new Error(`[MIGRATION FAILED] ${mig.filename}: ${migErr.message}`);
          }
        } else {
          // If any other migration is nontransactional and NOT explicitly authorized, fail closed!
          throw new Error(
            `[FATAL NON-TRANSACTIONAL SAFETY GATE] Migration ${mig.filename} is non-transactional and has no authorized transactional exception. ` +
            'Unauthorized autocommit fallback is strictly prohibited. Execution aborted.'
          );
        }
      }
    });

    // 5. Stage H: Post-Execution Verification
    const expectedTables = plan.migrations.flatMap(m => m.tablesCreated);
    const verification = await verifyDatabaseState(client, expectedTables);

    // Update status in private nonce store upon completion
    if (plan.environment === 'PRODUCTION' && options.auth) {
      const token = options.auth as ProductionApprovalToken;
      try {
        await client.query(`
          UPDATE _kselect_ops.consumed_approval_tokens 
          SET status = 'COMPLETED' 
          WHERE nonce = $1;
        `, [token.tokenNonce]);
      } catch {}
    }

    const report: ExecutionReport = {
      taskId: options.taskId,
      planId: plan.planId,
      environment: plan.environment,
      status: 'SUCCESS',
      targetIdentity,
      migrationsAttempted: attempted,
      migrationsSucceeded: succeeded,
      startedAt,
      completedAt: new Date().toISOString(),
      verification
    };

    // 6. Stage I: Audit Logging
    const auditPaths = writeAuditLog(report);
    report.auditLogPath = auditPaths.mdPath;

    return report;

  } catch (err: any) {
    // Record failure in private nonce store
    if (plan.environment === 'PRODUCTION' && options.auth) {
      const token = options.auth as ProductionApprovalToken;
      try {
        await client.query(`
          UPDATE _kselect_ops.consumed_approval_tokens 
          SET status = 'FAILED', execution_error = $1 
          WHERE nonce = $2;
        `, [executionError || err.message, token.tokenNonce]);
      } catch {}
    }

    const report: ExecutionReport = {
      taskId: options.taskId,
      planId: plan.planId,
      environment: plan.environment,
      status: 'FAILED',
      targetIdentity,
      migrationsAttempted: attempted,
      migrationsSucceeded: succeeded,
      failedMigration,
      error: executionError || err.message,
      startedAt,
      completedAt: new Date().toISOString()
    };

    writeAuditLog(report);
    return report;
  } finally {
    await client.end();
  }
}
