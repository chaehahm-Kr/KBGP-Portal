const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let v = match[2] || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
      process.env[match[1]] = v.trim();
    }
  });
}

const admin = createClient('https://shzfrppdobpmrstcjfqu.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

async function testMagicLink() {
  const email = 'support1@letusto.com';
  const targetRedirect = 'https://portal.kselectnetwork.com/portal/invite/accept';

  console.log('Testing generateLink with magiclink for existing auth user support1@letusto.com...');
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: targetRedirect,
    }
  });

  if (error) {
    console.error('generateLink magiclink error:', error);
    return;
  }

  console.log('User ID:', data.user.id);
  console.log('Action Link:', data.properties?.action_link);

  let actionLink = data.properties?.action_link;
  try {
    const u = new URL(actionLink);
    u.searchParams.set('redirect_to', targetRedirect);
    actionLink = u.toString();
  } catch(e) {}

  const res = await fetch(actionLink, { method: 'GET', redirect: 'manual' });
  console.log('HTTP Redirect Status:', res.status);
  console.log('Location Header:', res.headers.get('location'));
}

testMagicLink().catch(console.error);
