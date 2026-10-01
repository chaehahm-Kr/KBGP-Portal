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

  // Check which tables exist in public schema
  const tableCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('applications', 'po_requests', 'products', 'supplier_invoices');
  `);
  console.log("Existing target tables:", tableCheck.rows.map(r => r.table_name));

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0127_admin_unread_notifications.sql'), 'utf8');
  await client.query(sql);
  console.log("Migration 0127 applied successfully!");

  const res = await client.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name IN ('admin_read_at', 'admin_read_by')
    ORDER BY table_name, column_name;
  `);
  console.log("Verified columns across tables:", res.rows);

  await client.end();
}

main().catch(err => {
  console.error("PG Migration Error:", err);
  process.exit(1);
});
