const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright');

// Load .env.local keys
const envText = fs.readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach((line) => {
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
  console.log('=== ADM-TRD-DETAIL-001-R2 DB & Product Pre-Check Starting ===');

  // 1. Fetch selected products
  const { data: prods, error: pErr } = await client
    .from('products')
    .select('id, name, letusto_sku, manufacture_sku, upc, selection_status, trading_status, retailer_visibility')
    .eq('selection_status', 'SELECTED')
    .limit(10);

  if (pErr) {
    console.error('Error fetching products:', pErr.message);
    process.exit(1);
  }

  console.log(`Found ${prods.length} SELECTED products:`);
  prods.forEach(p => {
    console.log(`- [${p.id}] ${p.name}`);
    console.log(`  Letusto SKU: ${p.letusto_sku || 'None'}`);
    console.log(`  Mfg SKU: ${p.manufacture_sku || 'None'}`);
    console.log(`  UPC: ${p.upc || 'None'}`);
  });

  // 2. Fetch warehouses
  const { data: whs, error: whErr } = await client
    .from('warehouses')
    .select('id, name, code, status');
  
  if (whErr) {
    console.error('Error fetching warehouses:', whErr.message);
    process.exit(1);
  }
  console.log(`\nFound ${whs.length} warehouses:`);
  whs.forEach(w => console.log(`- [${w.code}] ${w.name} (${w.status}) - ID: ${w.id}`));

  console.log('\n✓ Pre-check Passed successfully.');
})().catch(err => {
  console.error('Pre-check failed:', err);
  process.exit(1);
});
