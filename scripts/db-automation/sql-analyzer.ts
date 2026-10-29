import * as crypto from 'crypto';
import {
  DangerousStatementMatch,
  DangerousStatementType,
  MigrationFileAnalysis,
  RiskLevel
} from './types';

/**
 * DEV-DB-AUTO-001: Pre-flight SQL Analyzer & Safety Checker
 * Detects dangerous operations, non-transactional statements, and schema dependencies.
 */

export function computeSqlSha256(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Scans SQL content line-by-line to detect dangerous DDL/DML patterns.
 */
export function detectDangerousStatements(sql: string): DangerousStatementMatch[] {
  const matches: DangerousStatementMatch[] = [];
  const lines = sql.split('\n');

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const trimmed = line.replace(/^\uFEFF+/, '').trim();

    // Skip comment lines
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) continue;

    const checkPattern = (regex: RegExp, type: DangerousStatementType) => {
      if (regex.test(line)) {
        matches.push({
          type,
          snippet: line.trim().slice(0, 120),
          line: idx + 1
        });
      }
    };

    checkPattern(/\bDROP\s+TABLE\b/i, 'DROP TABLE');
    checkPattern(/\bDROP\s+COLUMN\b/i, 'DROP COLUMN');
    checkPattern(/\bTRUNCATE\s+(?:TABLE\s+)?[a-zA-Z0-9_.]+/i, 'TRUNCATE');
    checkPattern(/\bDELETE\s+FROM\b/i, 'DELETE');
    checkPattern(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i, 'DISABLE RLS');
    checkPattern(/\bCASCADE\b/i, 'CASCADE');

    // Unbounded UPDATE: UPDATE statement on a line without a WHERE clause
    if (/\bUPDATE\s+[a-zA-Z0-9_.]+\s+SET\b/i.test(line) && !/WHERE/i.test(line)) {
      // Basic check: if the entire multi-line block has WHERE, it's safer, but flag for audit
      matches.push({
        type: 'UNBOUNDED UPDATE',
        snippet: line.trim().slice(0, 120),
        line: idx + 1
      });
    }
  }

  return matches;
}

/**
 * Identifies statements that cannot safely run inside a standard PostgreSQL transaction block.
 */
export function checkTransactionSupport(sql: string): {
  isTransactional: boolean;
  reason?: string;
} {
  if (/CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY/i.test(sql)) {
    return {
      isTransactional: false,
      reason: 'CREATE INDEX CONCURRENTLY cannot run inside a transaction block in PostgreSQL.'
    };
  }

  if (/DROP\s+INDEX\s+CONCURRENTLY/i.test(sql)) {
    return {
      isTransactional: false,
      reason: 'DROP INDEX CONCURRENTLY cannot run inside a transaction block in PostgreSQL.'
    };
  }

  if (/ALTER\s+TYPE\s+.*ADD\s+VALUE/i.test(sql)) {
    return {
      isTransactional: false,
      reason: 'ALTER TYPE ... ADD VALUE cannot run inside an uncommitted transaction block in PostgreSQL.'
    };
  }

  return { isTransactional: true };
}

/**
 * Extracts tables created and referenced in the SQL migration.
 */
export function extractSchemaEntities(sql: string): {
  tablesCreated: string[];
  tablesReferenced: string[];
  columnsAdded: string[];
} {
  const tablesCreated: string[] = [];
  const tablesReferenced: string[] = [];
  const columnsAdded: string[] = [];

  // Match: CREATE TABLE [IF NOT EXISTS] [public.]table_name
  const createMatches = sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/gi);
  for (const m of createMatches) {
    if (!tablesCreated.includes(m[1])) {
      tablesCreated.push(m[1]);
    }
  }

  // Match: REFERENCES [public.]table_name (column)
  const refMatches = sql.matchAll(/REFERENCES\s+(?:public\.)?([a-zA-Z0-9_]+)\s*\(/gi);
  for (const m of refMatches) {
    const tbl = m[1];
    if (tbl !== 'users' && !tablesReferenced.includes(tbl) && !tablesCreated.includes(tbl)) {
      tablesReferenced.push(tbl);
    }
  }

  // Match: ALTER TABLE [public.]table_name ADD COLUMN [IF NOT EXISTS] col_name
  const colMatches = sql.matchAll(/ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/gi);
  for (const m of colMatches) {
    columnsAdded.push(`${m[1]}.${m[2]}`);
  }

  return { tablesCreated, tablesReferenced, columnsAdded };
}

/**
 * Calculates risk level based on detected statements.
 */
export function calculateRiskLevel(dangerous: DangerousStatementMatch[]): RiskLevel {
  if (dangerous.some(d => d.type === 'DROP TABLE' || d.type === 'DROP COLUMN' || d.type === 'TRUNCATE' || d.type === 'DISABLE RLS')) {
    return 'CRITICAL';
  }
  if (dangerous.some(d => d.type === 'DELETE' || d.type === 'CASCADE')) {
    return 'HIGH';
  }
  if (dangerous.some(d => d.type === 'UNBOUNDED UPDATE')) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Full static analysis of a single migration file.
 */
export function analyzeMigrationSql(
  filename: string,
  filePath: string,
  sqlContent: string
): MigrationFileAnalysis {
  const match = filename.match(/^(\d{4})([a-z0-9]*)_(.+)\.sql$/i);
  const orderNumber = match ? parseInt(match[1], 10) : 9999;
  const version = match ? `${match[1]}${match[2] ? match[2].toLowerCase() : ''}` : filename;

  const dangerous = detectDangerousStatements(sqlContent);
  const txSupport = checkTransactionSupport(sqlContent);
  const entities = extractSchemaEntities(sqlContent);
  const riskLevel = calculateRiskLevel(dangerous);
  const sha256 = computeSqlSha256(sqlContent);

  return {
    filename,
    version,
    disambiguatedVersion: version,
    orderNumber,
    filePath,
    sha256,
    rawSqlLength: sqlContent.length,
    tablesCreated: entities.tablesCreated,
    tablesReferenced: entities.tablesReferenced,
    columnsAdded: entities.columnsAdded,
    dangerousStatements: dangerous,
    riskLevel,
    isTransactional: txSupport.isTransactional,
    nonTransactionalReason: txSupport.reason
  };
}
