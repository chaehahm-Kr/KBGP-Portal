const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
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
const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data: attempts } = await client.from('login_attempts').select('*').eq('email', 'tammyhahm@gmail.com');
  console.log('Login attempts in DB:', attempts);

  const { data: { users } } = await client.auth.admin.listUsers();
  const target = users.find(u => u.email?.toLowerCase() === 'tammyhahm@gmail.com');
  console.log('User status:', target ? {
    id: target.id,
    email: target.email,
    created_at: target.created_at,
    last_sign_in_at: target.last_sign_in_at,
    email_confirmed_at: target.email_confirmed_at,
    banned_until: target.banned_until,
  } : 'NOT FOUND');
})();

