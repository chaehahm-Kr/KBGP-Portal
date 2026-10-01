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

const supabase = createClient('https://shzfrppdobpmrstcjfqu.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);

async function checkInviteLinkRedirect() {
  const targetRedirect = 'https://portal.kselectnetwork.com/portal/invite/accept';
  const email = 'test-redirect-' + Date.now() + '@letusto.com';
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: targetRedirect,
      data: { role: 'portal', display_name: 'URL Redirect Check' }
    }
  });
  if (error) {
    console.error('generateLink error:', error);
    return;
  }
  
  let actionLink = data.properties?.action_link;
  console.log('Original Action Link:', actionLink);
  
  // Ensure redirect_to is set explicitly
  try {
    const u = new URL(actionLink);
    u.searchParams.set('redirect_to', targetRedirect);
    actionLink = u.toString();
  } catch(e) {}
  console.log('Formatted Action Link:', actionLink);

  // Fetch without automatically following redirects
  const res = await fetch(actionLink, { method: 'GET', redirect: 'manual' });
  console.log('HTTP Status:', res.status);
  console.log('Location Header:', res.headers.get('location'));

  // Clean up test user
  await supabase.auth.admin.deleteUser(data.user.id);
}

checkInviteLinkRedirect();
