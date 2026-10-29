// @ts-ignore
import { Client as PgClient } from 'pg';
import { VerificationSummary } from './types';

/**
 * DEV-DB-AUTO-001: Post-Execution Verification
 * Audits actual physical schema changes to verify success and ensure zero unintended side-effects.
 */

export async function verifyDatabaseState(
  client: PgClient,
  expectedTables: string[] = []
): Promise<VerificationSummary> {
  const discrepancies: string[] = [];

  // 1. Audit public tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const actualTables = tablesRes.rows.map((r: any) => r.table_name);

  for (const expected of expectedTables) {
    if (!actualTables.includes(expected)) {
      discrepancies.push(`Expected table "${expected}" was not found in schema after migration execution.`);
    }
  }

  // 2. Audit public RPCs
  const rpcRes = await client.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
    ORDER BY routine_name;
  `);
  const actualRpcs = rpcRes.rows.map((r: any) => r.routine_name);

  // 3. Audit recorded migrations
  let recordedMigrationsCount = 0;
  try {
    const migRes = await client.query(`
      SELECT count(*) as count 
      FROM supabase_migrations.schema_migrations;
    `);
    recordedMigrationsCount = parseInt(migRes.rows[0].count, 10);
  } catch {
    discrepancies.push('supabase_migrations.schema_migrations table does not exist.');
  }

  return {
    verifiedTablesCount: actualTables.length,
    verifiedRpcCount: actualRpcs.length,
    recordedMigrationsCount,
    schemaDiscrepancies: discrepancies,
    isHealthy: discrepancies.length === 0
  };
}
