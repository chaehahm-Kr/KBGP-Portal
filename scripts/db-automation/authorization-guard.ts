import * as crypto from 'crypto';
import {
  DatabaseEnvironment,
  MigrationPlan,
  ProductionApprovalToken,
  PRODUCTION_PROJECT_REF,
  QaTaskAuthorization
} from './types';

/**
 * DEV-DB-SEC-001: Environment Authorization Guard
 * Enforces fail-closed, asymmetric Ed25519 authorization for Production:
 * - QA: Task-scoped authorization with active taskId
 * - Production: Asymmetric Ed25519 Owner signature binding exact project, files, order, sha256 hashes, digest, nonce, and gitSha
 *
 * CRITICAL SECURITY INVARIANTS:
 * 1. ZERO hardcoded secrets or fallback tokens in repository code.
 * 2. ZERO signing keys or token signers in Agent runtime.
 * 3. Fail-closed: missing public key or invalid signature immediately throws fatal error.
 */

/**
 * Builds the unambiguous canonical payload for Ed25519 signature binding.
 * Binds:
 * - executionScope
 * - targetProjectRef
 * - approvedGitSha
 * - tokenNonce
 * - aggregateSqlDigest
 * - approvedBy
 * - approvedAt
 * - expiresAt
 * - ordered migration sequence (index, filename, version, disambiguatedVersion, sha256, orderNumber)
 */
export function buildApprovalCanonicalPayload(token: Omit<ProductionApprovalToken, 'signature'>): string {
  const migrationsStr = token.migrations.map((m, idx) =>
    `${idx}:${m.filename}:${m.version}:${m.disambiguatedVersion}:${m.sha256}:${m.orderNumber}`
  ).join('\n');

  return [
    `SCOPE:${token.executionScope}`,
    `PROJECT_REF:${token.targetProjectRef}`,
    `GIT_SHA:${token.approvedGitSha}`,
    `NONCE:${token.tokenNonce}`,
    `AGGREGATE_DIGEST:${token.aggregateSqlDigest}`,
    `APPROVED_BY:${token.approvedBy}`,
    `APPROVED_AT:${token.approvedAt}`,
    `EXPIRES_AT:${token.expiresAt}`,
    'MIGRATIONS_START',
    migrationsStr,
    'MIGRATIONS_END'
  ].join('\n');
}

/**
 * Verifies an Ed25519 Owner Approval Token against the planned execution state.
 */
