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
  console.log('=== Checking profiles for tammyhahm@gmail.com ===');
  const { data: profs } = await sb.from('profiles').select('*').ilike('email', '%tammyhahm%');
  console.log('profiles:', profs);

  console.log('=== Checking auth users for tammyhahm@gmail.com ===');
  const { data: authUsers, error: errAuth } = await sb.auth.admin.listUsers();
  const matched = (authUsers?.users || []).filter(u => u.email?.includes('tammyhahm') || u.email?.includes('letusto'));
  console.log('matched auth users:', matched.map(u => ({ id: u.id, email: u.email })));
}

main().catch(console.error);
