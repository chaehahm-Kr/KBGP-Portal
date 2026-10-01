const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const admin = createClient(supabaseUrl, supabaseSecretKey);

async function run() {
  const { data: b } = await admin.from('brands').select('*').limit(2);
  console.log('Brands:', b);
  const { data: p } = await admin.from('products').select('*').limit(2);
  console.log('Products:', p);
  const { data: c } = await admin.from('companies').select('*').limit(2);
  console.log('Companies:', c);
  const { data: u } = await admin.from('company_users').select('*').limit(2);
  console.log('Company Users:', u);
  const { data: app } = await admin.from('applications').select('*').limit(2);
  console.log('Applications:', app);
}

run();
