/**
 * Script: qa-run-0183-permissions.ts
 * Task ID: ADM-SALES-PERF-005-R5
 * Description: Applies forward migration 0183 to QA database (elkgizqgksshukxgcndy) using the guarded migration engine.
 */

import { prepareMigrationPlan, executeMigrationPlan } from '../db-automation/migration-engine';
import { QaTaskAuthorization } from '../db-automation/types';

export async function run0183PermissionsMigration() {
  console.log('================================================================================');
  console.log('TASK: ADM-SALES-PERF-005-R5');
  console.log('APPLY FORWARD MIGRATION 0183 TO QA DATABASE');
  console.log('Target: QA Preview Branch qa-testing (elkgizqgksshukxgcndy)');
  console.log('Mode:   QA-ONLY / VERIFIED TLS / TRANSACTIONAL / ADVISORY LOCKED');
  console.log('================================================================================\n');

  const currentGitSha = 'a61ddd4a72c1e5f99b8ba82ba5876fd09a194f55';
  const targetVersions = ['0183'];

  // Step 1: Prepare plan for 0183
  const plan = prepareMigrationPlan({
    environment: 'QA',
    currentGitSha,
    targetMigrationVersions: targetVersions,
  });

  console.log(`[PLAN READY] Plan ID: ${plan.planId}`);
  console.log(`[PLAN READY] Total Migrations: ${plan.totalMigrations}`);
  console.log(`[PLAN READY] Target Ref: ${plan.targetRef}`);
  console.log(`[PLAN READY] Aggregate Digest: ${plan.aggregateSqlDigest}`);

  // Step 2: Formulate QA Authorization
  const auth: QaTaskAuthorization = {
    environment: 'QA',
    taskId: 'ADM-SALES-PERF-005-R5',
    approvedMigrationVersions: targetVersions,
    authorizedAt: new Date().toISOString(),
  };

  // Step 3: Execute Controlled Plan
  console.log('\n--- Executing Migration 0183 on QA Database ---');
  const report = await executeMigrationPlan({
    plan,
    currentGitSha,
    auth,
    taskId: 'ADM-SALES-PERF-005-R5',
  });

  console.log('\n================================================================================');
  console.log(`EXECUTION RESULT: ${report.status}`);
  console.log('================================================================================');
  console.log(`Migrations Attempted: ${report.migrationsAttempted.join(', ')}`);
  console.log(`Migrations Succeeded: ${report.migrationsSucceeded.join(', ')}`);

  if (report.failedMigration) {
    console.error(`Failed Migration:     ${report.failedMigration}`);
    console.error(`Error:                ${report.error}`);
    throw new Error(`Migration failed: ${report.error}`);
  }

  return report;
}

if (require.main === module) {
  run0183PermissionsMigration().catch(err => {
    console.error('Fatal Execution Error:', err.message);
    process.exit(1);
  });
}
