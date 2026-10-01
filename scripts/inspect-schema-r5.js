const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co',
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: agr, error: agrErr } = await sb.from('company_agreements').select('*').limit(3);
  console.log('company_agreements sample keys:', agr && agr[0] ? Object.keys(agr[0]) : agrErr);
  if (agr && agr[0]) console.log('sample row:', agr[0]);

  const extremeId = "7d669d13-1c62-494e-a520-c2133348edbe";
  const brandsGlobalId = "4c845ae8-b93b-4db2-858f-bda3252e8167";

  const { data: extAgr } = await sb.from('company_agreements').select('*').eq('company_id', extremeId);
  console.log('\nExtreme Inc agreement:', extAgr);

  const { data: bgAgr } = await sb.from('company_agreements').select('*').eq('company_id', brandsGlobalId);
  console.log('Brands Global agreement:', bgAgr);
}

main().catch(console.error);
