const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Running migration 0127_admin_unread_notifications.sql via exec_sql RPC...');

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '0127_admin_unread_notifications.sql'), 'utf8');

  const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
  console.log('RPC exec_sql result:', rpcRes, 'RPC error:', rpcErr);

  // Check columns
  const tables = ['applications', 'po_requests', 'products', 'supplier_invoices'];
  for (const t of tables) {
    const { data, error } = await admin.from(t).select('id, admin_read_at').limit(1);
    if (error) {
      console.log(`Table ${t} verify ERROR:`, error.message);
    } else {
      console.log(`Table ${t} verified successfully! Sample:`, data);
    }
  }
}

main().catch(console.error);
