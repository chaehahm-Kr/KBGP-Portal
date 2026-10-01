const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split(/\r?\n/);
const parsed = {};
for (const line of lines) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) parsed[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
}

const supabaseUrl = parsed.NEXT_PUBLIC_SUPABASE_URL || 'https://shzfrppdobpmrstcjfqu.supabase.co';
const serviceKey = parsed.SUPABASE_SECRET_KEY || parsed.SUPABASE_SERVICE_ROLE_KEY || parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function check() {
  const { data: apps, error: errA } = await supabase.from('applications').select('*').limit(1);
  console.log('applications columns:', apps ? Object.keys(apps[0] || {}) : errA);

  const { data: poReqs, error: errB } = await supabase.from('po_requests').select('*').limit(1);
  console.log('po_requests columns:', poReqs ? Object.keys(poReqs[0] || {}) : errB);

  const { data: prods, error: errC } = await supabase.from('products').select('*').limit(1);
  console.log('products columns:', prods ? Object.keys(prods[0] || {}) : errC);

  const { data: invs, error: errD } = await supabase.from('supplier_invoices').select('*').limit(1);
  console.log('supplier_invoices columns:', invs ? Object.keys(invs[0] || {}) : errD);
}

check();
