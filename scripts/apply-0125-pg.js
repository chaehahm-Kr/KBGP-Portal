const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const connectionString = env.POSTGRES_URL || env.DATABASE_URL || env.SUPABASE_DB_URL;

if (!connectionString) {
  console.log("No POSTGRES_URL found in .env.local.");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL DB.");

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0125_admin_invite_brand_activation_guard.sql'), 'utf8');
  await client.query(sql);
  console.log("Migration 0125 applied successfully!");

  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'company_users' AND column_name = 'invitation_token_hash'");
  console.log("Schema verification result:", res.rows);

  await client.end();
}

main().catch(err => {
  console.error("PG Migration Error:", err);
  process.exit(1);
});
