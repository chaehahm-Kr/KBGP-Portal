import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

let envRaw = '';
if (fs.existsSync('.env.production.local')) {
  envRaw += '\n' + fs.readFileSync('.env.production.local', 'utf8');
}
if (fs.existsSync('.env.local')) {
  envRaw += '\n' + fs.readFileSync('.env.local', 'utf8');
}
const env: Record<string, string> = {};
envRaw.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey!);

async function main() {
  const { data: user, error } = await supabase
    .from('company_users')
    .select('id, email, company_role, permissions, company_id')
    .eq('email', 'support123@letusto.com')
    .single();

  if (error || !user) {
    console.error('Error fetching user:', error);
    return;
  }

  console.log('User support123@letusto.com details:');
  console.log('ID:', user.id);
  console.log('Role:', user.company_role);
  console.log('Company ID:', user.company_id);
  console.log('Permissions:', JSON.stringify(user.permissions, null, 2));

  const { normalizePermissions, ROLE_PRESETS, ACL_LEVEL_NUMERIC } = await import('../lib/permissions/brand-portal-acl');
  const effectivePerms = normalizePermissions(user.permissions, user.company_role);

  console.log('\n--- Authoritative Effective ACL Permissions for User ---');
  for (const [cat, level] of Object.entries(effectivePerms)) {
    const num = ACL_LEVEL_NUMERIC[level as keyof typeof ACL_LEVEL_NUMERIC] || 0;
    console.log(`[${cat}]: ${level} (Read: ${num >= 1}, Write: ${num >= 2}, Manage: ${num >= 3})`);
  }

  console.log('\n--- Canonical Viewer Role ACL Evaluation Test ---');
  const viewerPerms = normalizePermissions({}, 'company_viewer');
  for (const [cat, level] of Object.entries(viewerPerms)) {
    const num = ACL_LEVEL_NUMERIC[level as keyof typeof ACL_LEVEL_NUMERIC] || 0;
    console.log(`[Viewer - ${cat}]: ${level} (Read: ${num >= 1}, Write: ${num >= 2}, Manage: ${num >= 3})`);
  }
}

main().catch(console.error);
