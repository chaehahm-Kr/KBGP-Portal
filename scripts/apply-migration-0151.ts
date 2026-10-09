import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envText = fs.readFileSync('.env.local', 'utf8');
const env: Record<string, string> = {};
envText.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const client = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('=== APPLYING MIGRATION 0151 TO PRODUCTION SUPABASE ===');

  // 1. Force hidden for inactive / historical trading products
  const { error: err1 } = await client
    .from('products')
    .update({ retailer_visibility: 'hidden' })
    .in('trading_status', ['inactive', 'historical']);

  if (err1) {
    console.error('Error applying step 1:', err1);
    process.exit(1);
  }
  console.log('✓ Step 1 complete: Inactive/Historical products set to hidden.');

  // Verify normalized counts
  const { data: prods } = await client
    .from('products')
    .select('id, trading_status, retailer_visibility');

  const visibleInactives = (prods || []).filter(
    (p) => p.trading_status !== 'active' && p.retailer_visibility === 'visible'
  );

  console.log(`✓ Verification complete. Contradicting visible inactive products: ${visibleInactives.length}`);
}

main().catch(console.error);
