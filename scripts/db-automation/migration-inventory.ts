import * as fs from 'fs';
import * as path from 'path';
import { MigrationFileAnalysis } from './types';
import { analyzeMigrationSql } from './sql-analyzer';

export interface RepositoryMigrationInventory {
  totalFiles: number;
  minVersion: number;
  maxVersion: number;
  duplicateVersions: Array<{ version: string; files: string[] }>;
  migrations: MigrationFileAnalysis[];
  migrationsByVersion: Map<string, MigrationFileAnalysis[]>;
}

/**
 * Scans supabase/migrations directory and produces a comprehensive repository migration inventory.
 */
export function loadRepositoryMigrationInventory(dir?: string): RepositoryMigrationInventory {
  const migrationsDir = dir || path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`[MIGRATION INVENTORY] Migrations directory does not exist: "${migrationsDir}"`);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const migrations: MigrationFileAnalysis[] = [];
  const versionMap = new Map<string, string[]>();
  const migrationsByVersion = new Map<string, MigrationFileAnalysis[]>();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const analysis = analyzeMigrationSql(file, fullPath, content);

    migrations.push(analysis);

    if (!versionMap.has(analysis.version)) {
      versionMap.set(analysis.version, []);
      migrationsByVersion.set(analysis.version, []);
    }
    versionMap.get(analysis.version)!.push(file);
    migrationsByVersion.get(analysis.version)!.push(analysis);
  }

  // Sort numerically, then by filename
  migrations.sort((a, b) => a.orderNumber - b.orderNumber || a.filename.localeCompare(b.filename));

  const duplicateVersions: Array<{ version: string; files: string[] }> = [];
  for (const [ver, fList] of versionMap.entries()) {
    if (fList.length > 1) {
      duplicateVersions.push({ version: ver, files: fList });
      const groupMigrations = migrationsByVersion.get(ver) || [];
      groupMigrations.sort((a, b) => a.filename.localeCompare(b.filename));
      groupMigrations.forEach((m, idx) => {
        if (idx === 0) {
          m.disambiguatedVersion = ver;
        } else {
          const suffix = String.fromCharCode(98 + idx - 1); // 'b', 'c', ...
          m.disambiguatedVersion = `${ver}${suffix}`;
        }
      });
    }
  }

  return {
    totalFiles: files.length,
    minVersion: migrations[0]?.orderNumber ?? 0,
    maxVersion: migrations[migrations.length - 1]?.orderNumber ?? 0,
    duplicateVersions,
    migrations,
    migrationsByVersion
  };
}

/**
 * Checks if a specific target migration has its prerequisite dependencies met in a given schema.
 */
export function checkMigrationPrerequisites(
  target: MigrationFileAnalysis,
  existingTables: string[]
): {
  isSatisfied: boolean;
  missingTables: string[];
} {
  const missingTables = target.tablesReferenced.filter(tbl => !existingTables.includes(tbl));
  return {
    isSatisfied: missingTables.length === 0,
    missingTables
  };
}
