const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  const k = parts[0];
  const v = parts.slice(1).join('=');
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '');
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SECRET_KEY);

async function checkSchema() {
  const { data: cuCols } = await supabase.from('company_users').select('*').limit(1);
  console.log('company_users keys:', Object.keys(cuCols?.[0] || {}));

  const { data: appCols } = await supabase.from('applications').select('*').limit(1);
  console.log('applications keys:', Object.keys(appCols?.[0] || {}));

  const { data: retCols } = await supabase.from('retailer_invitations').select('*').limit(1);
  console.log('retailer_invitations keys:', Object.keys(retCols?.[0] || {}));
}
checkSchema();
