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
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectUser() {
  const userId = 'ea6e03fa-bc38-4612-aeeb-b2faee3e5d20';
  const { data: user, error } = await supabase.from('company_users').select('*').eq('id', userId).single();
  console.log('company_users:', user);
  if (error) console.error('user error:', error);

  const { data: prof, error: profErr } = await supabase.from('profiles').select('*').eq('id', userId).single();
  console.log('profiles:', prof);
  if (profErr) console.error('prof error:', profErr);

  // Check table schema for company_users
  const { data: sampleRow } = await supabase.from('company_users').select('*').limit(1);
  console.log('Sample company_users keys:', sampleRow ? Object.keys(sampleRow[0]) : 'None');
}
inspectUser();
