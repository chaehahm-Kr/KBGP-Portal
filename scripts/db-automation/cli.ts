import { prepareMigrationPlan } from './migration-engine';
import { loadRepositoryMigrationInventory } from './migration-inventory';
import { generateQaBaselineReconstructionPlan } from './qa-baseline-planner';
import { resolveTargetConfig, verifyTargetIdentity } from './target-guard';
import { DatabaseEnvironment } from './types';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('================================================================================');
  console.log('K SELECT NETWORK — SQL MIGRATION AUTOMATION ENGINE (DEV-DB-AUTO-001)');
  console.log('================================================================================\n');

  if (command === 'inventory') {
    const inv = loadRepositoryMigrationInventory();
    console.log(`Total Migration Files: ${inv.totalFiles}`);
    console.log(`Version Range:        ${inv.minVersion} to ${inv.maxVersion}`);
    console.log(`Duplicate Versions:   ${inv.duplicateVersions.length}`);
    if (inv.duplicateVersions.length > 0) {
      console.log('\nDuplicates detected:');
      for (const d of inv.duplicateVersions) {
        console.log(`  - Version ${d.version}: ${d.files.join(' | ')}`);
      }
    }
    return;
  }

  if (command === 'qa-baseline') {
    const baseline = generateQaBaselineReconstructionPlan();
    console.log(`Total Files Analyzed:          ${baseline.totalFiles}`);
    console.log(`Duplicate Version Conflicts:   ${baseline.duplicateVersionsAnalysis.length}`);
    console.log(`Transaction Restrictions:      ${baseline.transactionRestrictedMigrations.length}`);
    console.log(`Can 0182 run on clean slate?   ${baseline.migration0182Readiness.canExecuteDirectlyOnCleanSlate ? 'YES' : 'NO'}`);
    console.log(`Prerequisites for 0182:        ${baseline.migration0182Readiness.prerequisiteTables.join(', ')}`);
    console.log('\nReconstruction Phases:');
    for (const p of baseline.reconstructionPhases) {
      console.log(`  Phase ${p.phaseNumber} [${p.migrationRange}]: ${p.phaseName}`);
      console.log(`    ${p.description}`);
    }
    return;
  }

  if (command === 'plan') {
    const env = (args[1]?.toUpperCase() || 'QA') as DatabaseEnvironment;
    const gitSha = args[2] || 'LOCAL_GIT_HEAD';
    const plan = prepareMigrationPlan({
      environment: env,
      currentGitSha: gitSha
    });

    console.log(`Plan ID:                 ${plan.planId}`);
    console.log(`Target Environment:      ${plan.environment}`);
    console.log(`Target Project Ref:      ${plan.targetRef}`);
    console.log(`Git SHA:                 ${plan.gitSha}`);
    console.log(`Total Planned:           ${plan.totalMigrations}`);
    console.log(`High Risk Migrations:    ${plan.highRiskCount}`);
    console.log(`Requires Owner Approval: ${plan.requiresOwnerApproval}`);
    return;
  }

  if (command === 'verify-target') {
    const env = (args[1]?.toUpperCase() || 'QA') as DatabaseEnvironment;
    console.log(`Verifying target identity for ${env}...`);
    const config = resolveTargetConfig(env);
    const identity = await verifyTargetIdentity(config);
    console.log(`✓ Identity Verified:`);
    console.log(`  Environment: ${identity.environment}`);
    console.log(`  Project Ref: ${identity.projectRef}`);
    console.log(`  Host:        ${identity.host}`);
    console.log(`  User:        ${identity.user}`);
    console.log(`  Database:    ${identity.database}`);
    console.log(`  Version:     ${identity.postgresVersion}`);
    return;
  }

  console.log('Available Commands:');
  console.log('  npx tsx scripts/db-automation/cli.ts inventory');
  console.log('  npx tsx scripts/db-automation/cli.ts qa-baseline');
  console.log('  npx tsx scripts/db-automation/cli.ts plan [QA|PRODUCTION] [GIT_SHA]');
  console.log('  npx tsx scripts/db-automation/cli.ts verify-target [QA|PRODUCTION]');
}

main().catch(err => {
  console.error('[CLI ERROR]', err.message);
  process.exit(1);
});
