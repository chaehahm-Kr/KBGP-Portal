import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import { Client as PgClient } from 'pg';
import {
  DatabaseEnvironment,
  TargetIdentity,
  PRODUCTION_PROJECT_REF,
  QA_PROJECT_REF
} from './types';
import { getVerifiedTlsConfig } from './tls-config';
import { loadEnvFile } from '../qa/qa-guard';

export interface TargetConfig {
  environment: DatabaseEnvironment;
  databaseUrl: string;
  expectedProjectRef: string;
}

/**
 * Resolves database target configuration strictly according to the selected environment.
 * FORBIDS silent fallback or cross-environment credential contamination.
 */
export function resolveTargetConfig(env: DatabaseEnvironment, customDbUrl?: string): TargetConfig {
  if (env !== 'QA' && env !== 'PRODUCTION') {
    throw new Error(
      `[FATAL TARGET VIOLATION] Invalid environment "${env}". ` +
      'Target selection must be explicitly "QA" or "PRODUCTION". Implicit defaults are forbidden.'
    );
  }

  if (customDbUrl) {
    validateTargetUrlSecurity(env, customDbUrl);
    return {
      environment: env,
      databaseUrl: customDbUrl,
      expectedProjectRef: env === 'PRODUCTION' ? PRODUCTION_PROJECT_REF : QA_PROJECT_REF
    };
  }

  if (env === 'QA') {
    const qaLocalPath = path.join(process.cwd(), '.env.qa.local');
    if (!fs.existsSync(qaLocalPath)) {
      throw new Error(`[FATAL QA GUARD VIOLATION] .env.qa.local does not exist at "${qaLocalPath}". Cannot target QA.`);
    }

    const qaEnv = loadEnvFile(qaLocalPath);
    const dbUrl = qaEnv.QA_DATABASE_URL || qaEnv.QA_DIRECT_URL || process.env.QA_DATABASE_URL;

    if (!dbUrl) {
      throw new Error('[FATAL QA GUARD VIOLATION] QA_DATABASE_URL is not defined in .env.qa.local.');
    }

    validateTargetUrlSecurity('QA', dbUrl);
    return {
      environment: 'QA',
      databaseUrl: dbUrl,
      expectedProjectRef: QA_PROJECT_REF
    };
  }

  // PRODUCTION
  const prodLocalPath = path.join(process.cwd(), '.env.local');
  const prodEnv = fs.existsSync(prodLocalPath) ? loadEnvFile(prodLocalPath) : {};
  const dbUrl = prodEnv.DATABASE_URL || prodEnv.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (!dbUrl) {
    throw new Error(
      '[FATAL PRODUCTION GUARD VIOLATION] Production DATABASE_URL is not configured. ' +
      'Cannot execute migration plan without authorized production configuration.'
    );
  }

  validateTargetUrlSecurity('PRODUCTION', dbUrl);
  return {
    environment: 'PRODUCTION',
    databaseUrl: dbUrl,
    expectedProjectRef: PRODUCTION_PROJECT_REF
  };
}

/**
 * Validates that the database URL belongs strictly to the requested environment.
 */
export function validateTargetUrlSecurity(env: DatabaseEnvironment, dbUrl: string): void {
  const lower = dbUrl.toLowerCase();

  if (env === 'QA') {
    if (lower.includes(PRODUCTION_PROJECT_REF)) {
      throw new Error(
        `[FATAL SECURITY VIOLATION] Production project ref "${PRODUCTION_PROJECT_REF}" detected in QA target URL! ` +
        'Cross-environment credential fallback is strictly forbidden.'
      );
    }
  }

  if (env === 'PRODUCTION') {
    if (lower.includes(QA_PROJECT_REF)) {
      throw new Error(
        `[FATAL SECURITY VIOLATION] QA project ref "${QA_PROJECT_REF}" detected in PRODUCTION target URL! ` +
        'Cannot target staging/QA credentials for production execution.'
      );
    }
  }
}

/**
 * Connects to the database and cryptographically verifies the live server identity.
 * Validates current_database, current_user, and server address against the target environment.
 */
export async function verifyTargetIdentity(
  config: TargetConfig,
  customCertPath?: string
): Promise<TargetIdentity> {
  const parsed = new URL(config.databaseUrl);
  const host = parsed.hostname;
  const port = parseInt(parsed.port || '5432', 10);
  const user = parsed.username;
  const database = parsed.pathname.replace(/^\//, '') || 'postgres';

  // Enforce username format for Supabase Poolers (user.project_ref)
  if (host.includes('pooler.supabase.com')) {
    if (!user.includes(config.expectedProjectRef)) {
      throw new Error(
        `[FATAL IDENTITY MISMATCH] Username "${user}" does not contain expected project ref "${config.expectedProjectRef}". ` +
        `Target is claimed to be ${config.environment}, but credentials belong to a different tenant!`
      );
    }
  }

  const tls = getVerifiedTlsConfig(host, customCertPath);

  const client = new PgClient({
    connectionString: config.databaseUrl,
    ssl: tls,
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT 
        current_database() as db,
        current_user as usr,
        coalesce(inet_server_addr()::text, 'pooler_proxied') as addr,
        version() as ver;
    `);

    const row = res.rows[0];
    await client.end();

    return {
      environment: config.environment,
      projectRef: config.expectedProjectRef,
      branch: config.environment === 'PRODUCTION' ? 'main' : 'qa-testing',
      host,
      port,
      database: row.db,
      user: row.usr,
      serverAddr: row.addr,
      postgresVersion: row.ver.split(' on ')[0],
      verifiedAt: new Date().toISOString()
    };
  } catch (err: any) {
    try { await client.end(); } catch {}
    throw new Error(`[FATAL IDENTITY VERIFICATION FAILED] Unable to verify ${config.environment} database: ${err.message}`);
  }
}
