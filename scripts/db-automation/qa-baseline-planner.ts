import { loadRepositoryMigrationInventory } from './migration-inventory';

/**
 * DEV-DB-AUTO-001: QA Baseline Migration Reconstruction Planner
 * Section 9: Detailed analysis of foundational migrations (0001–0181) and policy migration (0182).
 * Formulates the execution roadmap without running live mutations.
 */

export interface QaBaselinePlan {
  totalFiles: number;
  executableSequenceCount: number;
  duplicateVersionsAnalysis: Array<{ version: string; files: string[]; resolution: string }>;
  transactionRestrictedMigrations: Array<{ filename: string; reason: string; handling: string }>;
  extensionPrerequisites: string[];
  seedDependencies: Array<{ migration: string; seedTarget: string; notes: string }>;
  migration0182Readiness: {
    prerequisiteTables: string[];
    canExecuteDirectlyOnCleanSlate: boolean;
    recommendedMilestone: string;
  };
  reconstructionPhases: Array<{
    phaseNumber: number;
    phaseName: string;
    migrationRange: string;
    description: string;
  }>;
}

export function generateQaBaselineReconstructionPlan(): QaBaselinePlan {
  const inventory = loadRepositoryMigrationInventory();

  // 1. Analyze Duplicate Versions
  const duplicateResolution = inventory.duplicateVersions.map(dup => {
    return {
      version: dup.version,
      files: dup.files,
      resolution: `Disambiguate in schema_migrations by recording composite key "${dup.version}_${dup.files[0].replace('.sql', '')}" and "${dup.version}_${dup.files[1].replace('.sql', '')}" to prevent primary key collision.`
    };
  });

  // 2. Transaction Restricted Migrations
  const nonTransactional = inventory.migrations
    .filter(m => !m.isTransactional)
    .map(m => ({
      filename: m.filename,
      reason: m.nonTransactionalReason || 'Cannot run in transaction block',
      handling: 'Execute with autocommit enabled outside of BEGIN...COMMIT wrapper.'
    }));

  // 3. Reconstruction Phases
  const reconstructionPhases = [
    {
      phaseNumber: 1,
      phaseName: 'Core Auth & Base Profiles Foundation',
      migrationRange: '0001–0010',
      description: 'Creates auth profiles, companies, brands, products, staff, review notes, and initial app roles.'
    },
    {
      phaseNumber: 2,
      phaseName: 'Extended Catalog & Module Features',
      migrationRange: '0011–0095',
      description: 'Adds extended product specifications, inquiries, warehouses, PO fulfillment, and portal views.'
    },
    {
      phaseNumber: 3,
      phaseName: 'Retailer Core Foundation (Non-Transactional Enum Extension)',
      migrationRange: '0096–0112',
      description: 'Extends app_role enum with retailer (autocommit), creates stores, retailer profiles, user roles, store access, published assets.'
    },
    {
      phaseNumber: 4,
      phaseName: 'Brand Agreement, Impersonation & Financial Foundation',
      migrationRange: '0113–0173',
      description: 'Creates agreement templates, impersonation audit logs, training quizzes, and delivery logs.'
    },
    {
      phaseNumber: 5,
      phaseName: 'Compliance, RMA & Exchange Credit Subsystems',
      migrationRange: '0174–0181',
      description: 'Adds compliance reviews (0174), store activities, retailer exchange claims, RMAs (0179), and credit ledger (0180).'
    },
    {
      phaseNumber: 6,
      phaseName: 'Product Performance Policy System',
      migrationRange: '0182',
      description: 'Deploys product_performance_policies, audit logs, and historical evaluations with foreign key to public.products.'
    }
  ];

  return {
    totalFiles: inventory.totalFiles,
    executableSequenceCount: inventory.migrations.length,
    duplicateVersionsAnalysis: duplicateResolution,
    transactionRestrictedMigrations: nonTransactional,
    extensionPrerequisites: ['pgcrypto', 'uuid-ossp'],
    seedDependencies: [
      {
        migration: '0113_brand_agreement_system.sql',
        seedTarget: 'agreement_templates',
        notes: 'Seeds version 1.0 agreement template into public.agreement_templates.'
      }
    ],
    migration0182Readiness: {
      prerequisiteTables: ['products', 'companies'],
      canExecuteDirectlyOnCleanSlate: false,
      recommendedMilestone: 'Execute after Phases 1–5 have been applied in order.'
    },
    reconstructionPhases
  };
}
