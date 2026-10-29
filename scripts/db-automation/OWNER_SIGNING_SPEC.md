# DEV-DB-SEC-001: Owner-Side Signing Interface & Protocol Specification

## 1. Security Architecture Overview
In accordance with DEV-DB-SEC-001, Production database migrations require an asymmetric Ed25519 digital signature from the system Owner.

- **Private Signing Key (`ed25519`)**: Held **STRICTLY OUTSIDE** the agent workspace, CI runner, and repository. Never stored on disk in the application environment.
- **Public Verification Key (`ed25519`)**: Injected into the execution environment via `OWNER_ED25519_PUBLIC_KEY` (SPKI PEM format).
- **Agent Authority**: Zero. The executor codebase possesses no signing keys, no signing scripts, and no fallback secrets. Production execution is **default-deny / fail-closed**.

---

## 2. Key Pair Generation (Owner Machine Only)
Run this once on the Owner's local, secured machine:

```bash
# Generate Ed25519 private key (keep confidential, never commit)
openssl genpkey -algorithm ed25519 -out owner_ed25519_private.pem

# Extract SPKI public key (provide to execution environment via env)
openssl pkey -in owner_ed25519_private.pem -pubout -out owner_ed25519_public.pem
```

---

## 3. Canonical Approval Payload Specification
The signature MUST be computed over the UTF-8 bytes of the following exact canonical string:

```text
SCOPE:PRODUCTION_MIGRATION
PROJECT_REF:<targetProjectRef>
GIT_SHA:<approvedGitSha>
NONCE:<tokenNonce>
AGGREGATE_DIGEST:<aggregateSqlDigest>
APPROVED_BY:<approvedBy>
APPROVED_AT:<approvedAt>
EXPIRES_AT:<expiresAt>
MIGRATIONS_START
<index>:<filename>:<version>:<disambiguatedVersion>:<sha256>:<orderNumber>
...
MIGRATIONS_END
```

### Canonical Invariants:
1. `index` is the 0-based integer position in the execution sequence.
2. `disambiguatedVersion` matches `version` if unique, or the assigned suffix (e.g. `0037b`) if a duplicate prefix exists.
3. `sha256` is the hex-encoded SHA-256 hash of the exact file bytes.
4. `aggregateSqlDigest` is `SHA-256` of `<index>:<filename>:<disambiguatedVersion>:<sha256>:<orderNumber>` joined with `\n`.
5. `tokenNonce` is a cryptographically unique UUID v4 or 32+ character hex string (single-use).
6. Line endings MUST be standard newline `\n`.

---

## 4. Standalone Owner Signing Tool (Reference Implementation)
The following script can be executed by the Owner on their isolated workstation:

```typescript
import * as crypto from 'crypto';
import * as fs from 'fs';

interface MigrationPlan {
  planId: string;
  environment: 'PRODUCTION';
  targetRef: string;
  gitSha: string;
  aggregateSqlDigest: string;
  migrations: Array<{
    filename: string;
    version: string;
    disambiguatedVersion?: string;
    sha256: string;
    orderNumber: number;
  }>;
}

export function signProductionMigrationPlan(
  plan: MigrationPlan,
  ownerPrivateKeyPem: string,
  approvedBy: string,
  validityMinutes: number = 60
) {
  const tokenNonce = crypto.randomUUID();
  const approvedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000).toISOString();

  const migrationsStr = plan.migrations.map((m, idx) =>
    `${idx}:${m.filename}:${m.version}:${m.disambiguatedVersion || m.version}:${m.sha256}:${m.orderNumber}`
  ).join('\n');

  const canonicalPayload = [
    'SCOPE:PRODUCTION_MIGRATION',
    `PROJECT_REF:${plan.targetRef}`,
    `GIT_SHA:${plan.gitSha}`,
    `NONCE:${tokenNonce}`,
    `AGGREGATE_DIGEST:${plan.aggregateSqlDigest}`,
    `APPROVED_BY:${approvedBy}`,
    `APPROVED_AT:${approvedAt}`,
    `EXPIRES_AT:${expiresAt}`,
    'MIGRATIONS_START',
    migrationsStr,
    'MIGRATIONS_END'
  ].join('\n');

  const signature = crypto.sign(
    null,
    Buffer.from(canonicalPayload, 'utf8'),
    ownerPrivateKeyPem
  ).toString('hex');

  return {
    environment: 'PRODUCTION',
    targetProjectRef: plan.targetRef,
    executionScope: 'PRODUCTION_MIGRATION',
    tokenNonce,
    approvedGitSha: plan.gitSha,
    migrations: plan.migrations.map(m => ({
      filename: m.filename,
      version: m.version,
      disambiguatedVersion: m.disambiguatedVersion || m.version,
      sha256: m.sha256,
      orderNumber: m.orderNumber
    })),
    aggregateSqlDigest: plan.aggregateSqlDigest,
    approvedBy,
    approvedAt,
    expiresAt,
    signature
  };
}
```

---

## 5. Nonce Store DDL Requirement
Before Production automation can execute, the following table must be provisioned in the Production Supabase database:

```sql
CREATE TABLE IF NOT EXISTS supabase_migrations.consumed_approval_tokens (
  nonce TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  git_sha TEXT NOT NULL,
  aggregate_digest TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

> **Important**: The automation engine will **FAIL CLOSED** and refuse to execute if this table is missing. Automatic DDL creation of this table during authorization is strictly blocked.
