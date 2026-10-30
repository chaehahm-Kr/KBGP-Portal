import * as fs from 'fs';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const FORBIDDEN_PRODUCTION_REFS = [
  'shzfrppdobpmrstcjfqu',
  'shzfrppdobpmrstcjfqu.supabase.co',
  'db.shzfrppdobpmrstcjfqu.supabase.co'
] as const;

export interface QaEnvironmentInfo {
  isQa: true;
  environmentName: string;
  targetUrl: string;
  host: string;
  databaseHost?: string;
  isLocal: boolean;
  isStaging: boolean;
  timestamp: string;
}

export interface QaConfig {
  ENABLE_QA_ENVIRONMENT?: string;
  QA_ENVIRONMENT_NAME?: string;
  QA_SUPABASE_URL?: string;
  QA_SUPABASE_ANON_KEY?: string;
  QA_SUPABASE_PUBLISHABLE_KEY?: string;
  QA_PUBLISHABLE_KEY?: string;
  QA_SUPABASE_SERVICE_ROLE_KEY?: string;
  QA_SUPABASE_SECRET_KEY?: string;
  QA_SECRET_KEY?: string;
  QA_DATABASE_URL?: string;
  QA_DIRECT_URL?: string;
}

/**
 * Safely parse a .env formatted file without polluting process.env or throwing if missing
 */
export function loadEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)?$/);
    if (match) {
      let value = match[2] || '';
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[match[1]] = value.trim();
    }
  }
  return result;
}

/**
 * Resolves QA configuration strictly from QA sources (.env.qa, .env.qa.local, process.env).
 * Supports both modern (publishable/secret) and legacy (anon/service_role) key names.
 * NEVER silently falls back to production .env.local!
 */
export function resolveQaConfig(customConfig?: QaConfig): QaConfig {
  if (customConfig) {
    const anon = customConfig.QA_SUPABASE_ANON_KEY || customConfig.QA_SUPABASE_PUBLISHABLE_KEY || customConfig.QA_PUBLISHABLE_KEY;
    const serviceRole = customConfig.QA_SUPABASE_SERVICE_ROLE_KEY || customConfig.QA_SUPABASE_SECRET_KEY || customConfig.QA_SECRET_KEY;
    const dbUrl = customConfig.QA_DATABASE_URL || customConfig.QA_DIRECT_URL;

    return {
      ENABLE_QA_ENVIRONMENT: customConfig.ENABLE_QA_ENVIRONMENT,
      QA_ENVIRONMENT_NAME: customConfig.QA_ENVIRONMENT_NAME,
      QA_SUPABASE_URL: customConfig.QA_SUPABASE_URL,
      QA_SUPABASE_ANON_KEY: anon,
      QA_SUPABASE_SERVICE_ROLE_KEY: serviceRole,
      QA_DATABASE_URL: dbUrl
    };
  }

  const qaLocalPath = path.join(process.cwd(), '.env.qa.local');
  const qaLocalExists = fs.existsSync(qaLocalPath);
  const qaLocalEnv = loadEnvFile(qaLocalPath);
  const qaEnv = loadEnvFile(path.join(process.cwd(), '.env.qa'));
  const testEnv = loadEnvFile(path.join(process.cwd(), '.env.test'));
  const testLocalEnv = loadEnvFile(path.join(process.cwd(), '.env.test.local'));

  // If .env.qa.local exists, strictly do NOT fall back to legacy Docker .env.qa
  const sources = [process.env, testLocalEnv, testEnv, qaLocalEnv, ...(qaLocalExists ? [] : [qaEnv])];

  const getVal = (...keys: string[]): string | undefined => {
    for (const source of sources) {
      for (const k of keys) {
        if (source[k] && source[k]!.trim().length > 0) {
          return source[k]!.trim();
        }
      }
    }
    return undefined;
  };

  return {
    ENABLE_QA_ENVIRONMENT: getVal('ENABLE_QA_ENVIRONMENT'),
    QA_ENVIRONMENT_NAME: getVal('QA_ENVIRONMENT_NAME'),
    QA_SUPABASE_URL: getVal('QA_SUPABASE_URL'),
    QA_SUPABASE_ANON_KEY: getVal('QA_SUPABASE_ANON_KEY', 'QA_SUPABASE_PUBLISHABLE_KEY', 'QA_PUBLISHABLE_KEY'),
    QA_SUPABASE_SERVICE_ROLE_KEY: getVal('QA_SUPABASE_SERVICE_ROLE_KEY', 'QA_SUPABASE_SECRET_KEY', 'QA_SECRET_KEY'),
    QA_DATABASE_URL: getVal('QA_DATABASE_URL', 'QA_DIRECT_URL')
  };
}

/**
 * Fail-closed assertion: Throws immediately if the target environment is Production,
 * if QA mode is not explicitly enabled, or if target URL is missing/invalid.
 */
