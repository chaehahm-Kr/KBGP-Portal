const fs = require('fs');
const path = require('path');
const envFile = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: apps, error: appErr } = await admin.from('applications').select('*').ilike('applicant_company_name', '%Extreme%');
  console.log('APPLICATION:', JSON.stringify(apps, null, 2), appErr);

  if (apps && apps.length > 0) {
    for (const app of apps) {
      console.log('--- App', app.application_number, app.id, app.status, '---');
      const { data: comp } = await admin.from('companies').select('*').eq('id', app.company_id);
      console.log('COMPANY:', JSON.stringify(comp, null, 2));

      const { data: cu } = await admin.from('company_users').select('*').eq('company_id', app.company_id);
      console.log('COMPANY_USERS:', JSON.stringify(cu, null, 2));

      const { data: logs } = await admin.from('activity_logs').select('*').eq('entity_id', app.id);
      console.log('ACTIVITY LOGS:', JSON.stringify(logs, null, 2));
    }
  }
}
check();
