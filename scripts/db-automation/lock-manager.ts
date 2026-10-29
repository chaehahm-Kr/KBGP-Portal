// @ts-ignore
import { Client as PgClient } from 'pg';

/**
 * DEV-DB-AUTO-001: PostgreSQL Advisory Lock Manager
 * Ensures strictly one migration runner can execute at any time.
 */

// Deterministic 64-bit integer lock key for K SELECT migration runner
export const MIGRATION_LOCK_KEY = '849204859182374912';

export async function acquireMigrationLock(client: PgClient): Promise<boolean> {
  const res = await client.query(`SELECT pg_try_advisory_lock(${MIGRATION_LOCK_KEY}) as acquired;`);
  return Boolean(res.rows[0]?.acquired);
}

export async function releaseMigrationLock(client: PgClient): Promise<boolean> {
  try {
    const res = await client.query(`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY}) as released;`);
    return Boolean(res.rows[0]?.released);
  } catch {
    return false;
  }
}

export async function withMigrationLock<T>(
  client: PgClient,
  action: () => Promise<T>
): Promise<T> {
  const acquired = await acquireMigrationLock(client);
  if (!acquired) {
    throw new Error(
      '[FATAL CONCURRENCY VIOLATION] Unable to acquire migration advisory lock. ' +
      'Another migration runner or agent is currently active on this database! Aborting to prevent race conditions.'
    );
  }

  try {
    return await action();
  } finally {
    await releaseMigrationLock(client);
  }
}