export function verifyProductionApprovalToken(
  token: ProductionApprovalToken,
  plan: MigrationPlan,
  currentGitSha: string,
  ownerPublicKey?: string
): { isValid: boolean; error?: string } {
  // 1. Resolve Owner Public Key (Fail-closed)
  const pubKey = ownerPublicKey || process.env.OWNER_ED25519_PUBLIC_KEY;
  if (!pubKey || pubKey.trim().length === 0) {
    return {
      isValid: false,
      error: '[FATAL SECURITY VIOLATION] Owner Ed25519 public key is not configured (OWNER_ED25519_PUBLIC_KEY missing). Production verification failed closed.'
    };
  }

  // 2. Environment check
  if (token.environment !== 'PRODUCTION' || plan.environment !== 'PRODUCTION') {
    return { isValid: false, error: 'Token is not authorized for Production execution.' };
  }

  // 3. Execution scope check
  if (token.executionScope !== 'PRODUCTION_MIGRATION') {
    return { isValid: false, error: 'Token execution scope must be explicitly "PRODUCTION_MIGRATION".' };
  }

  // 4. Project Ref check
  if (token.targetProjectRef !== PRODUCTION_PROJECT_REF || plan.targetRef !== PRODUCTION_PROJECT_REF) {
    return { isValid: false, error: `Token target "${token.targetProjectRef}" does not match Production "${PRODUCTION_PROJECT_REF}".` };
  }

  // 5. Nonce check
  if (!token.tokenNonce || typeof token.tokenNonce !== 'string' || token.tokenNonce.trim().length < 16) {
    return { isValid: false, error: 'Invalid or missing approval token nonce. Cryptographic single-use nonce required.' };
  }

  // 6. Expiration check
  const now = Date.now();
  const expTime = new Date(token.expiresAt).getTime();
  const appTime = new Date(token.approvedAt).getTime();

  if (isNaN(expTime) || expTime < now) {
    return { isValid: false, error: `Approval token expired at ${token.expiresAt}. Stale approvals are rejected.` };
  }

  if (isNaN(appTime) || appTime > now + 60000) {
    return { isValid: false, error: `Approval token issue timestamp "${token.approvedAt}" is in the future. Clock skew anomaly.` };
  }

  // 7. Git SHA match check
  if (token.approvedGitSha !== currentGitSha || plan.gitSha !== currentGitSha) {
    return {
      isValid: false,
      error: `Git SHA mismatch! Approved for ${token.approvedGitSha}, but current Git SHA is ${currentGitSha}.`
    };
  }

  // 8. Migration count match check
  if (token.migrations.length !== plan.migrations.length) {
    return {
      isValid: false,
      error: `Migration count mismatch! Token approves ${token.migrations.length} migrations, but plan requires ${plan.migrations.length}.`
    };
  }

  // 9. Exact Migration Sequence and Identity match check
  for (let i = 0; i < plan.migrations.length; i++) {
    const tm = token.migrations[i];
    const pm = plan.migrations[i];
    const plannedDisambiguated = pm.disambiguatedVersion || pm.version;

    if (!tm) {
      return { isValid: false, error: `Missing approved migration item at index ${i}.` };
    }

    if (tm.filename !== pm.filename) {
      return {
        isValid: false,
        error: `Migration filename mismatch at index ${i}! Approved "${tm.filename}", but plan has "${pm.filename}".`
      };
    }

    if (tm.version !== pm.version) {
      return {
        isValid: false,
        error: `Migration version mismatch at index ${i}! Approved "${tm.version}", but plan has "${pm.version}".`
      };
    }

    if (tm.disambiguatedVersion !== plannedDisambiguated) {
      return {
        isValid: false,
        error: `Migration disambiguated version mismatch at index ${i}! Approved "${tm.disambiguatedVersion}", but plan has "${plannedDisambiguated}".`
      };
    }

    if (tm.sha256 !== pm.sha256) {
      return {
        isValid: false,
        error: `Migration file SHA-256 hash mismatch for "${pm.filename}" at index ${i}! File content has changed.`
      };
    }

    if (tm.orderNumber !== pm.orderNumber) {
      return {
        isValid: false,
        error: `Migration order sequence mismatch for "${pm.filename}" at index ${i}! Approved order ${tm.orderNumber}, planned order ${pm.orderNumber}.`
      };
    }
  }

  // 10. Aggregate SQL content digest check
  if (token.aggregateSqlDigest !== plan.aggregateSqlDigest) {
    return {
      isValid: false,
      error: `Aggregate SQL content digest mismatch! Approved "${token.aggregateSqlDigest}", but plan calculated "${plan.aggregateSqlDigest}".`
    };
  }

  // 11. Ed25519 Asymmetric Cryptographic Signature check
  const canonicalPayload = buildApprovalCanonicalPayload(token);
  let isSignatureValid = false;

  try {
    isSignatureValid = crypto.verify(
      null,
      Buffer.from(canonicalPayload, 'utf8'),
      pubKey,
      Buffer.from(token.signature, 'hex')
    );
  } catch (err: any) {
    return {
      isValid: false,
      error: `[FATAL CRYPTOGRAPHIC FAILURE] Owner Ed25519 signature verification error: ${err.message}`
    };
  }

  if (!isSignatureValid) {
    return {
      isValid: false,
      error: 'Approval token signature is invalid, forged, or has been tampered with.'
    };
  }

  return { isValid: true };
}

/**
 * Asserts authorization according to the target environment.
 * QA: Checks active taskId
 * PRODUCTION: Checks cryptographically verified Ed25519 Owner Approval Token
 */
export function assertAuthorization(
  env: DatabaseEnvironment,
  plan: MigrationPlan,
  currentGitSha: string,
  auth?: ProductionApprovalToken | QaTaskAuthorization,
  ownerPublicKey?: string
): void {
  if (env === 'QA') {
    if (!auth || auth.environment !== 'QA') {
      throw new Error('[FATAL AUTHORIZATION FAILURE] QA migration execution requires valid QaTaskAuthorization with active taskId.');
    }
    const qaAuth = auth as QaTaskAuthorization;
    if (!qaAuth.taskId || qaAuth.taskId.trim().length === 0) {
      throw new Error('[FATAL AUTHORIZATION FAILURE] Missing Task ID in QA authorization.');
    }
    return;
  }

  if (env === 'PRODUCTION') {
    if (!auth || auth.environment !== 'PRODUCTION') {
      throw new Error(
        '[FATAL PRODUCTION GATE VIOLATION] Production SQL execution is DISABLED by default. ' +
        'Explicit, cryptographically signed Owner Ed25519 Approval Token is required for the exact migration set.'
      );
    }

    const verification = verifyProductionApprovalToken(
      auth as ProductionApprovalToken,
      plan,
      currentGitSha,
      ownerPublicKey
    );
    if (!verification.isValid) {
      throw new Error(`[FATAL PRODUCTION GATE VIOLATION] ${verification.error}`);
    }
  }
}
