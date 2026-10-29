/**
 * DEV-DB-AUTO-001: Supabase SQL Migration Automation Types
 * Strictly enforces environment isolation, safety checks, and approval gates.
 */

export type DatabaseEnvironment = 'QA' | 'PRODUCTION';

export const PRODUCTION_PROJECT_REF = 'shzfrppdobpmrstcjfqu' as const;
export const QA_PROJECT_REF = 'elkgizqgksshukxgcndy' as const;

export const NONCE_STORE_SCHEMA = '_kselect_ops' as const;
export const NONCE_STORE_TABLE = 'consumed_approval_tokens' as const;
export const FULL_NONCE_STORE_PATH = `${NONCE_STORE_SCHEMA}.${NONCE_STORE_TABLE}` as const;

export interface TargetIdentity {
  environment: DatabaseEnvironment;
  projectRef: string;
  branch: string;
  host: string;
  port: number;
  database: string;
  user: string;
  serverAddr: string;
  postgresVersion: string;
  verifiedAt: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DangerousStatementType =
  | 'DROP TABLE'
  | 'DROP COLUMN'
  | 'TRUNCATE'
  | 'DELETE'
  | 'DISABLE RLS'
  | 'CASCADE'
  | 'UNBOUNDED UPDATE';

export interface DangerousStatementMatch {
  type: DangerousStatementType;
  snippet: string;
  line: number;
}

export interface MigrationFileAnalysis {
  filename: string;
  version: string;
  orderNumber: number;
  filePath: string;
  sha256: string;
  rawSqlLength: number;
  tablesCreated: string[];
  tablesReferenced: string[];
  columnsAdded: string[];
  dangerousStatements: DangerousStatementMatch[];
  riskLevel: RiskLevel;
  isTransactional: boolean;
  nonTransactionalReason?: string;
  disambiguatedVersion?: string;
}

export interface ApprovedMigrationItem {
  filename: string;
  version: string;
  disambiguatedVersion: string;
  sha256: string;
  orderNumber: number;
}

export interface MigrationPlan {
  planId: string;
  environment: DatabaseEnvironment;
  targetRef: string;
  gitSha: string;
  createdAt: string;
  migrations: MigrationFileAnalysis[];
  totalMigrations: number;
  highRiskCount: number;
  aggregateSqlDigest: string;
  requiresOwnerApproval: boolean;
  recoveryProcedure: string;
}

export interface ProductionApprovalToken {
  environment: 'PRODUCTION';
  targetProjectRef: typeof PRODUCTION_PROJECT_REF;
  executionScope: 'PRODUCTION_MIGRATION';
  tokenNonce: string;
  approvedGitSha: string;
  migrations: ApprovedMigrationItem[];
  aggregateSqlDigest: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  signature: string;
}

export interface QaTaskAuthorization {
  environment: 'QA';
  taskId: string;
  approvedMigrationVersions: string[];
  authorizedAt: string;
  authorizedTransactionalExceptions?: Array<{ filename: string; sha256: string }>;
}

export interface VerificationSummary {
  verifiedTablesCount: number;
  verifiedRpcCount: number;
  recordedMigrationsCount: number;
  schemaDiscrepancies: string[];
  isHealthy: boolean;
}

export interface ExecutionReport {
  taskId: string;
  planId: string;
  environment: DatabaseEnvironment;
  status: 'SUCCESS' | 'FAILED' | 'DRY_RUN' | 'BLOCKED';
  targetIdentity?: TargetIdentity;
  migrationsAttempted: string[];
  migrationsSucceeded: string[];
  failedMigration?: string;
  error?: string;
  startedAt: string;
  completedAt: string;
  verification?: VerificationSummary;
  auditLogPath?: string;
}