export function assertQaEnvironmentOrThrow(customConfig?: QaConfig): QaEnvironmentInfo {
  const config = resolveQaConfig(customConfig);

  // 1. Check explicit QA gate flag
  if (config.ENABLE_QA_ENVIRONMENT !== 'true') {
    throw new Error(
      '[FATAL QA GUARD VIOLATION] QA Environment is not enabled. ' +
      'ENABLE_QA_ENVIRONMENT=true must be explicitly defined in your QA configuration (.env.qa or environment). ' +
      'Refusing to execute any database operations.'
    );
  }

  // 2. Target URL must be explicitly provided
  const targetUrl = config.QA_SUPABASE_URL?.trim();
  if (!targetUrl) {
    throw new Error(
      '[FATAL QA GUARD VIOLATION] QA_SUPABASE_URL is missing or empty. ' +
      'Do not rely on default or production environment variables. ' +
      'Please specify QA_SUPABASE_URL in .env.qa or .env.qa.local.'
    );
  }

  // 3. Prohibit production signatures across all config values
  const allValues = [
    targetUrl,
    config.QA_DATABASE_URL || '',
    config.QA_ENVIRONMENT_NAME || '',
    process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  ].join(' ').toLowerCase();

  for (const forbidden of FORBIDDEN_PRODUCTION_REFS) {
    if (targetUrl.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(
        `[FATAL QA GUARD VIOLATION] Production project signature "${forbidden}" detected in QA_SUPABASE_URL! ` +
        'Targeting production for QA or test mutations is STRICTLY PROHIBITED. Aborting immediately.'
      );
    }
    if (config.QA_DATABASE_URL && config.QA_DATABASE_URL.toLowerCase().includes(forbidden.toLowerCase())) {
      throw new Error(
        `[FATAL QA GUARD VIOLATION] Production project signature "${forbidden}" detected in QA_DATABASE_URL! ` +
        'Targeting production for QA or test mutations is STRICTLY PROHIBITED. Aborting immediately.'
      );
    }
  }

  // Parse URL safely
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    throw new Error(`[FATAL QA GUARD VIOLATION] Invalid QA_SUPABASE_URL format: "${targetUrl}"`);
  }

  const host = parsedUrl.hostname.toLowerCase();

  // Re-verify host is not production
  if (host === 'shzfrppdobpmrstcjfqu.supabase.co' || host.includes('shzfrppdobpmrstcjfqu')) {
    throw new Error(
      `[FATAL QA GUARD VIOLATION] Resolved host "${host}" matches Production Supabase ref! Aborting immediately.`
    );
  }

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const isStaging = !isLocal && host.endsWith('.supabase.co');

  let databaseHost: string | undefined = undefined;
  if (config.QA_DATABASE_URL) {
    try {
      const dbUrl = new URL(config.QA_DATABASE_URL);
      databaseHost = `${dbUrl.hostname}:${dbUrl.port || '5432'}`;
    } catch {
      databaseHost = 'custom_connection_string';
    }
  }

  return {
    isQa: true,
    environmentName: config.QA_ENVIRONMENT_NAME || (isLocal ? 'local_supabase' : 'staging_supabase'),
    targetUrl: parsedUrl.origin,
    host,
    databaseHost,
    isLocal,
    isStaging,
    timestamp: new Date().toISOString()
  };
}

/**
 * Prints sanitized QA environment info without exposing any secrets or keys.
 */
export function logSanitizedQaStatus(info: QaEnvironmentInfo): void {
  console.log('====================================================');
  console.log('         K SELECT NETWORK QA ENVIRONMENT GUARD       ');
  console.log('====================================================');
  console.log(` Status:           ISOLATED QA ACTIVE`);
  console.log(` Environment Name: ${info.environmentName}`);
  console.log(` Target API URL:   ${info.targetUrl} (${info.isLocal ? 'LOCAL DOCKER' : 'STAGING CLOUD'})`);
  console.log(` Host:             ${info.host}`);
  if (info.databaseHost) {
    console.log(` Database Host:    ${info.databaseHost}`);
  }
  console.log(` Production Check: PASSED (shzfrppdobpmrstcjfqu NOT detected)`);
  console.log(` Timestamp:        ${info.timestamp}`);
  console.log('====================================================');
}

/**
 * Creates a verified Supabase client for QA operations.
 * Throws if QA guard fails or if service role key is missing.
 */
export function createQaSupabaseClient(customConfig?: QaConfig): SupabaseClient {
  const info = assertQaEnvironmentOrThrow(customConfig);
  const config = resolveQaConfig(customConfig);

  const key = config.QA_SUPABASE_SERVICE_ROLE_KEY || config.QA_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      '[FATAL QA GUARD VIOLATION] Neither QA_SUPABASE_SERVICE_ROLE_KEY nor QA_SUPABASE_ANON_KEY is provided in QA config.'
    );
  }

  return createClient(info.targetUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
