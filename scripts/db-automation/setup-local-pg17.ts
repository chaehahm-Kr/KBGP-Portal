import * as fs from 'fs';
// @ts-ignore
import { Client } from 'pg';

export async function setupLocalPg17(certPath: string) {
  const ca = fs.readFileSync(certPath, 'utf8');
  const client = new Client({
    connectionString: 'postgresql://postgres@127.0.0.1:54329/postgres',
    ssl: { ca, rejectUnauthorized: true },
    connectionTimeoutMillis: 10000
  });

  await client.connect();

  async function ensureRole(roleName: string, extraSql = '') {
    const res = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1;', [roleName]);
    if (res.rows.length === 0) {
      await client.query(`CREATE ROLE ${roleName} ${extraSql};`);
    }
  }

  // Required Supabase-equivalent roles for PROVISION_NONCE_STORE.sql
  await ensureRole('anon', 'NOLOGIN');
  await ensureRole('authenticated', 'NOLOGIN');
  await ensureRole('service_role', 'NOLOGIN');

  // Restricted runtime migration role
  await ensureRole('kselect_migrator', "WITH LOGIN PASSWORD 'migrator_test_pwd'");
  // Restricted unprivileged role for negative test
  await ensureRole('kselect_unprivileged', "WITH LOGIN PASSWORD 'unprivileged_test_pwd'");

  // Apply PROVISION_NONCE_STORE.sql DDL artifact as postgres
  const ddl = fs.readFileSync('scripts/db-automation/PROVISION_NONCE_STORE.sql', 'utf8');
  await client.query(ddl);

  // Standard Supabase migrations schema
  await client.query('CREATE SCHEMA IF NOT EXISTS supabase_migrations;');
  await client.query(`
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version TEXT PRIMARY KEY,
      statements TEXT[],
      name TEXT
    );
  `);
  await client.query('GRANT USAGE, CREATE ON SCHEMA supabase_migrations TO kselect_migrator;');
  await client.query('GRANT ALL ON TABLE supabase_migrations.schema_migrations TO kselect_migrator;');

  // Grant privileges to restricted runtime role
  await client.query('GRANT USAGE, CREATE ON SCHEMA public TO kselect_migrator;');
  await client.query('GRANT USAGE ON SCHEMA _kselect_ops TO kselect_migrator;');
  await client.query('GRANT SELECT, INSERT ON TABLE _kselect_ops.consumed_approval_tokens TO kselect_migrator;');
  await client.query('GRANT UPDATE (status, execution_error) ON TABLE _kselect_ops.consumed_approval_tokens TO kselect_migrator;');

  console.log('PostgreSQL 17 schema and roles provisioned successfully.');
  await client.end();
}

if (process.argv[1]?.includes('setup-local-pg17')) {
  setupLocalPg17('C:/Users/ChaeHahm/.tmp_pg17_runtime/certs/server.crt')
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
