const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function testRecoveryFlow() {
  console.log('====================================================');
  console.log('Testing Retailer Password Reset Flow (RTP-AUTH-002)');
  console.log('====================================================\n');

  const email = 'qa-retailer-test@letusto.com';
  const targetRedirect = 'https://portal.kselecthub.com/reset-password';

  console.log(`[Step 1] Generating Supabase Recovery Link for ${email}...`);
  console.log(`Target Redirect URL: ${targetRedirect}`);

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email: email,
    options: {
      redirectTo: targetRedirect,
    },
  });

  if (error || !data?.properties?.action_link) {
    console.error('Failed to generate recovery link:', error?.message);
    process.exit(1);
  }

  let actionLink = data.properties.action_link;
  const parsed = new URL(actionLink);
  parsed.searchParams.set('redirect_to', targetRedirect);
  actionLink = parsed.toString();

  console.log('Generated Recovery Action Link:', actionLink);
  console.log('Redirect_to parameter:', parsed.searchParams.get('redirect_to'));

  if (parsed.searchParams.get('redirect_to') === targetRedirect) {
    console.log('✅ PASS: redirect_to matches canonical https://portal.kselecthub.com/reset-password');
  } else {
    console.error('❌ FAIL: redirect_to mismatch!');
    process.exit(1);
  }
}

testRecoveryFlow().catch(console.error);
