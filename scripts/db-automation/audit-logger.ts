import * as fs from 'fs';
import * as path from 'path';
import { ExecutionReport } from './types';

/**
 * DEV-DB-AUTO-001: Audit Logger & Masking Module
 * Masks sensitive credentials and produces persistent audit trails.
 */

export function maskSecrets(text: string): string {
  if (!text) return '';

  return text
    // Mask postgres passwords in connection URIs: postgres://user:PASSWORD@host
    .replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi, '$1***MASKED***$3')
    // Mask Bearer tokens: Bearer <token>
    .replace(/(Bearer\s+)([a-zA-Z0-9_\-.]+)/gi, (m, prefix, val) => {
      if (val.length <= 6) return `${prefix}***`;
      return `${prefix}${val.slice(0, 3)}***${val.slice(-3)}`;
    })
    // Mask keys and secrets: key: val, secret=val, password: val
    .replace(/(?:apikey|secret|password|token)\s*[:=]\s*["']?([a-zA-Z0-9_\-.]+)["']?/gi, (m, val) => {
      if (val.length <= 6) return m.replace(val, '***');
      return m.replace(val, `${val.slice(0, 3)}***${val.slice(-3)}`);
    });
}

export function writeAuditLog(report: ExecutionReport, outputDir?: string): { jsonPath: string; mdPath: string } {
  const dir = outputDir || path.join(process.cwd(), '.audit', 'migrations');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const safeTimestamp = report.startedAt.replace(/[:.]/g, '-');
  const baseName = `${report.taskId}_${report.environment}_${safeTimestamp}`;
  const jsonPath = path.join(dir, `${baseName}.json`);
  const mdPath = path.join(dir, `${baseName}.md`);

  // Write JSON
  const sanitizedJson = maskSecrets(JSON.stringify(report, null, 2));
  fs.writeFileSync(jsonPath, sanitizedJson, 'utf8');

  // Write Markdown summary
  const md = [
    `# Migration Audit Report: ${report.taskId}`,
    `- **Environment**: ${report.environment}`,
    `- **Plan ID**: ${report.planId}`,
    `- **Status**: ${report.status}`,
    `- **Started**: ${report.startedAt}`,
    `- **Completed**: ${report.completedAt}`,
    `- **Migrations Attempted**: ${report.migrationsAttempted.length}`,
    `- **Migrations Succeeded**: ${report.migrationsSucceeded.length}`,
    report.failedMigration ? `- **Failed Migration**: ${report.failedMigration}` : '',
    report.error ? `- **Error Details**: \`${maskSecrets(report.error)}\`` : '',
    '',
    `## Verification Summary`,
    report.verification ? [
      `- **Verified Tables**: ${report.verification.verifiedTablesCount}`,
      `- **Verified RPCs**: ${report.verification.verifiedRpcCount}`,
      `- **Recorded Migrations**: ${report.verification.recordedMigrationsCount}`,
      `- **Discrepancies**: ${report.verification.schemaDiscrepancies.length === 0 ? 'None (Clean)' : report.verification.schemaDiscrepancies.join(', ')}`
    ].join('\n') : 'Verification pending or skipped.',
    '',
    `## Target Identity`,
    report.targetIdentity ? [
      `- **Project Ref**: ${report.targetIdentity.projectRef}`,
      `- **Host**: ${report.targetIdentity.host}`,
      `- **User**: ${report.targetIdentity.user}`,
      `- **Database**: ${report.targetIdentity.database}`,
      `- **Server Version**: ${report.targetIdentity.postgresVersion}`
    ].join('\n') : 'Target identity not established.'
  ].filter(Boolean).join('\n');

  fs.writeFileSync(mdPath, md, 'utf8');
  return { jsonPath, mdPath };
}
