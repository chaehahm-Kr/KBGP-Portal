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

async function checkTemplates() {
  const { data: templates, error } = await admin.from('email_templates').select('*').in('key', [
    'inquiry_received_applicant',
    'application_submitted_company',
    'review_result_approved',
    'portal_signup_request',
    'brand_application_rejected',
    'review_result_rejected'
  ]);
  console.log('TEMPLATES:', JSON.stringify(templates, null, 2), error);
}
checkTemplates();
