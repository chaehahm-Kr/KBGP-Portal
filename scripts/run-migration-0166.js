const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

let env = {};
const envPaths = ['.env.production.local', '.env.local'];
for (const envPath of envPaths) {
  const fullPath = path.join(process.cwd(), envPath);
  if (fs.existsSync(fullPath)) {
    const envText = fs.readFileSync(fullPath, 'utf8');
    envText.split('\n').forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
      }
    });
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('Testing execution of migration 0166_net_terms_credit_reservation.sql via exec_sql RPC...');

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '0166_net_terms_credit_reservation.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    const { data: rpcRes, error: rpcErr } = await admin.rpc('exec_sql', { sql_query: sql });
    console.log('RPC exec_sql result:', rpcRes, 'RPC error:', rpcErr);
  } catch (err) {
    console.log('RPC call failed:', err.message);
  }

  // Verify function compute_retailer_credit_exposure
  const { data: testComp } = await admin.from('retailer_profiles').select('company_id').limit(1).single();
  if (testComp?.company_id) {
    const { data: expRes, error: expErr } = await admin.rpc('compute_retailer_credit_exposure', {
      p_company_id: testComp.company_id,
    });
    console.log('compute_retailer_credit_exposure result:', expRes, 'Error:', expErr);
  }
}

main().catch(console.error);
