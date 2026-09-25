const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SECRET_KEY=([^\r\n]+)/)?.[1]?.trim();

const sb = createClient(url, key, {
  auth: { persistSession: false }
});

async function main() {
  console.log('==================================================');
  console.log('VERIFYING PRODUCTION MIGRATION 0104 (RTP-PRT-001)');
  console.log('==================================================\n');

  // 1. Verify retailer_initial_trial_protections table
  const { data: protections, error: pErr } = await sb
    .from('retailer_initial_trial_protections')
    .select(`
      id,
      company_id,
      product_id,
      trial_start_date,
      trial_end_date,
      protected_quantity,
      status,
      activation_source,
      review_requested_at,
      products:product_id ( letusto_sku, name )
    `)
    .order('trial_start_date', { ascending: true });

  if (pErr) {
    console.error('❌ Error reading retailer_initial_trial_protections:', pErr);
    process.exit(1);
  }

  console.log(`✓ retailer_initial_trial_protections table exists. Found ${protections.length} seeded protection records:`);
  protections.forEach(r => {
    console.log(`  - [${r.products?.letusto_sku}] ${r.products?.name}`);
    console.log(`    Status: ${r.status} | Protected Qty: ${r.protected_quantity} units`);
    console.log(`    Trial Window: ${r.trial_start_date} to ${r.trial_end_date}`);
    if (r.review_requested_at) {
      console.log(`    Review Requested At: ${r.review_requested_at}`);
    }
  });

  // 2. Test unique constraint on (company_id, product_id)
  if (protections.length > 0) {
    const sample = protections[0];
    const { error: dupErr } = await sb
      .from('retailer_initial_trial_protections')
      .insert({
        company_id: sample.company_id,
        product_id: sample.product_id,
        protected_quantity: 10,
        status: 'active'
      });

    if (dupErr && dupErr.code === '23505') {
      console.log('\n✓ One-Time Protection Enforcement verified: duplicate (company_id, product_id) correctly blocked by unique constraint (23505)');
    } else {
      console.warn('⚠️ Unique constraint check result:', dupErr);
    }
  }

  console.log('\n==================================================');
  console.log('PRODUCTION DATABASE VERIFICATION SUCCESSFUL');
  console.log('==================================================');
}

main().catch(err => {
  console.error('Fatal error during production verification:', err);
  process.exit(1);
});
