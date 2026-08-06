const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env variables from .env.local
const envPath = path.join(__dirname, '.env.local');
let supabaseUrl = '';
let supabaseAnonKey = '';
let supabaseServiceKey = '';

if (require('fs').existsSync(envPath)) {
  const content = require('fs').readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val;
      if (key === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') supabaseAnonKey = val;
      if (key === 'SUPABASE_SECRET_KEY') supabaseServiceKey = val;
    }
  });
}

console.log("Supabase URL:", supabaseUrl);

async function check() {
  // Check with Service role key (bypassing RLS)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: adminProds, error: adminErr } = await supabaseAdmin.from('products').select('id, name, status, category_code');
  if (adminErr) {
    console.error("Admin client select error:", adminErr);
  } else {
    console.log(`Admin Client found ${adminProds.length} products`);
    if (adminProds.length > 0) {
      console.log("All products from admin:", adminProds);
    }
  }

  // Check with Anon Key
  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
  const { data: anonProds, error: anonErr } = await supabaseAnon.from('products').select('id, name');
  if (anonErr) {
    console.error("Anon client select error:", anonErr);
  } else {
    console.log(`Anon Client found ${anonProds.length} products`);
  }
}

check();
